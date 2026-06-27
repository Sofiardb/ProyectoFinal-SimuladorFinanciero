using SimuladorFinanciero.Api.DTOs.Instrumentos;
using SimuladorFinanciero.Api.Infrastructure.ExternalApis.Byma;
using SimuladorFinanciero.Api.Infrastructure.ExternalApis.Docta;
using SimuladorFinanciero.Api.Repositories;

namespace SimuladorFinanciero.Api.Services.Catalogo;

public interface ILetraCatalogoService
{
    /// <summary>Refresca precios de BYMA y TIR de LECER desde Docta. Llamado cada 15 min.</summary>
    Task RefrescarPreciosAsync(CancellationToken ct = default);

    Task<IReadOnlyList<LetraResponse>> ObtenerActivasAsync(CancellationToken ct = default);
    Task<LetraResponse?> ObtenerPorIdAsync(long id, CancellationToken ct = default);
}

public sealed class LetraCatalogoService : ILetraCatalogoService
{
    private readonly IBymaApiClient    _byma;
    private readonly IDoctaApiClient   _docta;
    private readonly ILetraRepository  _repo;
    private readonly ILogger<LetraCatalogoService> _log;

    public LetraCatalogoService(
        IBymaApiClient byma,
        IDoctaApiClient docta,
        ILetraRepository repo,
        ILogger<LetraCatalogoService> log)
    {
        _byma  = byma;
        _docta = docta;
        _repo  = repo;
        _log   = log;
    }

    public async Task RefrescarPreciosAsync(CancellationToken ct = default)
    {
        IReadOnlyList<BymaLetraDto> letras;
        try
        {
            letras = await _byma.ObtenerLetrasAsync(ct);
        }
        catch (Exception ex)
        {
            _log.LogError(ex, "BYMA: error al obtener letras.");
            return;
        }

        if (letras.Count == 0)
        {
            _log.LogInformation("BYMA: respuesta vacía (mercado cerrado o sin datos).");
            return;
        }

        var hoy = DateOnly.FromDateTime(DateTime.Today);

        foreach (var l in letras)
        {
            if (!DateOnly.TryParse(l.MaturityDate, out var vencimiento)) continue;

            if (l.Symbol.StartsWith('S'))
            {
                // LECAP: TNA derivada del precio de descuento
                var tna = (100m / l.SettlementPrice - 1m) * (365m / l.DaysToMaturity);
                await _repo.UpsertAsync(new LetraUpsertData
                {
                    Ticker            = l.Symbol,
                    Nombre            = $"LECAP {l.Symbol} - Vence {vencimiento:dd/MM/yyyy}",
                    TipoLetraCodigo   = "LECAP",
                    Tasa              = tna,
                    FechaEmision      = hoy,
                    FechaVencimiento  = vencimiento,
                    PrecioActual      = l.SettlementPrice
                }, ct);
            }
            else if (l.Symbol.StartsWith('X'))
            {
                // LECER: TIR real desde Docta Capital
                DoctaYieldDto? yield = null;
                try
                {
                    yield = await _docta.ObtenerYieldAsync(l.Symbol, ct);
                }
                catch (Exception ex)
                {
                    _log.LogWarning(ex, "Docta: error al obtener yield para LECER {Ticker}.", l.Symbol);
                }

                if (yield is null)
                {
                    _log.LogDebug("LECER {Ticker}: sin yield en Docta, se omite.", l.Symbol);
                    continue;
                }

                await _repo.UpsertAsync(new LetraUpsertData
                {
                    Ticker            = l.Symbol,
                    Nombre            = $"LECER {l.Symbol} - Vence {vencimiento:dd/MM/yyyy}",
                    TipoLetraCodigo   = "LECER",
                    Tasa              = yield.Tir,
                    FechaEmision      = hoy,
                    FechaVencimiento  = vencimiento,
                    PrecioActual      = l.SettlementPrice
                }, ct);
            }
        }

        _log.LogInformation("LetraCatalogo: {Count} letras procesadas desde BYMA.", letras.Count);
    }

    public Task<IReadOnlyList<LetraResponse>> ObtenerActivasAsync(CancellationToken ct = default) =>
        _repo.ObtenerActivasAsync(ct);

    public Task<LetraResponse?> ObtenerPorIdAsync(long id, CancellationToken ct = default) =>
        _repo.ObtenerPorIdAsync(id, ct);
}
