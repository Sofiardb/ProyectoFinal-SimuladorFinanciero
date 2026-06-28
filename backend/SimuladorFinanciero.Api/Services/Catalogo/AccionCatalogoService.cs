using SimuladorFinanciero.Api.DTOs.Instrumentos;
using SimuladorFinanciero.Api.Infrastructure.ExternalApis.AlphaVantage;
using SimuladorFinanciero.Api.Repositories;

namespace SimuladorFinanciero.Api.Services.Catalogo;

public interface IAccionCatalogoService
{
    Task<IReadOnlyList<GbmRefreshResult>> RecalcularGbmTodosAsync(CancellationToken ct = default);
    Task<GbmRefreshResult?> RecalcularGbmAsync(string ticker, CancellationToken ct = default);
    Task<IReadOnlyList<AccionResponse>> ObtenerActivasAsync(CancellationToken ct = default);
    Task<AccionResponse?> ObtenerPorIdAsync(long id, CancellationToken ct = default);
}

public sealed class AccionCatalogoService : IAccionCatalogoService
{
    private const int TradingDaysPerMonth = 21;
    private const int LookbackYears       = 10;

    private readonly IAlphaVantageApiClient _av;
    private readonly IAccionRepository      _repo;
    private readonly ILogger<AccionCatalogoService> _log;

    // Cache de SPX para no descargarlo dos veces en la misma ronda de recálculo
    private IReadOnlyList<(DateOnly, decimal)>? _spxCache;
    private DateTime _spxCacheTime = DateTime.MinValue;

    public AccionCatalogoService(
        IAlphaVantageApiClient av,
        IAccionRepository repo,
        ILogger<AccionCatalogoService> log)
    {
        _av   = av;
        _repo = repo;
        _log  = log;
    }

    public async Task<IReadOnlyList<GbmRefreshResult>> RecalcularGbmTodosAsync(CancellationToken ct = default)
    {
        var tickers = await _repo.ObtenerTickersActivosAsync(ct);
        _log.LogInformation("AccionCatalogoService: recalculando GBM para {Count} acciones.", tickers.Count);

        var resultados = new List<GbmRefreshResult>();
        foreach (var ticker in tickers)
        {
            var r = await RecalcularGbmAsync(ticker, ct);
            if (r is not null) resultados.Add(r);
        }
        return resultados;
    }

    public async Task<GbmRefreshResult?> RecalcularGbmAsync(string ticker, CancellationToken ct = default)
    {
        _log.LogInformation("AlphaVantage: calculando GBM para {Ticker}.", ticker);

        var meta   = await _repo.ObtenerMetadatosAsync(ticker, ct);
        var nombre = meta?.Nombre ?? ticker;
        var sector = meta?.Sector;

        var preciosTicker = await _av.ObtenerPreciosAjustadosAsync(ticker, ct);
        var preciosSpy    = await ObtenerSpxAsync(ct);

        if (preciosTicker.Count < 100)
        {
            _log.LogWarning("AlphaVantage: serie insuficiente para {Ticker} ({Count} puntos).",
                ticker, preciosTicker.Count);
            return null;
        }

        if (preciosSpy.Count < 100)
        {
            _log.LogWarning("AlphaVantage: serie SPX insuficiente ({Count} puntos) — se omite {Ticker}.",
                preciosSpy.Count, ticker);
            return null;
        }

        var corte    = DateOnly.FromDateTime(DateTime.Today.AddYears(-LookbackYears));
        var serie    = preciosTicker.Where(p => p.Fecha >= corte).ToList();
        var spySerie = preciosSpy.Where(p => p.Fecha >= corte).ToList();

        var retornosTicker = GbmMath.LogReturns(serie);
        var retornosSpy    = GbmMath.LogReturns(spySerie);

        var (aligned, alignedSpy) = GbmMath.AlinearPorFecha(serie, spySerie, retornosTicker, retornosSpy);

        if (aligned.Count < 50)
        {
            _log.LogWarning("AlphaVantage: no hay suficientes retornos alineados para {Ticker}.", ticker);
            return null;
        }

        double muDiario    = aligned.Average();
        double varianza    = aligned.Select(r => Math.Pow(r - muDiario, 2)).Average();
        double sigmaDiario = Math.Sqrt(varianza);

        double muMensual    = muDiario    * TradingDaysPerMonth;
        double sigmaMensual = sigmaDiario * Math.Sqrt(TradingDaysPerMonth);
        double rho          = Correlacion(aligned, alignedSpy);

        var precioActual = serie[^1].PrecioAjustado;
        var mesesDeDatos = GbmMath.CalcularMesesDeDatos(serie[0].Fecha, serie[^1].Fecha);

        await _repo.UpsertGbmParamsAsync(new AccionUpsertData
        {
            Ticker               = ticker,
            Nombre               = nombre,
            Sector               = sector,
            MuRetornoEsperado    = (decimal)muMensual,
            SigmaVolatilidad     = (decimal)sigmaMensual,
            RhoCorrelacionIndice = (decimal)Math.Clamp(rho, -1.0, 1.0),
            PrecioActual         = precioActual
        }, ct);

        _log.LogInformation(
            "{Ticker}: μ={Mu:F4} σ={Sigma:F4} ρ={Rho:F4} S₀={S0:F2} ({Meses} meses de datos)",
            ticker, muMensual, sigmaMensual, rho, precioActual, mesesDeDatos);

        return new GbmRefreshResult(
            ticker,
            (decimal)muMensual,
            (decimal)sigmaMensual,
            (decimal)Math.Clamp(rho, -1.0, 1.0),
            precioActual,
            mesesDeDatos);
    }

    public Task<IReadOnlyList<AccionResponse>> ObtenerActivasAsync(CancellationToken ct = default) =>
        _repo.ObtenerActivasAsync(ct);

    public Task<AccionResponse?> ObtenerPorIdAsync(long id, CancellationToken ct = default) =>
        _repo.ObtenerPorIdAsync(id, ct);

    private async Task<IReadOnlyList<(DateOnly Fecha, decimal PrecioAjustado)>> ObtenerSpxAsync(
        CancellationToken ct)
    {
        if (_spxCache is not null && _spxCache.Count > 0 && (DateTime.UtcNow - _spxCacheTime).TotalHours < 24)
            return _spxCache;

        var resultado = await _av.ObtenerPreciosSpxAsync(ct);
        if (resultado.Count > 0)
        {
            _spxCache     = resultado;
            _spxCacheTime = DateTime.UtcNow;
        }
        return resultado;
    }

    private static List<double> LogReturns(List<(DateOnly Fecha, decimal PrecioAjustado)> serie)
    {
        var result = new List<double>(Math.Max(0, serie.Count - 1));
        for (int i = 1; i < serie.Count; i++)
        {
            if (serie[i - 1].PrecioAjustado <= 0 || serie[i].PrecioAjustado <= 0) continue;
            result.Add(Math.Log((double)(serie[i].PrecioAjustado / serie[i - 1].PrecioAjustado)));
        }
        return result;
    }

    private static (List<double> Ticker, List<double> Spy) AlinearPorFecha(
        List<(DateOnly Fecha, decimal Precio)> serieTicker,
        List<(DateOnly Fecha, decimal Precio)> serieSpy,
        List<double> retTicker,
        List<double> retSpy)
    {
        var fechasTicker = serieTicker.Skip(1).Select(p => p.Fecha).ToList();
        var fechasSpy    = serieSpy.Skip(1).Select(p => p.Fecha).ToList();

        var spyPorFecha = fechasSpy.Zip(retSpy).ToDictionary(x => x.First, x => x.Second);

        var alineadoTicker = new List<double>();
        var alineadoSpy    = new List<double>();

        for (int i = 0; i < fechasTicker.Count && i < retTicker.Count; i++)
        {
            if (!spyPorFecha.TryGetValue(fechasTicker[i], out var rs)) continue;
            alineadoTicker.Add(retTicker[i]);
            alineadoSpy.Add(rs);
        }

        return (alineadoTicker, alineadoSpy);
    }

    private static double Correlacion(List<double> x, List<double> y)
    {
        if (x.Count != y.Count || x.Count == 0) return 0;
        double mx = x.Average(), my = y.Average();
        double num = x.Zip(y).Sum(p => (p.First - mx) * (p.Second - my));
        double dx  = Math.Sqrt(x.Sum(v => Math.Pow(v - mx, 2)));
        double dy  = Math.Sqrt(y.Sum(v => Math.Pow(v - my, 2)));
        return (dx == 0 || dy == 0) ? 0 : num / (dx * dy);
    }
}
