using SimuladorFinanciero.Api.DTOs.Instrumentos;
using SimuladorFinanciero.Api.Infrastructure.ExternalApis.Byma;
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

    private readonly IBymaApiClient   _byma;
    private readonly IDoctaApiClient  _docta;
    private readonly IBonoRepository  _repo;
    private readonly ILogger<BonoCatalogoService> _log;

    public BonoCatalogoService(
        IBymaApiClient  byma,
        IDoctaApiClient docta,
        IBonoRepository repo,
        ILogger<BonoCatalogoService> log)
    {
        _byma  = byma;
        _docta = docta;
        _repo  = repo;
        _log   = log;
    }

    public async Task RefrescarYieldsAsync(CancellationToken ct = default)
    {
        // Precios desde BYMA — una sola llamada para todos los bonos
        IReadOnlyDictionary<string, decimal> precios = new Dictionary<string, decimal>();
        try
        {
            precios = await _byma.ObtenerPreciosBonosAsync(ct);
            _log.LogInformation("BYMA: {Count} precios de bonos obtenidos.", precios.Count);
        }
        catch (Exception ex)
        {
            _log.LogWarning(ex, "BYMA: no se pudieron obtener precios de bonos. Se continúa sin actualizar precios.");
        }

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
                try
                {
                    var yield = await _docta.ObtenerYieldAsync(inst.Ticker, ct);
                    if (yield is null) continue;

                    await _repo.ActualizarYieldAsync(inst.Ticker, yield.Tir, ct);

                    if (precios.TryGetValue(inst.Ticker, out var precio))
                        await _repo.ActualizarPrecioAsync(inst.Ticker, precio, ct);
                }
                catch (Exception ex)
                {
                    _log.LogWarning(ex, "Error al actualizar yield/precio para {Ticker}.", inst.Ticker);
                }
            }
        }
        _log.LogInformation("BonoCatalogo: yields y precios actualizados.");
    }

    public async Task RefrescarFlujosCajaAsync(CancellationToken ct = default)
    {
        var hoy = DateOnly.FromDateTime(DateTime.Today);

        // Precios desde BYMA — una sola llamada para todos los bonos
        IReadOnlyDictionary<string, decimal> precios = new Dictionary<string, decimal>();
        try
        {
            precios = await _byma.ObtenerPreciosBonosAsync(ct);
        }
        catch (Exception ex)
        {
            _log.LogWarning(ex, "BYMA: no se pudieron obtener precios de bonos al refrescar flujos.");
        }

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

                    precios.TryGetValue(inst.Ticker, out var precio);

                    await _repo.UpsertAsync(new BonoUpsertData
                    {
                        Ticker               = inst.Ticker,
                        Nombre               = inst.Ticker,
                        TipoBonoCodigo       = clase == "CER" ? "INDEXADO_INFLACION" : "TASA_FIJA",
                        TasaDescuento        = yield.Tir,
                        FechaEmision         = new DateOnly(2000, 1, 1),
                        FechaVencimiento     = vencimiento,
                        FrecuenciaCuponMeses = DeriveFrecuencia(flujos),
                        PrecioActual         = precio > 0 ? precio : null,
                        Flujos               = flujos
                    }, ct);
                }
                catch (Exception ex)
                {
                    _log.LogWarning(ex, "Docta: error al procesar {Ticker}.", inst.Ticker);
                }
            }
        }
        _log.LogInformation("BonoCatalogo: flujos de caja actualizados.");
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
