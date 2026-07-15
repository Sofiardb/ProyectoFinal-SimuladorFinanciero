using System.Text.Json;
using System.Text.Json.Serialization;

namespace SimuladorFinanciero.Api.Infrastructure.ExternalApis.ArgentinaDatos;

// ── DTOs ─────────────────────────────────────────────────────────────────────

internal sealed class ArgentinaDatosLetraDto
{
    [JsonPropertyName("ticker")] public string   Ticker { get; set; } = "";
    [JsonPropertyName("vpv")]    public decimal?  Vpv    { get; set; }
}

internal sealed class ArgentinaDatosBonosCerResponseDto
{
    [JsonPropertyName("bonos")] public List<ArgentinaDatosBonoCerDto> Bonos { get; set; } = [];
}

internal sealed class ArgentinaDatosBonoCerDto
{
    [JsonPropertyName("ticker")]    public string   Ticker    { get; set; } = "";
    [JsonPropertyName("precioArs")] public decimal? PrecioArs { get; set; }
}

// ── Interfaz pública ─────────────────────────────────────────────────────────

/// <summary>
/// Cliente para ArgentinaDatos (argentinadatos.com) — API pública no oficial que agrega
/// datos de mercado argentino. Se usa como fuente de precios para LECAP/BONTE y BONCER,
/// instrumentos del Tesoro que BYMA Open Data no cotiza en sus endpoints gratuitos.
/// </summary>
public interface IArgentinaDatosApiClient
{
    /// <summary>Precios (ticker → vpv, valor por VN 100) de LECAP y BONTE (tasa fija).</summary>
    Task<IReadOnlyDictionary<string, decimal>> ObtenerPreciosLetrasBonteAsync(CancellationToken ct = default);

    /// <summary>Precios (ticker → precioArs, valor por VN 100) de BONCER (ajustados por CER).</summary>
    Task<IReadOnlyDictionary<string, decimal>> ObtenerPreciosBonosCerAsync(CancellationToken ct = default);
}

// ── Implementación ────────────────────────────────────────────────────────────

public sealed class ArgentinaDatosApiClient : IArgentinaDatosApiClient, IDisposable
{
    private const string LetrasUrl   = "https://api.argentinadatos.com/v1/finanzas/letras";
    private const string BonosCerUrl = "https://api.argentinadatos.com/v1/finanzas/bonos-cer";

    private static readonly JsonSerializerOptions JsonOpts =
        new() { PropertyNameCaseInsensitive = true };

    private readonly HttpClient _http;
    private readonly ILogger<ArgentinaDatosApiClient> _log;

    public ArgentinaDatosApiClient(ILogger<ArgentinaDatosApiClient> log)
    {
        _log  = log;
        _http = new HttpClient { Timeout = TimeSpan.FromSeconds(30) };
    }

    public async Task<IReadOnlyDictionary<string, decimal>> ObtenerPreciosLetrasBonteAsync(CancellationToken ct = default)
    {
        try
        {
            var response = await _http.GetAsync(LetrasUrl, ct);
            response.EnsureSuccessStatusCode();

            var json = await response.Content.ReadAsStringAsync(ct);
            var data = JsonSerializer.Deserialize<List<ArgentinaDatosLetraDto>>(json, JsonOpts) ?? [];

            return data
                .Where(d => d.Vpv is > 0)
                .GroupBy(d => d.Ticker)
                .ToDictionary(g => g.Key, g => g.First().Vpv!.Value);
        }
        catch (Exception ex)
        {
            _log.LogWarning(ex, "ArgentinaDatos: error al obtener precios de letras/BONTE.");
            return new Dictionary<string, decimal>();
        }
    }

    public async Task<IReadOnlyDictionary<string, decimal>> ObtenerPreciosBonosCerAsync(CancellationToken ct = default)
    {
        try
        {
            var response = await _http.GetAsync(BonosCerUrl, ct);
            response.EnsureSuccessStatusCode();

            var json   = await response.Content.ReadAsStringAsync(ct);
            var result = JsonSerializer.Deserialize<ArgentinaDatosBonosCerResponseDto>(json, JsonOpts);

            return result?.Bonos
                .Where(b => b.PrecioArs is > 0)
                .GroupBy(b => b.Ticker)
                .ToDictionary(g => g.Key, g => g.First().PrecioArs!.Value)
                ?? new Dictionary<string, decimal>();
        }
        catch (Exception ex)
        {
            _log.LogWarning(ex, "ArgentinaDatos: error al obtener precios de bonos CER.");
            return new Dictionary<string, decimal>();
        }
    }

    public void Dispose() => _http.Dispose();
}
