using SimuladorFinanciero.Api.DTOs.Instrumentos;
using SimuladorFinanciero.Api.Infrastructure.ExternalApis.ArgentinaDatos;
using SimuladorFinanciero.Api.Infrastructure.ExternalApis.Docta;
using SimuladorFinanciero.Api.Models;
using SimuladorFinanciero.Api.Repositories;

namespace SimuladorFinanciero.Api.Services.Catalogo;

public interface IBonoCatalogoService
{
    /// <summary>Refresca TIR y precio de bonos activos (cada 15 min en horario bursátil).</summary>
    Task RefrescarYieldsAsync(CancellationToken ct = default);

    /// <summary>Refresca flujos de caja de todos los bonos desde Docta (cada 24 hs).</summary>
    Task RefrescarFlujosCajaAsync(CancellationToken ct = default);

    Task<IReadOnlyList<BonoResponse>> ObtenerActivosAsync(CancellationToken ct = default);
    Task<BonoResponse?> ObtenerPorIdAsync(long id, CancellationToken ct = default);
}

public sealed class BonoCatalogoService : IBonoCatalogoService
{
    private static readonly string[] SubAssetClasses = ["FIXED_RATE", "CER"];

    private readonly IArgentinaDatosApiClient _argentinaDatos;
    private readonly IDoctaApiClient          _docta;
    private readonly IBonoRepository          _repo;
    private readonly ILogger<BonoCatalogoService> _log;

    public BonoCatalogoService(
        IArgentinaDatosApiClient argentinaDatos,
        IDoctaApiClient          docta,
        IBonoRepository          repo,
        ILogger<BonoCatalogoService> log)
    {
        _argentinaDatos = argentinaDatos;
        _docta          = docta;
        _repo           = repo;
        _log            = log;
    }

    /// <summary>
    /// Docta es la fuente de verdad de qué bonos existen (catálogo + TIR + flujos); BYMA Open Data
    /// no cotiza LECAP/BONTE/BONCER en sus endpoints gratuitos, así que el precio (por VN100) se
    /// toma de ArgentinaDatos. Un bono solo queda activo si está en AMBAS fuentes — si Docta lo
    /// deja de listar, o ArgentinaDatos no tiene precio para él, se desactiva.
    /// </summary>
    private async Task<IReadOnlyDictionary<string, decimal>> ObtenerPreciosAsync(CancellationToken ct)
    {
        var letrasBonteTask = _argentinaDatos.ObtenerPreciosLetrasBonteAsync(ct);
        var bonosCerTask    = _argentinaDatos.ObtenerPreciosBonosCerAsync(ct);
        await Task.WhenAll(letrasBonteTask, bonosCerTask);

        var precios = new Dictionary<string, decimal>(letrasBonteTask.Result);
        foreach (var (ticker, precio) in bonosCerTask.Result)
            precios[ticker] = precio;

        _log.LogInformation("ArgentinaDatos: {Count} precios de bonos del Tesoro obtenidos.", precios.Count);
        return precios;
    }

    public async Task RefrescarYieldsAsync(CancellationToken ct = default)
    {
        var precios = await ObtenerPreciosAsync(ct);
        var tickersVigentes = new HashSet<string>();

        foreach (var clase in SubAssetClasses)
        {
            IReadOnlyList<DoctaInstrumentoDto> instrumentos;
            try
            {
                instrumentos = await _docta.ObtenerInstrumentosAsync(clase, ct);
            }
            catch (Exception ex)
            {
                _log.LogError(ex, "Docta: error al obtener instrumentos ({Clase}).", clase);
                continue;
            }

            foreach (var inst in instrumentos)
            {
                if (!precios.TryGetValue(inst.Ticker, out var precio))
                {
                    _log.LogDebug("Bono {Ticker}: sin precio en ArgentinaDatos, se omite.", inst.Ticker);
                    continue;
                }

                try
                {
                    var yield = await _docta.ObtenerYieldAsync(inst.Ticker, ct);
                    if (yield is null) continue;

                    await _repo.ActualizarYieldAsync(inst.Ticker, yield.Tir, ct);
                    await _repo.ActualizarPrecioAsync(inst.Ticker, precio, ct);
                    tickersVigentes.Add(inst.Ticker);
                }
                catch (Exception ex)
                {
                    _log.LogWarning(ex, "Error al actualizar yield/precio para {Ticker}.", inst.Ticker);
                }
            }
        }

        await _repo.DesactivarNoListadosAsync(tickersVigentes, ct);
        _log.LogInformation("BonoCatalogo: yields y precios actualizados ({Count} bonos vigentes).", tickersVigentes.Count);
    }

    public async Task RefrescarFlujosCajaAsync(CancellationToken ct = default)
    {
        var hoy = DateOnly.FromDateTime(DateTime.Today);
        var precios = await ObtenerPreciosAsync(ct);
        var tickersVigentes = new HashSet<string>();

        foreach (var clase in SubAssetClasses)
        {
            IReadOnlyList<DoctaInstrumentoDto> instrumentos;
            try
            {
                instrumentos = await _docta.ObtenerInstrumentosAsync(clase, ct);
            }
            catch (Exception ex)
            {
                _log.LogError(ex, "Docta: error al obtener instrumentos ({Clase}).", clase);
                continue;
            }

            foreach (var inst in instrumentos)
            {
                if (!precios.TryGetValue(inst.Ticker, out var precio))
                {
                    _log.LogDebug("Bono {Ticker}: sin precio en ArgentinaDatos, se omite.", inst.Ticker);
                    continue;
                }

                try
                {
                    var yield = await _docta.ObtenerYieldAsync(inst.Ticker, ct);
                    if (yield is null) continue;

                    var flujosDtos = await _docta.ObtenerFlujosCajaAsync(inst.Ticker, ct);
                    if (flujosDtos.Count == 0) continue;

                    var flujos = flujosDtos
                        .Select((f, i) =>
                        {
                            DateOnly.TryParse(f.PaymentDate, out var fechaPago);
                            bool esCer = clase == "CER";
                            return new FlujoBono
                            {
                                NumeroCupon    = (short)(i + 1),
                                FechaPago      = fechaPago,
                                MontoCupon     = esCer ? f.AdjInterestAmount : f.CashFlow,
                                MontoCapital   = esCer ? f.AdjCapital        : 0m,
                                AmortizaCapital = esCer && f.AdjCapital > 0
                            };
                        })
                        .Where(f => f.FechaPago != DateOnly.MinValue)
                        .ToList();

                    var vencimiento = flujos.Count > 0 ? flujos.Max(f => f.FechaPago) : hoy;

                    await _repo.UpsertAsync(new BonoUpsertData
                    {
                        Ticker               = inst.Ticker,
                        Nombre               = inst.Ticker,
                        TipoBonoCodigo       = clase == "CER" ? "INDEXADO_INFLACION" : "TASA_FIJA",
                        TasaDescuento        = yield.Tir,
                        FechaEmision         = new DateOnly(2000, 1, 1),
                        FechaVencimiento     = vencimiento,
                        FrecuenciaCuponMeses = DeriveFrecuencia(flujos),
                        PrecioActual         = precio,
                        Flujos               = flujos
                    }, ct);
                    tickersVigentes.Add(inst.Ticker);
                }
                catch (Exception ex)
                {
                    _log.LogWarning(ex, "Docta: error al procesar {Ticker}.", inst.Ticker);
                }
            }
        }

        await _repo.DesactivarNoListadosAsync(tickersVigentes, ct);
        _log.LogInformation("BonoCatalogo: flujos de caja actualizados ({Count} bonos vigentes).", tickersVigentes.Count);
    }

    public Task<IReadOnlyList<BonoResponse>> ObtenerActivosAsync(CancellationToken ct = default) =>
        _repo.ObtenerActivosAsync(ct);

    public Task<BonoResponse?> ObtenerPorIdAsync(long id, CancellationToken ct = default) =>
        _repo.ObtenerPorIdAsync(id, ct);

    private static short DeriveFrecuencia(List<FlujoBono> flujos)
    {
        if (flujos.Count < 2) return 6;
        var diff = (flujos[1].FechaPago.ToDateTime(TimeOnly.MinValue)
                  - flujos[0].FechaPago.ToDateTime(TimeOnly.MinValue)).Days;
        return diff switch
        {
            < 45  => 1,
            < 75  => 2,
            < 120 => 3,
            < 210 => 6,
            _     => 12
        };
    }
}
