using Dapper;
using SimuladorFinanciero.Api.Infrastructure.Database;

namespace SimuladorFinanciero.Api.Repositories;

public interface ITipoCambioRepository
{
    Task<decimal?> ObtenerCotizacionDelDiaAsync(int idMonedaOrigen, int idMonedaDestino, DateOnly fecha, CancellationToken ct = default);
    Task GuardarCotizacionAsync(int idMonedaOrigen, int idMonedaDestino, DateOnly fecha, decimal valor, CancellationToken ct = default);
    Task<(decimal Valor, DateOnly Fecha)?> ObtenerUltimaCotizacionAsync(int idMonedaOrigen, int idMonedaDestino, CancellationToken ct = default);
}

public sealed class TipoCambioRepository : ITipoCambioRepository
{
    private readonly IDbConnectionFactory _db;
    public TipoCambioRepository(IDbConnectionFactory db) => _db = db;

    public async Task<decimal?> ObtenerCotizacionDelDiaAsync(int idMonedaOrigen, int idMonedaDestino, DateOnly fecha, CancellationToken ct = default)
    {
        using var conn = _db.Crear();
        return await conn.ExecuteScalarAsync<decimal?>(
            new CommandDefinition(
                """
                SELECT valor FROM tipo_cambio
                WHERE id_moneda_origen = @idMonedaOrigen::smallint
                  AND id_moneda_destino = @idMonedaDestino::smallint
                  AND fecha = @fecha
                """,
                new { idMonedaOrigen, idMonedaDestino, fecha }, cancellationToken: ct));
    }

    public async Task GuardarCotizacionAsync(int idMonedaOrigen, int idMonedaDestino, DateOnly fecha, decimal valor, CancellationToken ct = default)
    {
        using var conn = _db.Crear();
        await conn.ExecuteAsync(
            new CommandDefinition(
                """
                INSERT INTO tipo_cambio (id_moneda_origen, id_moneda_destino, fecha, valor)
                VALUES (@idMonedaOrigen::smallint, @idMonedaDestino::smallint, @fecha, @valor)
                ON CONFLICT (id_moneda_origen, id_moneda_destino, fecha) DO UPDATE SET valor = EXCLUDED.valor
                """,
                new { idMonedaOrigen, idMonedaDestino, fecha, valor }, cancellationToken: ct));
    }

    private sealed class UltimaCotizacionRow
    {
        public decimal  Valor { get; set; }
        public DateOnly Fecha { get; set; }
    }

    public async Task<(decimal Valor, DateOnly Fecha)?> ObtenerUltimaCotizacionAsync(int idMonedaOrigen, int idMonedaDestino, CancellationToken ct = default)
    {
        using var conn = _db.Crear();
        var row = await conn.QuerySingleOrDefaultAsync<UltimaCotizacionRow>(
            new CommandDefinition(
                """
                SELECT valor, fecha FROM tipo_cambio
                WHERE id_moneda_origen = @idMonedaOrigen::smallint
                  AND id_moneda_destino = @idMonedaDestino::smallint
                ORDER BY fecha DESC
                LIMIT 1
                """,
                new { idMonedaOrigen, idMonedaDestino }, cancellationToken: ct));
        return row is null ? null : (row.Valor, row.Fecha);
    }
}
