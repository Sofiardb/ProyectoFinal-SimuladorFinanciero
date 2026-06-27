using System.Text.Json;

namespace SimuladorFinanciero.Api.Infrastructure.ExternalApis.AlphaVantage;

public interface IAlphaVantageApiClient
{
    /// <summary>
    /// Devuelve la serie completa de precios ajustados ordenada cronológicamente (más antiguo primero).
    /// </summary>
    Task<IReadOnlyList<(DateOnly Fecha, decimal PrecioAjustado)>> ObtenerPreciosAjustadosAsync(
        string ticker, CancellationToken ct = default);

    /// <summary>
    /// Devuelve la serie histórica del índice S&amp;P 500 (SPX) usando INDEX_DATA, ordenada cronológicamente.
    /// Se usa como benchmark para calcular ρ en los parámetros GBM de acciones.
    /// </summary>
    Task<IReadOnlyList<(DateOnly Fecha, decimal Precio)>> ObtenerPreciosSpxAsync(
        CancellationToken ct = default);
}

public sealed class AlphaVantageApiClient : IAlphaVantageApiClient, IDisposable
{
    private readonly HttpClient _http;
    private readonly string _apiKey;
    private readonly ILogger<AlphaVantageApiClient> _log;

    public AlphaVantageApiClient(IConfiguration config, ILogger<AlphaVantageApiClient> log)
    {
        _log    = log;
        _apiKey = config["AlphaVantage:ApiKey"] ?? throw new InvalidOperationException("AlphaVantage:ApiKey no configurado.");
        var baseUrl = config["AlphaVantage:BaseUrl"] ?? "https://www.alphavantage.co";
        _http   = new HttpClient { BaseAddress = new Uri(baseUrl), Timeout = TimeSpan.FromSeconds(120) };
    }

    public async Task<IReadOnlyList<(DateOnly, decimal)>> ObtenerPreciosAjustadosAsync(
        string ticker, CancellationToken ct = default)
    {
        var url = $"/query?function=TIME_SERIES_DAILY_ADJUSTED&symbol={ticker}&outputsize=full&apikey={_apiKey}";
        var response = await _http.GetAsync(url, ct);
        response.EnsureSuccessStatusCode();

        var json = await response.Content.ReadAsStringAsync(ct);
        using var doc = JsonDocument.Parse(json);

        // Alpha Vantage devuelve "Note" o "Information" dentro del JSON (status 200) cuando se excede el rate limit
        if (doc.RootElement.TryGetProperty("Note", out var note) ||
            doc.RootElement.TryGetProperty("Information", out note))
        {
            _log.LogWarning("Alpha Vantage rate limit para {Ticker}: {Note}", ticker, note.GetString());
            return [];
        }

        if (!doc.RootElement.TryGetProperty("Time Series (Daily)", out var timeSeries))
        {
            _log.LogWarning("Alpha Vantage: no hay Time Series para {Ticker}. Respuesta: {Fragment}",
                ticker, json[..Math.Min(300, json.Length)]);
            return [];
        }

        var precios = new List<(DateOnly, decimal)>(3000);
        foreach (var entry in timeSeries.EnumerateObject())
        {
            if (!DateOnly.TryParse(entry.Name, out var fecha)) continue;

            var precioStr = entry.Value.TryGetProperty("5. adjusted close", out var el)
                ? el.GetString() : null;
            if (precioStr is null || !decimal.TryParse(precioStr,
                System.Globalization.NumberStyles.Any,
                System.Globalization.CultureInfo.InvariantCulture,
                out var precio)) continue;

            precios.Add((fecha, precio));
        }

        // Ordenar cronológicamente (Alpha Vantage devuelve desc)
        precios.Sort((a, b) => a.Item1.CompareTo(b.Item1));
        return precios;
    }

    public async Task<IReadOnlyList<(DateOnly, decimal)>> ObtenerPreciosSpxAsync(CancellationToken ct = default)
    {
        var url = $"/query?function=INDEX_DATA&symbol=SPX&interval=daily&apikey={_apiKey}";
        var response = await _http.GetAsync(url, ct);
        response.EnsureSuccessStatusCode();

        var json = await response.Content.ReadAsStringAsync(ct);
        using var doc = JsonDocument.Parse(json);

        if (doc.RootElement.TryGetProperty("Note", out var note) ||
            doc.RootElement.TryGetProperty("Information", out note))
        {
            _log.LogWarning("Alpha Vantage rate limit (SPX): {Note}", note.GetString());
            return [];
        }

        if (!doc.RootElement.TryGetProperty("data", out var data))
        {
            _log.LogWarning("Alpha Vantage: no hay datos para SPX. Respuesta: {Fragment}",
                json[..Math.Min(300, json.Length)]);
            return [];
        }

        var precios = new List<(DateOnly, decimal)>(3000);
        foreach (var entry in data.EnumerateArray())
        {
            if (!entry.TryGetProperty("date", out var dateEl)) continue;
            if (!DateOnly.TryParse(dateEl.GetString(), out var fecha)) continue;

            var closeStr = entry.TryGetProperty("close", out var closeEl) ? closeEl.GetString() : null;
            if (closeStr is null || !decimal.TryParse(closeStr,
                System.Globalization.NumberStyles.Any,
                System.Globalization.CultureInfo.InvariantCulture,
                out var precio)) continue;

            precios.Add((fecha, precio));
        }

        precios.Sort((a, b) => a.Item1.CompareTo(b.Item1));
        return precios;
    }

    public void Dispose() => _http.Dispose();
}
