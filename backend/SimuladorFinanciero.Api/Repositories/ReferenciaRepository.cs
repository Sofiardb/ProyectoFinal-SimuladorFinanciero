using Dapper;
using SimuladorFinanciero.Api.DTOs.Instrumentos;
using SimuladorFinanciero.Api.DTOs.Referencia;
using SimuladorFinanciero.Api.Infrastructure.Database;

namespace SimuladorFinanciero.Api.Repositories;

public interface IReferenciaRepository
{
    Task<IReadOnlyList<MonedaResponse>>            ObtenerMonedasAsync(CancellationToken ct = default);
    Task<IReadOnlyList<PerfilRiesgoResponse>>       ObtenerPerfilesRiesgoAsync(CancellationToken ct = default);
    Task<IReadOnlyList<TipoEscenarioResponse>>      ObtenerTiposEscenarioAsync(CancellationToken ct = default);
    Task<IReadOnlyList<EscenarioEconomicoResponse>> ObtenerEscenariosVigentesAsync(CancellationToken ct = default);
    Task<IReadOnlyList<TipoPlazoFijoResponse>>      ObtenerTiposPlazoFijoAsync(CancellationToken ct = default);
}

public sealed class ReferenciaRepository : IReferenciaRepository
{
    private readonly IDbConnectionFactory _db;
    public ReferenciaRepository(IDbConnectionFactory db) => _db = db;

    public async Task<IReadOnlyList<MonedaResponse>> ObtenerMonedasAsync(CancellationToken ct = default)
    {
        using var conn = _db.Crear();
        var rows = await conn.QueryAsync<MonedaResponse>(
            new CommandDefinition(
                "SELECT id_moneda::int, codigo_iso, nombre, simbolo FROM moneda ORDER BY codigo_iso",
                cancellationToken: ct));
        return rows.ToList();
    }

    public async Task<IReadOnlyList<PerfilRiesgoResponse>> ObtenerPerfilesRiesgoAsync(CancellationToken ct = default)
    {
        using var conn = _db.Crear();
        var rows = await conn.QueryAsync<PerfilRiesgoResponse>(
            new CommandDefinition(
                "SELECT id_perfil_riesgo::int, nombre, descripcion, sigma_max_accion FROM perfil_riesgo ORDER BY id_perfil_riesgo",
                cancellationToken: ct));
        return rows.ToList();
    }

    public async Task<IReadOnlyList<TipoEscenarioResponse>> ObtenerTiposEscenarioAsync(CancellationToken ct = default)
    {
        using var conn = _db.Crear();
        var rows = await conn.QueryAsync<TipoEscenarioResponse>(
            new CommandDefinition(
                "SELECT id_tipo_escenario::int, codigo, nombre, descripcion FROM tipo_escenario ORDER BY id_tipo_escenario",
                cancellationToken: ct));
        return rows.ToList();
    }

    public async Task<IReadOnlyList<EscenarioEconomicoResponse>> ObtenerEscenariosVigentesAsync(CancellationToken ct = default)
    {
        using var conn = _db.Crear();
        const string sql = """
            SELECT ee.id_escenario_economico::int,
                   ee.id_tipo_escenario::int,
                   te.codigo  AS codigo_escenario,
                   te.nombre  AS nombre_escenario,
                   ee.inflacion_mensual_min,
                   ee.inflacion_mensual_max,
                   ee.vigente_desde,
                   ee.vigente_hasta
            FROM escenario_economico ee
            JOIN tipo_escenario te ON te.id_tipo_escenario = ee.id_tipo_escenario
            WHERE ee.vigente_hasta IS NULL
               OR ee.vigente_hasta >= CURRENT_DATE
            ORDER BY te.id_tipo_escenario
            """;
        var rows = await conn.QueryAsync<EscenarioEconomicoResponse>(
            new CommandDefinition(sql, cancellationToken: ct));
        return rows.ToList();
    }

    public async Task<IReadOnlyList<TipoPlazoFijoResponse>> ObtenerTiposPlazoFijoAsync(CancellationToken ct = default)
    {
        using var conn = _db.Crear();
        var rows = await conn.QueryAsync<TipoPlazoFijoResponse>(
            new CommandDefinition(
                "SELECT id_tipo_plazo_fijo::int, codigo, nombre, descripcion FROM tipo_plazo_fijo ORDER BY id_tipo_plazo_fijo",
                cancellationToken: ct));
        return rows.ToList();
    }
}
