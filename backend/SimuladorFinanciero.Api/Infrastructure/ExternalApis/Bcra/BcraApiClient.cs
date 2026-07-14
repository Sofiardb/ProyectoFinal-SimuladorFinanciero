using System.Text.Json;
using SimuladorFinanciero.Api.Infrastructure.Exceptions;

namespace SimuladorFinanciero.Api.Infrastructure.ExternalApis.Bcra;

public interface IBcraApiClient
{
    /// <summary>Cotización USD → ARS ("tipoCotizacion") del día según la API de Estadísticas Cambiarias del BCRA.</summary>
    Task<decimal> ObtenerCotizacionUsdAsync(CancellationToken ct = default);
}

public sealed class BcraApiClient : IBcraApiClient
{
    private readonly HttpClient _http;

    public BcraApiClient(IHttpClientFactory factory)
        => _http = factory.CreateClient("Bcra");

    public async Task<decimal> ObtenerCotizacionUsdAsync(CancellationToken ct = default)
    {
        HttpResponseMessage response;
        try
        {
            response = await _http.GetAsync("Cotizaciones", ct);
        }
        catch (Exception ex) when (ex is not OperationCanceledException)
        {
            throw new ExternalApiException($"BCRA no disponible: {ex.Message}");
        }

        if (!response.IsSuccessStatusCode)
            throw new ExternalApiException($"BCRA devolvió error. Status: {(int)response.StatusCode}.");

        using var stream = await response.Content.ReadAsStreamAsync(ct);
        using var doc    = await JsonDocument.ParseAsync(stream, cancellationToken: ct);

        if (!doc.RootElement.TryGetProperty("results", out var results) ||
            !results.TryGetProperty("detalle", out var detalle))
            throw new ExternalApiException("BCRA devolvió una respuesta con formato inesperado.");

        foreach (var moneda in detalle.EnumerateArray())
        {
            if (moneda.TryGetProperty("codigoMoneda", out var codigo) && codigo.GetString() == "USD")
                return moneda.GetProperty("tipoCotizacion").GetDecimal();
        }

        throw new ExternalApiException("BCRA no incluyó una cotización para USD en la respuesta.");
    }
}
