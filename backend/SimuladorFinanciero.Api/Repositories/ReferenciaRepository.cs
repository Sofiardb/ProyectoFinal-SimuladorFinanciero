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
    Task ActualizarEscenariosVigentesAsync(IReadOnlyList<ActualizarEscenarioEconomicoItem> escenarios, CancellationToken ct = default);
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
                   ee.inflacion_mensual_min_usd,
                   ee.inflacion_mensual_max_usd,
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

    public async Task ActualizarEscenariosVigentesAsync(IReadOnlyList<ActualizarEscenarioEconomicoItem> escenarios, CancellationToken ct = default)
    {
        using var conn = _db.Crear();
        conn.Open();
        using var tx = conn.BeginTransaction();

        const string sql = """
            WITH valores_nuevos (id_tipo_escenario, inflacion_mensual_min, inflacion_mensual_max,
                                  inflacion_mensual_min_usd, inflacion_mensual_max_usd) AS (
                SELECT * FROM UNNEST(@idsTipoEscenario, @min, @max, @minUsd, @maxUsd)
            ),
            vigentes AS (
                SELECT * FROM escenario_economico WHERE vigente_hasta IS NULL
            ),
            a_actualizar AS (
                SELECT vn.id_tipo_escenario,
                       vn.inflacion_mensual_min, vn.inflacion_mensual_max,
                       vn.inflacion_mensual_min_usd, vn.inflacion_mensual_max_usd
                FROM valores_nuevos vn
                JOIN vigentes v ON v.id_tipo_escenario = vn.id_tipo_escenario
                WHERE v.inflacion_mensual_min <> vn.inflacion_mensual_min
                   OR v.inflacion_mensual_max <> vn.inflacion_mensual_max
                   OR v.inflacion_mensual_min_usd <> vn.inflacion_mensual_min_usd
                   OR v.inflacion_mensual_max_usd <> vn.inflacion_mensual_max_usd
            ),
            cierre AS (
                UPDATE escenario_economico ee
                SET vigente_hasta = CURRENT_DATE - INTERVAL '1 day'
                FROM a_actualizar au
                WHERE ee.id_tipo_escenario = au.id_tipo_escenario
                  AND ee.vigente_hasta IS NULL
                RETURNING ee.id_tipo_escenario
            )
            INSERT INTO escenario_economico
                (id_tipo_escenario, inflacion_mensual_min, inflacion_mensual_max,
                 inflacion_mensual_min_usd, inflacion_mensual_max_usd, vigente_desde)
            SELECT au.id_tipo_escenario, au.inflacion_mensual_min, au.inflacion_mensual_max,
                   au.inflacion_mensual_min_usd, au.inflacion_mensual_max_usd, CURRENT_DATE
            FROM a_actualizar au
            JOIN cierre c ON c.id_tipo_escenario = au.id_tipo_escenario
            """;

        await conn.ExecuteAsync(new CommandDefinition(sql, new
        {
            idsTipoEscenario = escenarios.Select(e => e.IdTipoEscenario).ToArray(),
            min               = escenarios.Select(e => e.InflacionMensualMin).ToArray(),
            max               = escenarios.Select(e => e.InflacionMensualMax).ToArray(),
            minUsd            = escenarios.Select(e => e.InflacionMensualMinUsd).ToArray(),
            maxUsd            = escenarios.Select(e => e.InflacionMensualMaxUsd).ToArray(),
        }, transaction: tx, cancellationToken: ct));

        tx.Commit();
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
