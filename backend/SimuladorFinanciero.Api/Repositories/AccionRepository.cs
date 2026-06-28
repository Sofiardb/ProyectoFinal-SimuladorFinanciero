using Dapper;
using SimuladorFinanciero.Api.DTOs.Instrumentos;
using SimuladorFinanciero.Api.Infrastructure.Database;

namespace SimuladorFinanciero.Api.Repositories;

public sealed class AccionUpsertData
{
    public required string  Ticker                { get; init; }
    public required string  Nombre                { get; init; }
    public          string? Sector                { get; init; }
    public required decimal MuRetornoEsperado     { get; init; }
    public required decimal SigmaVolatilidad      { get; init; }
    public required decimal RhoCorrelacionIndice  { get; init; }
    public required decimal PrecioActual          { get; init; }
}

public interface IAccionRepository
{
    Task UpsertGbmParamsAsync(AccionUpsertData data, CancellationToken ct = default);
    Task ActualizarPrecioAsync(string ticker, decimal precio, CancellationToken ct = default);
    Task<IReadOnlyList<AccionResponse>> ObtenerActivasAsync(CancellationToken ct = default);
    Task<AccionResponse?> ObtenerPorIdAsync(long id, CancellationToken ct = default);
    Task<IReadOnlyList<string>> ObtenerTickersActivosAsync(CancellationToken ct = default);
    Task<(string Nombre, string? Sector)?> ObtenerMetadatosAsync(string ticker, CancellationToken ct = default);
}

public sealed class AccionRepository : IAccionRepository
{
    private readonly IDbConnectionFactory _db;
    public AccionRepository(IDbConnectionFactory db) => _db = db;

    public async Task UpsertGbmParamsAsync(AccionUpsertData data, CancellationToken ct = default)
    {
        using var conn = _db.Crear();
        const string sql = """
            INSERT INTO accion (ticker, nombre, sector, id_indice_mercado, id_moneda,
                                mu_retorno_esperado, sigma_volatilidad, rho_correlacion_indice,
                                precio_actual, fecha_precio_actual, fecha_estimacion_params, activo)
            SELECT @Ticker, @Nombre, @Sector,
                   im.id_indice_mercado,
                   m.id_moneda,
                   @MuRetornoEsperado, @SigmaVolatilidad, @RhoCorrelacionIndice,
                   @PrecioActual, NOW(), NOW(), TRUE
            FROM indice_mercado im
            CROSS JOIN moneda m
            WHERE im.codigo = 'SP500'
              AND m.codigo_iso = 'USD'
            ON CONFLICT (ticker) DO UPDATE SET
                mu_retorno_esperado     = EXCLUDED.mu_retorno_esperado,
                sigma_volatilidad       = EXCLUDED.sigma_volatilidad,
                rho_correlacion_indice  = EXCLUDED.rho_correlacion_indice,
                precio_actual           = EXCLUDED.precio_actual,
                fecha_precio_actual     = EXCLUDED.fecha_precio_actual,
                fecha_estimacion_params = EXCLUDED.fecha_estimacion_params,
                activo                  = TRUE
            """;
        await conn.ExecuteAsync(new CommandDefinition(sql, data, cancellationToken: ct));
    }

    public async Task ActualizarPrecioAsync(string ticker, decimal precio, CancellationToken ct = default)
    {
        using var conn = _db.Crear();
        await conn.ExecuteAsync(
            new CommandDefinition(
                "UPDATE accion SET precio_actual = @precio, fecha_precio_actual = NOW() WHERE ticker = @ticker",
                new { precio, ticker }, cancellationToken: ct));
    }

    public async Task<IReadOnlyList<AccionResponse>> ObtenerActivasAsync(CancellationToken ct = default)
    {
        using var conn = _db.Crear();
        const string sql = """
            SELECT id_accion, ticker, nombre, sector,
                   mu_retorno_esperado, sigma_volatilidad, rho_correlacion_indice,
                   precio_actual, fecha_precio_actual, fecha_estimacion_params
            FROM accion
            WHERE activo = TRUE
            ORDER BY ticker
            """;
        var rows = await conn.QueryAsync<AccionRow>(new CommandDefinition(sql, cancellationToken: ct));
        return rows.Select(ToResponse).ToList();
    }

    public async Task<AccionResponse?> ObtenerPorIdAsync(long id, CancellationToken ct = default)
    {
        using var conn = _db.Crear();
        const string sql = """
            SELECT id_accion, ticker, nombre, sector,
                   mu_retorno_esperado, sigma_volatilidad, rho_correlacion_indice,
                   precio_actual, fecha_precio_actual, fecha_estimacion_params
            FROM accion
            WHERE id_accion = @id
            """;
        var row = await conn.QuerySingleOrDefaultAsync<AccionRow>(
            new CommandDefinition(sql, new { id }, cancellationToken: ct));
        return row is null ? null : ToResponse(row);
    }

    public async Task<IReadOnlyList<string>> ObtenerTickersActivosAsync(CancellationToken ct = default)
    {
        using var conn = _db.Crear();
        var tickers = await conn.QueryAsync<string>(
            new CommandDefinition("SELECT ticker FROM accion WHERE activo = TRUE ORDER BY ticker",
                cancellationToken: ct));
        return tickers.ToList();
    }

    public async Task<(string Nombre, string? Sector)?> ObtenerMetadatosAsync(string ticker, CancellationToken ct = default)
    {
        using var conn = _db.Crear();
        var row = await conn.QuerySingleOrDefaultAsync<(string Nombre, string? Sector)>(
            new CommandDefinition(
                "SELECT nombre, sector FROM accion WHERE ticker = @ticker",
                new { ticker }, cancellationToken: ct));
        return row.Nombre is null ? null : row;
    }

    private static AccionResponse ToResponse(AccionRow r) => new(
        r.IdAccion, r.Ticker, r.Nombre, r.Sector,
        r.MuRetornoEsperado, r.SigmaVolatilidad, r.RhoCorrelacionIndice,
        r.PrecioActual, r.FechaPrecioActual, r.FechaEstimacionParams);

    private sealed class AccionRow
    {
        public long     IdAccion               { get; set; }
        public string   Ticker                 { get; set; } = "";
        public string   Nombre                 { get; set; } = "";
        public string?  Sector                 { get; set; }
        public decimal? MuRetornoEsperado      { get; set; }
        public decimal? SigmaVolatilidad       { get; set; }
        public decimal? RhoCorrelacionIndice   { get; set; }
        public decimal? PrecioActual           { get; set; }
        public DateTimeOffset? FechaPrecioActual     { get; set; }
        public DateTimeOffset? FechaEstimacionParams { get; set; }
    }
}
