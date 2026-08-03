using System.Collections.Concurrent;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text.Json;
using System.Text.Json.Serialization;

namespace SimuladorFinanciero.Api.Infrastructure.ExternalApis.Docta;

/// <summary>
/// Estadísticas de uso de la API de Docta para diagnosticar el límite de 120 rpm del plan.
/// <see cref="RequestsUltimoMinuto"/> es una ventana deslizante calculada al momento de la consulta,
/// no un valor cacheado; <see cref="Total429"/> es acumulado desde que arrancó el proceso.
/// </summary>
public sealed record DoctaRateLimitStats(
    int RequestsUltimoMinuto,
    int Total429,
    DateTime? Ultimo429Utc,
    string? UltimoDetalle429);

// ── DTOs internos ─────────────────────────────────────────────────────────────

internal sealed class DoctaTokenDto
{
    [JsonPropertyName("access_token")] public string AccessToken { get; set; } = "";
    [JsonPropertyName("expires_in")]   public int    ExpiresIn   { get; set; }
}

internal sealed class DoctaInstrumentosResponseDto
{
    [JsonPropertyName("data")] public List<DoctaInstrumentoDto> Data { get; set; } = [];
}

public sealed class DoctaInstrumentoDto
{
    [JsonPropertyName("ticker")]          public string Ticker        { get; set; } = "";
    [JsonPropertyName("sub_asset_class")] public string SubAssetClass { get; set; } = "";
}

internal sealed class DoctaYieldResponseDto
{
    [JsonPropertyName("data")]     public List<DoctaYieldDto>     Data     { get; set; } = [];
    [JsonPropertyName("metadata")] public DoctaYieldMetadataDto?  Metadata { get; set; }
}

public sealed class DoctaYieldDto
{
    [JsonPropertyName("tir")]    public decimal  Tir    { get; set; }
    [JsonPropertyName("tna")]    public decimal  Tna    { get; set; }
    [JsonPropertyName("dtm")]    public int      Dtm    { get; set; }
    [JsonPropertyName("margen")] public decimal? Margen { get; set; }
}

internal sealed class DoctaYieldMetadataDto
{
    [JsonPropertyName("sub_asset_class")] public string SubAssetClass { get; set; } = "";
}

internal sealed class DoctaFlujoCajaResponseDto
{
    [JsonPropertyName("data")] public List<DoctaFlujoCajaDto> Data { get; set; } = [];
}

public sealed class DoctaFlujoCajaDto
{
    [JsonPropertyName("payment_date")]        public string  PaymentDate      { get; set; } = "";
    [JsonPropertyName("cash_flow")]           public decimal CashFlow         { get; set; }
    [JsonPropertyName("adj_capital")]         public decimal AdjCapital       { get; set; }
    [JsonPropertyName("adj_interest_amount")] public decimal AdjInterestAmount { get; set; }
}

// ── Interfaz pública ─────────────────────────────────────────────────────────

public interface IDoctaApiClient
{
    Task<IReadOnlyList<DoctaInstrumentoDto>> ObtenerInstrumentosAsync(string subAssetClass, CancellationToken ct = default);
    Task<DoctaYieldDto?>                     ObtenerYieldAsync(string ticker, CancellationToken ct = default);
    Task<IReadOnlyList<DoctaFlujoCajaDto>>   ObtenerFlujosCajaAsync(string ticker, CancellationToken ct = default);

    /// <summary>
    /// Verifica credenciales obteniendo un token y haciendo una llamada mínima al catálogo.
    /// Útil para diagnosticar conectividad sin consumir requests del plan.
    /// </summary>
    Task<(bool Ok, string Detalle)> VerificarConexionAsync(CancellationToken ct = default);

    /// <summary>Estadísticas de rpm del proceso actual — ver <see cref="DoctaRateLimitStats"/>.</summary>
    DoctaRateLimitStats ObtenerEstadisticasRateLimit();
}

// ── Implementación ────────────────────────────────────────────────────────────

public sealed class DoctaApiClient : IDoctaApiClient, IDisposable
{
    private readonly HttpClient _http;
    private readonly ILogger<DoctaApiClient> _log;
    private readonly string _clientId;
    private readonly string _clientSecret;

    private string?  _token;
    private DateTime _tokenExpiry = DateTime.MinValue;

    // Diagnóstico de rpm (ver DoctaRateLimitStats) — no protege nada, solo lo miden los admins.
    private readonly ConcurrentQueue<DateTime> _timestampsRequests = new();
    private int      _total429;
    private DateTime? _ultimo429Utc;
    private string?  _ultimoDetalle429;

    public DoctaApiClient(IConfiguration config, ILogger<DoctaApiClient> log)
    {
        _log          = log;
        _clientId     = config["DoctaCapital:ClientId"]     ?? throw new InvalidOperationException("DoctaCapital:ClientId no configurado.");
        _clientSecret = config["DoctaCapital:ClientSecret"] ?? throw new InvalidOperationException("DoctaCapital:ClientSecret no configurado.");

        var baseUrl = config["DoctaCapital:BaseUrl"] ?? "https://api.doctacapital.com.ar";
        _http = new HttpClient { BaseAddress = new Uri(baseUrl), Timeout = TimeSpan.FromSeconds(30) };
    }

    public async Task<IReadOnlyList<DoctaInstrumentoDto>> ObtenerInstrumentosAsync(
        string subAssetClass, CancellationToken ct = default)
    {
        await AsegurarTokenAsync(ct);
        var url      = $"/api/v1/bonds/instruments?sub_asset_class={subAssetClass}&limit=100";
        var response = await _http.GetAsync(url, ct);
        RegistrarRequest(response);
        response.EnsureSuccessStatusCode();
        var result   = await response.Content.ReadFromJsonAsync<DoctaInstrumentosResponseDto>(cancellationToken: ct);
        return result?.Data ?? [];
    }

    public async Task<DoctaYieldDto?> ObtenerYieldAsync(string ticker, CancellationToken ct = default)
    {
        await AsegurarTokenAsync(ct);
        var response = await _http.GetAsync($"/api/v1/bonds/yields/{ticker}/intraday", ct);
        RegistrarRequest(response, ticker);
        if (!response.IsSuccessStatusCode)
        {
            _log.LogDebug("Docta: no hay yield para {Ticker} ({Status}).", ticker, response.StatusCode);
            return null;
        }
        var result = await response.Content.ReadFromJsonAsync<DoctaYieldResponseDto>(cancellationToken: ct);
        return result?.Data.FirstOrDefault();
    }

    public async Task<IReadOnlyList<DoctaFlujoCajaDto>> ObtenerFlujosCajaAsync(
        string ticker, CancellationToken ct = default)
    {
        await AsegurarTokenAsync(ct);
        var response = await _http.GetAsync(
            $"/api/v1/bonds/analytics/{ticker}/cashflow?nominal_units=100", ct);
        RegistrarRequest(response, ticker);
        response.EnsureSuccessStatusCode();
        var result = await response.Content.ReadFromJsonAsync<DoctaFlujoCajaResponseDto>(cancellationToken: ct);
        return result?.Data ?? [];
    }

    public async Task<(bool Ok, string Detalle)> VerificarConexionAsync(CancellationToken ct = default)
    {
        try
        {
            await AsegurarTokenAsync(ct);
        }
        catch (Exception ex)
        {
            return (false, $"Error al obtener token: {ex.Message}");
        }

        try
        {
            var url      = "/api/v1/bonds/instruments?sub_asset_class=FIXED_RATE&limit=1";
            var response = await _http.GetAsync(url, ct);
            RegistrarRequest(response);
            if (!response.IsSuccessStatusCode)
                return (false, $"Token OK, pero el catálogo devolvió {(int)response.StatusCode}.");

            return (true, "Token y acceso al catálogo verificados correctamente.");
        }
        catch (Exception ex)
        {
            return (false, $"Token OK, pero error al consultar el catálogo: {ex.Message}");
        }
    }

    private async Task AsegurarTokenAsync(CancellationToken ct)
    {
        if (_token is not null && DateTime.UtcNow < _tokenExpiry) return;

        var body = JsonContent.Create(new
        {
            grant_type    = "client_credentials",
            client_id     = _clientId,
            client_secret = _clientSecret
        });

        var response = await _http.PostAsync("/api/v1/auth/token", body, ct);
        RegistrarRequest(response);
        response.EnsureSuccessStatusCode();

        var dto = await response.Content.ReadFromJsonAsync<DoctaTokenDto>(cancellationToken: ct)
            ?? throw new InvalidOperationException("Docta no devolvió token.");

        _token       = dto.AccessToken;
        _tokenExpiry = DateTime.UtcNow.AddSeconds(dto.ExpiresIn - 60);

        _http.DefaultRequestHeaders.Authorization =
            new AuthenticationHeaderValue("Bearer", _token);

        _log.LogInformation("Docta Capital: token renovado. Expira en {Seg}s.", dto.ExpiresIn);
    }

    /// <summary>Registra cada request para la ventana deslizante de rpm y cuenta los 429 aparte.</summary>
    private void RegistrarRequest(HttpResponseMessage response, string? ticker = null)
    {
        _timestampsRequests.Enqueue(DateTime.UtcNow);

        if ((int)response.StatusCode == 429)
        {
            Interlocked.Increment(ref _total429);
            _ultimo429Utc     = DateTime.UtcNow;
            _ultimoDetalle429 = ticker is null
                ? $"{response.RequestMessage?.RequestUri}"
                : $"{response.RequestMessage?.RequestUri} (ticker {ticker})";
            _log.LogWarning("Docta: 429 Too Many Requests en {Uri}.", response.RequestMessage?.RequestUri);
        }
    }

    public DoctaRateLimitStats ObtenerEstadisticasRateLimit()
    {
        var corte = DateTime.UtcNow.AddMinutes(-1);
        while (_timestampsRequests.TryPeek(out var t) && t < corte)
            _timestampsRequests.TryDequeue(out _);

        return new DoctaRateLimitStats(_timestampsRequests.Count, _total429, _ultimo429Utc, _ultimoDetalle429);
    }

    public void Dispose() => _http.Dispose();
}
