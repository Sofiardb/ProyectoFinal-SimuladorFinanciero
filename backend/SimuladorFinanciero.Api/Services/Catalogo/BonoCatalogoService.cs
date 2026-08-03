using SimuladorFinanciero.Api.DTOs.Instrumentos;
using SimuladorFinanciero.Api.Infrastructure.ExternalApis.ArgentinaDatos;
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
    /// <summary>
    /// No se consulta la clase genérica "SUB_SOBERANO" (sin sufijo): agrupaba subsoberanos con
    /// TIRes sanas en la práctica, pero es una clase legacy de Docta cuyo tipo de tasa real no
    /// podemos confirmar por ningún campo — asumir que es TASA_FIJA fue una inferencia, no un
    /// dato. Si alguno de esos tickers en realidad ajusta por CER, quedaría mal clasificado y
    /// el motor lo simularía sin indexar por inflación. Solo se consultan clases donde el tipo
    /// viene explícito en el propio nombre de la clase.
    /// </summary>
    private static readonly string[] SubAssetClasses =
        ["FIXED_RATE", "CER", "SUB_SOBERANO_FIXED_RATE", "SUB_SOBERANO_CER"];

    private readonly IArgentinaDatosApiClient _argentinaDatos;
    private readonly IBymaApiClient           _byma;
    private readonly IDoctaApiClient          _docta;
    private readonly IBonoRepository          _repo;
    private readonly ILogger<BonoCatalogoService> _log;

    public BonoCatalogoService(
        IArgentinaDatosApiClient argentinaDatos,
        IBymaApiClient           byma,
        IDoctaApiClient          docta,
        IBonoRepository          repo,
        ILogger<BonoCatalogoService> log)
    {
        _argentinaDatos = argentinaDatos;
        _byma           = byma;
        _docta          = docta;
        _repo           = repo;
        _log            = log;
    }

    /// <summary>
    /// Docta es la fuente de verdad de qué bonos existen (catálogo + TIR + flujos); BYMA Open Data
    /// no cotiza LECAP/BONTE/BONCER en sus endpoints gratuitos, así que el precio (por VN100) de
    /// bonos nacionales se toma de ArgentinaDatos. Los bonos SUB_SOBERANO* (deuda provincial y
    /// municipal) tampoco los cotiza ArgentinaDatos, pero sí aparecen en el endpoint /public-bonds
    /// de BYMA. Un bono solo queda activo si está en AMBAS fuentes — si Docta lo deja de listar,
    /// o la fuente de precio correspondiente no tiene precio para él, se desactiva.
    /// </summary>
    private async Task<IReadOnlyDictionary<string, decimal>> ObtenerPreciosAsync(CancellationToken ct)
    {
        var letrasBonteTask   = _argentinaDatos.ObtenerPreciosLetrasBonteAsync(ct);
        var bonosCerTask      = _argentinaDatos.ObtenerPreciosBonosCerAsync(ct);
        var subSoberanoTask   = _byma.ObtenerPreciosBonosPublicosAsync(ct);
        await Task.WhenAll(letrasBonteTask, bonosCerTask, subSoberanoTask);

        var precios = new Dictionary<string, decimal>(letrasBonteTask.Result);
        foreach (var (ticker, precio) in bonosCerTask.Result)
            precios[ticker] = precio;
        foreach (var (ticker, precio) in subSoberanoTask.Result)
            precios[ticker] = precio;

        _log.LogInformation("ArgentinaDatos+BYMA: {Count} precios de bonos obtenidos.", precios.Count);
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
                    _log.LogDebug("Bono {Ticker}: sin precio en ArgentinaDatos/BYMA, se omite.", inst.Ticker);
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
                    _log.LogDebug("Bono {Ticker}: sin precio en ArgentinaDatos/BYMA, se omite.", inst.Ticker);
                    continue;
                }

                try
                {
                    var yield = await _docta.ObtenerYieldAsync(inst.Ticker, ct);
                    if (yield is null) continue;

                    var flujosDtos = await _docta.ObtenerFlujosCajaAsync(inst.Ticker, ct);
                    if (flujosDtos.Count == 0) continue;

                    bool esCer = EsCer(clase);

                    // adj_capital/adj_interest_amount vienen desglosados para cualquier tipo de bono,
                    // no solo CER — verificado con TO26 (tasa fija, 20 cupones): adj_capital da 0 en
                    // los primeros 19 y 100 exacto en el último, sumando igual que cash_flow. Usar
                    // cash_flow entero como "cupón" en tasa fija escondía la amortización de capital
                    // dentro del cupón, mostrando monto_capital = 0 incluso en el pago de vencimiento.
                    var flujos = flujosDtos
                        .Select((f, i) =>
                        {
                            DateOnly.TryParse(f.PaymentDate, out var fechaPago);
                            return new FlujoBono
                            {
                                NumeroCupon     = (short)(i + 1),
                                FechaPago       = fechaPago,
                                MontoCupon      = f.AdjInterestAmount,
                                MontoCapital    = f.AdjCapital,
                                AmortizaCapital = f.AdjCapital > 0
                            };
                        })
                        .Where(f => f.FechaPago != DateOnly.MinValue)
                        .ToList();

                    var vencimiento = flujos.Count > 0 ? flujos.Max(f => f.FechaPago) : hoy;

                    await _repo.UpsertAsync(new BonoUpsertData
                    {
                        Ticker               = inst.Ticker,
                        Nombre               = inst.Ticker,
                        TipoBonoCodigo       = esCer ? "INDEXADO_INFLACION" : "TASA_FIJA",
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

    /// <summary>
    /// CER se determina únicamente por la clase de Docta con la que se consultó el instrumento
    /// (sub_asset_class ya viene filtrado desde la API) — nunca por heurística de ticker.
    /// </summary>
    private static bool EsCer(string claseDocta) =>
        claseDocta is "CER" or "SUB_SOBERANO_CER";

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
