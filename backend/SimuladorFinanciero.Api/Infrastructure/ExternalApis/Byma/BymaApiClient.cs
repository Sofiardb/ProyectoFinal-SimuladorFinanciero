using System.Net;
using System.Text;
using System.Text.Json;
using System.Text.Json.Serialization;

namespace SimuladorFinanciero.Api.Infrastructure.ExternalApis.Byma;

// ── DTOs ─────────────────────────────────────────────────────────────────────

public sealed class BymaLetraDto
{
    [JsonPropertyName("symbol")]          public string  Symbol          { get; set; } = "";
    [JsonPropertyName("settlementPrice")] public decimal SettlementPrice { get; set; }
    [JsonPropertyName("maturityDate")]    public string  MaturityDate    { get; set; } = "";
    [JsonPropertyName("daysToMaturity")]  public int     DaysToMaturity  { get; set; }
    [JsonPropertyName("denominationCcy")] public string  DenominationCcy { get; set; } = "";
}

internal sealed class BymaResponseDto
{
    [JsonPropertyName("data")]
    public List<BymaLetraDto> Data { get; set; } = [];
}

// ── Interfaz pública ─────────────────────────────────────────────────────────

public interface IBymaApiClient
{
    Task<IReadOnlyList<BymaLetraDto>> ObtenerLetrasAsync(CancellationToken ct = default);

    /// <summary>
    /// Devuelve un diccionario ticker → settlementPrice para todos los bonos con precio en BYMA.
    /// Se usa como fuente de precio de cotización; Docta provee TIR y flujos.
    /// </summary>
    Task<IReadOnlyDictionary<string, decimal>> ObtenerPreciosBonosAsync(CancellationToken ct = default);
}

// ── Implementación ────────────────────────────────────────────────────────────

public sealed class BymaApiClient : IBymaApiClient, IDisposable
{
    private const string HomeUrl   = "https://open.bymadata.com.ar";
    private const string LetrasUrl = "https://open.bymadata.com.ar/vanoms-be-core/rest/api/bymadata/free/lebacs";
    private const string BonosUrl  = "https://open.bymadata.com.ar/vanoms-be-core/rest/api/bymadata/free/public-bonds";

    private static readonly string BodyJson = JsonSerializer.Serialize(new
    {
        excludeZeroPxAndQty = false,
        T2 = false,
        T1 = true,
        T0 = false
    });

    private static readonly JsonSerializerOptions JsonOpts =
        new() { PropertyNameCaseInsensitive = true };

    private readonly HttpClient _http;
    private readonly ILogger<BymaApiClient> _log;
    private bool _sessionOk;

    public BymaApiClient(ILogger<BymaApiClient> log)
    {
        _log = log;
        // Cookie persistente: necesario para que la sesión de BYMA funcione entre llamadas
        var handler = new HttpClientHandler
        {
            CookieContainer = new CookieContainer(),
            UseCookies      = true,
            AllowAutoRedirect = true
        };
        _http = new HttpClient(handler) { Timeout = TimeSpan.FromSeconds(30) };
        _http.DefaultRequestHeaders.Add("User-Agent",
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36");
    }

    public async Task<IReadOnlyList<BymaLetraDto>> ObtenerLetrasAsync(CancellationToken ct = default)
    {
        await AsegurarSesionAsync(ct);

        var content  = new StringContent(BodyJson, Encoding.UTF8, "application/json");
        var response = await _http.PostAsync(LetrasUrl, content, ct);
        response.EnsureSuccessStatusCode();

        var json   = await response.Content.ReadAsStringAsync(ct);
        var result = JsonSerializer.Deserialize<BymaResponseDto>(json, JsonOpts);

        return result?.Data
            .Where(l => l.DenominationCcy == "ARS"
                     && l.SettlementPrice > 0
                     && l.DaysToMaturity  > 0
                     && (l.Symbol.StartsWith('S') || l.Symbol.StartsWith('X')))
            .ToList() ?? [];
    }

    public async Task<IReadOnlyDictionary<string, decimal>> ObtenerPreciosBonosAsync(CancellationToken ct = default)
    {
        await AsegurarSesionAsync(ct);

        var content  = new StringContent(BodyJson, Encoding.UTF8, "application/json");
        var response = await _http.PostAsync(BonosUrl, content, ct);
        response.EnsureSuccessStatusCode();

        var json   = await response.Content.ReadAsStringAsync(ct);
        var result = JsonSerializer.Deserialize<BymaResponseDto>(json, JsonOpts);

        return result?.Data
            .Where(b => b.SettlementPrice > 0)
            .GroupBy(b => b.Symbol)
            .ToDictionary(g => g.Key, g => g.First().SettlementPrice)
            ?? new Dictionary<string, decimal>();
    }

    private async Task AsegurarSesionAsync(CancellationToken ct)
    {
        if (_sessionOk) return;
        try
        {
            await _http.GetAsync(HomeUrl, ct);
            _sessionOk = true;
        }
        catch (Exception ex)
        {
            _log.LogWarning(ex, "BYMA: no se pudo establecer sesión en {Url}.", HomeUrl);
        }
    }

    public void Dispose() => _http.Dispose();
}
