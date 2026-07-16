using System.Text;
using System.Text.Json;
using SimuladorFinanciero.Api.Infrastructure.Exceptions;

namespace SimuladorFinanciero.Api.Services;

public interface IMotorClientService
{
    Task<JsonElement> SimularAsync(object payload, CancellationToken ct = default);
}

public sealed class MotorClientService : IMotorClientService
{
    private static readonly JsonSerializerOptions _opts = new();

    private readonly HttpClient _http;

    public MotorClientService(IHttpClientFactory factory)
        => _http = factory.CreateClient("MotorSimulacion");

    public async Task<JsonElement> SimularAsync(object payload, CancellationToken ct = default)
    {
        var json    = JsonSerializer.Serialize(payload, _opts);
        var content = new StringContent(json, Encoding.UTF8, "application/json");

        HttpResponseMessage response;
        try
        {
            response = await _http.PostAsync("/simular", content, ct);
        }
        catch (HttpRequestException)
        {
            throw new ExternalApiException("No se pudo conectar con el motor de simulación. Verificá que esté corriendo.");
        }
        catch (TaskCanceledException) when (!ct.IsCancellationRequested)
        {
            throw new ExternalApiException("El motor de simulación no respondió a tiempo.");
        }

        if (!response.IsSuccessStatusCode)
            throw new ExternalApiException(
                $"Motor de simulación no disponible o devolvió error. Status: {(int)response.StatusCode}.");

        var stream = await response.Content.ReadAsStreamAsync(ct);
        return await JsonSerializer.DeserializeAsync<JsonElement>(stream, cancellationToken: ct);
    }
}
