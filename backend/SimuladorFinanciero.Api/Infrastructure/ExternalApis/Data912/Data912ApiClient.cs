using System.Text.Json;
using System.Text.Json.Serialization;

namespace SimuladorFinanciero.Api.Infrastructure.ExternalApis.Data912;

// ── DTOs ─────────────────────────────────────────────────────────────────────

internal sealed class Data912InstrumentoDto
{
    [JsonPropertyName("symbol")] public string   Symbol { get; set; } = "";
    [JsonPropertyName("c")]      public decimal? Close  { get; set; }
}

// ── Interfaz pública ─────────────────────────────────────────────────────────

/// <summary>
/// Cliente para data912.com — API pública no oficial que agrega datos de mercado argentino.
/// Se usa como fuente de precios de bonos y letras del Tesoro, instrumentos que BYMA Open Data
/// no cotiza en sus endpoints gratuitos. data912 separa "Gov Bonds" (/live/arg_bonds) de
/// "Gov Notes" (/live/arg_notes) en dos endpoints distintos, así que no hace falta excluir
/// letras del resultado de bonos ni viceversa.
/// </summary>
public interface IData912ApiClient
{
    /// <summary>Precios (ticker → c, precio de cierre por VN 100) de bonos del Tesoro.</summary>
    Task<IReadOnlyDictionary<string, decimal>> ObtenerPreciosBonosAsync(CancellationToken ct = default);

    /// <summary>Precios (ticker → c, precio de cierre por VN 100) de LECAP/LECER.</summary>
    Task<IReadOnlyDictionary<string, decimal>> ObtenerPreciosLetrasAsync(CancellationToken ct = default);
}

// ── Implementación ────────────────────────────────────────────────────────────

public sealed class Data912ApiClient : IData912ApiClient, IDisposable
{
    private const string BonosUrl  = "https://data912.com/live/arg_bonds";
    private const string LetrasUrl = "https://data912.com/live/arg_notes";

    private static readonly JsonSerializerOptions JsonOpts =
        new() { PropertyNameCaseInsensitive = true };

    private readonly HttpClient _http;
    private readonly ILogger<Data912ApiClient> _log;

    public Data912ApiClient(ILogger<Data912ApiClient> log)
    {
        _log  = log;
        _http = new HttpClient { Timeout = TimeSpan.FromSeconds(30) };
    }

    public Task<IReadOnlyDictionary<string, decimal>> ObtenerPreciosBonosAsync(CancellationToken ct = default) =>
        ObtenerPreciosAsync(BonosUrl, "bonos", ct);

    public Task<IReadOnlyDictionary<string, decimal>> ObtenerPreciosLetrasAsync(CancellationToken ct = default) =>
        ObtenerPreciosAsync(LetrasUrl, "letras", ct);

    private async Task<IReadOnlyDictionary<string, decimal>> ObtenerPreciosAsync(
        string url, string descripcion, CancellationToken ct)
    {
        try
        {
            var response = await _http.GetAsync(url, ct);
            response.EnsureSuccessStatusCode();

            var json = await response.Content.ReadAsStringAsync(ct);
            var data = JsonSerializer.Deserialize<List<Data912InstrumentoDto>>(json, JsonOpts) ?? [];

            return data
                .Where(d => d.Close is > 0)
                .GroupBy(d => d.Symbol)
                .ToDictionary(g => g.Key, g => g.First().Close!.Value);
        }
        catch (Exception ex)
        {
            _log.LogWarning(ex, "Data912: error al obtener precios de {Descripcion}.", descripcion);
            return new Dictionary<string, decimal>();
        }
    }

    public void Dispose() => _http.Dispose();
}
