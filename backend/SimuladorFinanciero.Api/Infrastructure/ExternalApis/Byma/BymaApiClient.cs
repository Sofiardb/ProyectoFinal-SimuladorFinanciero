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
    [JsonPropertyName("content")]
    public BymaContentDto? Content { get; set; }

    [JsonPropertyName("data")]
    public List<BymaLetraDto> Data { get; set; } = [];
}

/// <summary>Metadata de paginación que devuelve BYMA — la respuesta viene partida en páginas
/// (~189 elementos c/u en la práctica) y hay que pedirlas todas para no perder instrumentos:
/// los símbolos LECAP/LECER (prefijo S/X) aparecen distribuidos en varias páginas, no solo la primera.</summary>
internal sealed class BymaContentDto
{
    [JsonPropertyName("page_number")]          public int PageNumber         { get; set; }
    [JsonPropertyName("page_count")]           public int PageCount          { get; set; }
    [JsonPropertyName("page_size")]            public int PageSize           { get; set; }
    [JsonPropertyName("total_elements_count")] public int TotalElementsCount { get; set; }
}

// ── Interfaz pública ─────────────────────────────────────────────────────────

public interface IBymaApiClient
{
    Task<IReadOnlyList<BymaLetraDto>> ObtenerLetrasAsync(CancellationToken ct = default);

    /// <summary>Precios (ticker → settlementPrice) de bonos soberanos y subsoberanos desde
    /// /public-bonds. Se usa como fuente de precio para bonos SUB_SOBERANO* de Docta.</summary>
    Task<IReadOnlyDictionary<string, decimal>> ObtenerPreciosBonosPublicosAsync(CancellationToken ct = default);
}

// ── Implementación ────────────────────────────────────────────────────────────

public sealed class BymaApiClient : IBymaApiClient, IDisposable
{
    private const string HomeUrl          = "https://open.bymadata.com.ar";
    private const string LetrasUrl         = "https://open.bymadata.com.ar/vanoms-be-core/rest/api/bymadata/free/lebacs";
    private const string BonosPublicosUrl  = "https://open.bymadata.com.ar/vanoms-be-core/rest/api/bymadata/free/public-bonds";

    /// <summary>page_size generoso: alcanza en una sola página mientras el total de instrumentos
    /// de BYMA no supere este número (hoy ronda 312); si lo supera, se sigue paginando igual.</summary>
    private const int PageSize = 500;

    private static string BuildBody(int pageNumber) => JsonSerializer.Serialize(new
    {
        excludeZeroPxAndQty = false,
        T2 = false,
        T1 = true,
        T0 = false,
        page_number = pageNumber,
        page_size = PageSize
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
        var todas = await ObtenerPaginadoAsync(LetrasUrl, ct);

        return todas
            .Where(l => l.DenominationCcy == "ARS"
                     && l.SettlementPrice > 0
                     && l.DaysToMaturity  > 0
                     && (l.Symbol.StartsWith('S') || l.Symbol.StartsWith('X')))
            .ToList();
    }

    public async Task<IReadOnlyDictionary<string, decimal>> ObtenerPreciosBonosPublicosAsync(CancellationToken ct = default)
    {
        try
        {
            var todas = await ObtenerPaginadoAsync(BonosPublicosUrl, ct);

            return todas
                .Where(l => l.DenominationCcy == "ARS" && l.SettlementPrice > 0)
                .GroupBy(l => l.Symbol)
                .ToDictionary(g => g.Key, g => g.First().SettlementPrice);
        }
        catch (Exception ex)
        {
            _log.LogWarning(ex, "BYMA: error al obtener precios de /public-bonds.");
            return new Dictionary<string, decimal>();
        }
    }

    /// <summary>/lebacs y /public-bonds comparten el mismo esquema de paginación: hay que
    /// pedir páginas hasta agotar page_count, porque /public-bonds sí excede una sola página
    /// (~1100 instrumentos) aunque /lebacs hoy entre en una.</summary>
    private async Task<List<BymaLetraDto>> ObtenerPaginadoAsync(string url, CancellationToken ct)
    {
        await AsegurarSesionAsync(ct);

        var todas = new List<BymaLetraDto>();
        var pageNumber = 1;

        while (true)
        {
            var content  = new StringContent(BuildBody(pageNumber), Encoding.UTF8, "application/json");
            var response = await _http.PostAsync(url, content, ct);
            response.EnsureSuccessStatusCode();

            var json   = await response.Content.ReadAsStringAsync(ct);
            var result = JsonSerializer.Deserialize<BymaResponseDto>(json, JsonOpts);
            if (result is null) break;

            todas.AddRange(result.Data);

            var totalPaginas = result.Content?.PageCount ?? 1;
            if (pageNumber >= totalPaginas) break;
            pageNumber++;
        }

        return todas;
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
