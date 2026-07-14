using SimuladorFinanciero.Api.Infrastructure.Exceptions;
using SimuladorFinanciero.Api.Infrastructure.ExternalApis.Bcra;
using SimuladorFinanciero.Api.Repositories;

namespace SimuladorFinanciero.Api.Services.Catalogo;

public interface ITipoCambioService
{
    /// <summary>Cotización USD → ARS vigente (cacheada por día en `tipo_cambio`, con fallback al último valor conocido si el BCRA no responde).</summary>
    Task<decimal> ObtenerCotizacionUsdArsAsync(CancellationToken ct = default);

    /// <summary>Fuerza una consulta live al BCRA (ignora la cotización del día ya cacheada) y persiste el resultado.</summary>
    Task<decimal> RefrescarAsync(CancellationToken ct = default);
}

public sealed class TipoCambioService : ITipoCambioService
{
    private readonly IBcraApiClient        _bcra;
    private readonly ITipoCambioRepository _tipoCambioRepo;
    private readonly IReferenciaRepository _referenciaRepo;

    public TipoCambioService(IBcraApiClient bcra, ITipoCambioRepository tipoCambioRepo, IReferenciaRepository referenciaRepo)
    {
        _bcra           = bcra;
        _tipoCambioRepo = tipoCambioRepo;
        _referenciaRepo = referenciaRepo;
    }

    public async Task<decimal> ObtenerCotizacionUsdArsAsync(CancellationToken ct = default)
    {
        var (idUsd, idArs) = await ResolverIdsAsync(ct);
        var hoy = DateOnly.FromDateTime(DateTime.UtcNow);

        var cotizacionHoy = await _tipoCambioRepo.ObtenerCotizacionDelDiaAsync(idUsd, idArs, hoy, ct);
        if (cotizacionHoy.HasValue) return cotizacionHoy.Value;

        try
        {
            var valor = await _bcra.ObtenerCotizacionUsdAsync(ct);
            await _tipoCambioRepo.GuardarCotizacionAsync(idUsd, idArs, hoy, valor, ct);
            return valor;
        }
        catch (ExternalApiException)
        {
            var ultima = await _tipoCambioRepo.ObtenerUltimaCotizacionAsync(idUsd, idArs, ct);
            if (ultima.HasValue) return ultima.Value;
            throw new ExternalApiException("No se pudo obtener la cotización USD/ARS del BCRA y no hay un valor previo disponible.");
        }
    }

    public async Task<decimal> RefrescarAsync(CancellationToken ct = default)
    {
        var (idUsd, idArs) = await ResolverIdsAsync(ct);
        var valor = await _bcra.ObtenerCotizacionUsdAsync(ct);
        await _tipoCambioRepo.GuardarCotizacionAsync(idUsd, idArs, DateOnly.FromDateTime(DateTime.UtcNow), valor, ct);
        return valor;
    }

    private async Task<(int IdUsd, int IdArs)> ResolverIdsAsync(CancellationToken ct)
    {
        var monedas = await _referenciaRepo.ObtenerMonedasAsync(ct);
        var idUsd = monedas.FirstOrDefault(m => m.CodigoIso == "USD")?.IdMoneda
            ?? throw new ExternalApiException("Moneda USD no está configurada.");
        var idArs = monedas.FirstOrDefault(m => m.CodigoIso == "ARS")?.IdMoneda
            ?? throw new ExternalApiException("Moneda ARS no está configurada.");
        return (idUsd, idArs);
    }
}
