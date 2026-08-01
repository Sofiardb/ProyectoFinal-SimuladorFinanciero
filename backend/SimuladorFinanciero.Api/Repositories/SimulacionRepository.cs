using System.Data;
using System.Text.Json;
using Dapper;
using Npgsql;
using SimuladorFinanciero.Api.DTOs.Simulacion;
using SimuladorFinanciero.Api.Infrastructure.Database;

namespace SimuladorFinanciero.Api.Repositories;

public interface ISimulacionRepository
{
    Task<IReadOnlyList<SimulacionResumenResponse>> ObtenerPorPortfolioAsync(long idPortfolio, long idUsuario, CancellationToken ct = default);
    Task<SimulacionDetalleResponse?> ObtenerDetalleAsync(long idSimulacion, long idUsuario, CancellationToken ct = default);
    Task<IReadOnlyList<ResultadoSimulacionResponse>> ObtenerResultadosAsync(long idSimulacion, long idUsuario, string? ambito, CancellationToken ct = default);
    Task<IReadOnlyList<InstrumentoSimulacionResponse>> ObtenerInstrumentosAsync(long idSimulacion, long idUsuario, CancellationToken ct = default);
    Task<SimulacionPreviewResponse?> ObtenerPreviewAsync(long idPortfolio, long idUsuario, CancellationToken ct = default);
    Task<bool> EliminarAsync(long idSimulacion, long idUsuario, CancellationToken ct = default);

    Task<TenenciasSimulacionData> ObtenerTenenciasParaSimulacionAsync(long idPortfolio, CancellationToken ct = default);
    Task<EscenarioSimulacion[]> ObtenerEscenariosVigentesAsync(CancellationToken ct = default);
    Task ExecuteInTransaccionAsync(Func<IDbConnection, IDbTransaction, CancellationToken, Task> work, CancellationToken ct = default);
    Task<long> InsertSimulacionAsync(InsertSimulacionData data, IDbConnection conn, IDbTransaction tx, CancellationToken ct = default);
    Task InsertParametrosEscenarioAsync(long idSimulacion, EscenarioSimulacion[] escenarios, IDbConnection conn, IDbTransaction tx, CancellationToken ct = default);
    Task InsertSimulacionInstrumentosAsync(long idSimulacion, IReadOnlyList<InstrumentoSimulacionSnapshot> snapshots, IDbConnection conn, IDbTransaction tx, CancellationToken ct = default);
    Task InsertResultadosAsync(long idSimulacion, int horizonteMeses, JsonElement motorResponse, IDbConnection conn, IDbTransaction tx, CancellationToken ct = default);
}

public sealed class SimulacionRepository : ISimulacionRepository
{
    private readonly IDbConnectionFactory _db;

    public SimulacionRepository(IDbConnectionFactory db) => _db = db;

    // ── Filas internas de Dapper ──────────────────────────────────────────────

    private sealed class SimulacionRow
    {
        public long           IdSimulacion       { get; set; }
        public long           IdPortfolio        { get; set; }
        public DateTimeOffset FechaEjecucion     { get; set; }
        public int            HorizonteMeses     { get; set; }
        public int            NumTrayectorias    { get; set; }
        public long           SeedAleatoria      { get; set; }
        public decimal        ValorInicial       { get; set; }
        public decimal?       ValorEsperado      { get; set; }
        public decimal?       ValorMinimo        { get; set; }
        public decimal?       ValorMaximo        { get; set; }
        public decimal?       RetornoEsperadoPct { get; set; }
        public decimal?       RendimientoRealPct { get; set; }
        public decimal?       DesvioEstandar     { get; set; }
        public string?        Observaciones      { get; set; }
        public decimal?       ValorInicialArs        { get; set; }
        public decimal?       ValorInicialUsd        { get; set; }
        public decimal?       ValorEsperadoArs       { get; set; }
        public decimal?       ValorEsperadoUsd       { get; set; }
        public decimal?       ValorMinimoArs         { get; set; }
        public decimal?       ValorMinimoUsd         { get; set; }
        public decimal?       ValorMaximoArs         { get; set; }
        public decimal?       ValorMaximoUsd         { get; set; }
        public decimal?       RetornoEsperadoPctArs  { get; set; }
        public decimal?       RetornoEsperadoPctUsd  { get; set; }
        public decimal?       RendimientoRealPctArs  { get; set; }
        public decimal?       RendimientoRealPctUsd  { get; set; }
    }

    private sealed class ParametroEscenarioRow
    {
        public int     IdTipoEscenario        { get; set; }
        public string  NombreTipoEscenario    { get; set; } = "";
        public decimal InflacionMensualMin    { get; set; }
        public decimal InflacionMensualMax    { get; set; }
        public decimal InflacionMensualMinUsd { get; set; }
        public decimal InflacionMensualMaxUsd { get; set; }
    }

    private sealed class ResultadoRow
    {
        public long   IdResultado  { get; set; }
        public long   IdSimulacion { get; set; }
        public string Ambito       { get; set; } = "";
        public string Escenario    { get; set; } = "";
        public string Metrica      { get; set; } = "";
        public string Stats        { get; set; } = "{}";
    }

    private sealed class InstrumentoRow
    {
        public string  Ambito         { get; set; } = "";
        public string  Tipo           { get; set; } = "";
        public decimal Monto          { get; set; }
        public string  Parametros     { get; set; } = "{}";
        public int     HorizonteMeses { get; set; }
    }

    private sealed class PreviewAccionRow
    {
        public long     IdAccion      { get; set; }
        public string   Ticker        { get; set; } = "";
        public string   Nombre        { get; set; } = "";
        public decimal  Cantidad      { get; set; }
        public decimal  PrecioCompra  { get; set; }
        public decimal? PrecioActual  { get; set; }
        public decimal? MuOriginal    { get; set; }
        public decimal? MuMercado     { get; set; }
        public decimal? SigmaOriginal { get; set; }
        public decimal? SigmaMercado  { get; set; }
        public decimal? RhoOriginal   { get; set; }
        public decimal? RhoMercado    { get; set; }
    }

    private sealed class PreviewBonoRow
    {
        public long     IdBono          { get; set; }
        public string   Ticker          { get; set; } = "";
        public string   Nombre          { get; set; } = "";
        public decimal  Cantidad        { get; set; }
        public decimal  PrecioCompra    { get; set; }
        public decimal? PrecioActual    { get; set; }
        public DateOnly FechaVencimiento { get; set; }
        public int      FlujosTotales   { get; set; }
        public int      FlujosVigentes  { get; set; }
        public int      FlujosVencidos  { get; set; }
        public decimal  TasaOriginal    { get; set; }
        public decimal  TasaMercado     { get; set; }
    }

    private sealed class PreviewLetraRow
    {
        public long     IdLetra          { get; set; }
        public string   Ticker           { get; set; } = "";
        public string   Nombre           { get; set; } = "";
        public decimal  Cantidad         { get; set; }
        public decimal  PrecioCompra     { get; set; }
        public decimal? PrecioActual     { get; set; }
        public DateOnly FechaVencimiento { get; set; }
        public decimal  TasaOriginal     { get; set; }
        public decimal  TasaMercado      { get; set; }
    }

    private sealed class PreviewPlazoFijoRow
    {
        public long     IdPortfolioPlazoFijo       { get; set; }
        public string   EntidadFinanciera           { get; set; } = "";
        public string   CodigoMoneda                { get; set; } = "";
        public decimal  MontoInvertido              { get; set; }
        public DateOnly FechaInicio                 { get; set; }
        public int      DuracionDias               { get; set; }
        public bool     ReinvertirAlVencimiento     { get; set; }
    }

    private sealed class CapitalInicialRow
    {
        public decimal? CapitalInicial { get; set; }
    }

    // ── Mappers ───────────────────────────────────────────────────────────────

    private static SimulacionResumenResponse ToResumen(SimulacionRow r) => new(
        r.IdSimulacion, r.IdPortfolio, r.FechaEjecucion, r.HorizonteMeses,
        r.NumTrayectorias, r.SeedAleatoria, r.ValorInicial,
        r.ValorEsperado, r.ValorMinimo, r.ValorMaximo,
        r.RetornoEsperadoPct, r.RendimientoRealPct, r.DesvioEstandar,
        r.Observaciones,
        r.ValorInicialArs, r.ValorInicialUsd, r.ValorEsperadoArs, r.ValorEsperadoUsd,
        r.ValorMinimoArs, r.ValorMinimoUsd, r.ValorMaximoArs, r.ValorMaximoUsd,
        r.RetornoEsperadoPctArs, r.RetornoEsperadoPctUsd,
        r.RendimientoRealPctArs, r.RendimientoRealPctUsd);

    private static SimulacionParametroEscenarioResponse ToParametro(ParametroEscenarioRow r) => new(
        r.IdTipoEscenario, r.NombreTipoEscenario,
        r.InflacionMensualMin, r.InflacionMensualMax,
        r.InflacionMensualMinUsd, r.InflacionMensualMaxUsd);

    private static ResultadoSimulacionResponse ToResultado(ResultadoRow r) => new(
        r.IdResultado, r.IdSimulacion, r.Ambito, r.Escenario, r.Metrica,
        JsonSerializer.Deserialize<JsonElement>(r.Stats));

    /// <summary>
    /// Extrae el mes de vencimiento de <c>parametros</c> (mismo JSON enviado al motor) y lo expone
    /// solo si efectivamente congela la "ganancia real" — misma condición que
    /// <c>t_congelamiento</c> en orquestador.py: nunca para acciones, null si vence después del
    /// horizonte, null si es plazo fijo con reinvertir=true.
    /// </summary>
    private static InstrumentoSimulacionResponse ToInstrumento(InstrumentoRow r)
    {
        var p = JsonSerializer.Deserialize<JsonElement>(r.Parametros);
        int? tVenc = r.Tipo switch
        {
            "lecap" or "lecer" => p.GetProperty("t_venc_meses").GetInt32(),
            "bono_tasa_fija"   => p.GetProperty("flujos").EnumerateArray().Max(f => f.GetProperty("mes").GetInt32()),
            "bono_indexado"    => p.GetProperty("flujos_base").EnumerateArray().Max(f => f.GetProperty("mes").GetInt32()),
            "plazo_fijo_tradicional" or "plazo_fijo_uva" or "plazo_fijo_usd"
                => p.GetProperty("reinvertir").GetBoolean() ? null : p.GetProperty("t_venc_meses").GetInt32(),
            _ => null,
        };

        var tVencDentroDelHorizonte = tVenc.HasValue && tVenc.Value < r.HorizonteMeses ? tVenc : null;
        return new InstrumentoSimulacionResponse(r.Ambito, r.Tipo, r.Monto, tVencDentroDelHorizonte);
    }

    // ── Queries ───────────────────────────────────────────────────────────────

    public async Task<IReadOnlyList<SimulacionResumenResponse>> ObtenerPorPortfolioAsync(
        long idPortfolio, long idUsuario, CancellationToken ct = default)
    {
        using var conn = _db.Crear();
        const string sql = """
            SELECT s.id_simulacion,
                   s.id_portfolio,
                   s.fecha_ejecucion,
                   s.horizonte_meses::int,
                   s.num_trayectorias,
                   s.seed_aleatoria,
                   s.valor_inicial,
                   s.valor_esperado,
                   s.valor_minimo,
                   s.valor_maximo,
                   s.retorno_esperado_pct,
                   s.rendimiento_real_pct,
                   s.desvio_estandar,
                   s.observaciones,
                   s.valor_inicial_ars,
                   s.valor_inicial_usd,
                   s.valor_esperado_ars,
                   s.valor_esperado_usd,
                   s.valor_minimo_ars,
                   s.valor_minimo_usd,
                   s.valor_maximo_ars,
                   s.valor_maximo_usd,
                   s.retorno_esperado_pct_ars,
                   s.retorno_esperado_pct_usd,
                   s.rendimiento_real_pct_ars,
                   s.rendimiento_real_pct_usd
            FROM simulacion s
            JOIN portfolio  p ON p.id_portfolio = s.id_portfolio
            WHERE s.id_portfolio = @idPortfolio
              AND p.id_usuario   = @idUsuario
            ORDER BY s.fecha_ejecucion DESC
            """;
        var rows = await conn.QueryAsync<SimulacionRow>(
            new CommandDefinition(sql, new { idPortfolio, idUsuario }, cancellationToken: ct));
        return rows.Select(ToResumen).ToList();
    }

    public async Task<SimulacionDetalleResponse?> ObtenerDetalleAsync(
        long idSimulacion, long idUsuario, CancellationToken ct = default)
    {
        using var conn = _db.Crear();

        const string sqlSim = """
            SELECT s.id_simulacion,
                   s.id_portfolio,
                   s.fecha_ejecucion,
                   s.horizonte_meses::int,
                   s.num_trayectorias,
                   s.seed_aleatoria,
                   s.valor_inicial,
                   s.valor_esperado,
                   s.valor_minimo,
                   s.valor_maximo,
                   s.retorno_esperado_pct,
                   s.rendimiento_real_pct,
                   s.desvio_estandar,
                   s.observaciones,
                   s.valor_inicial_ars,
                   s.valor_inicial_usd,
                   s.valor_esperado_ars,
                   s.valor_esperado_usd,
                   s.valor_minimo_ars,
                   s.valor_minimo_usd,
                   s.valor_maximo_ars,
                   s.valor_maximo_usd,
                   s.retorno_esperado_pct_ars,
                   s.retorno_esperado_pct_usd,
                   s.rendimiento_real_pct_ars,
                   s.rendimiento_real_pct_usd
            FROM simulacion s
            JOIN portfolio  p ON p.id_portfolio = s.id_portfolio
            WHERE s.id_simulacion = @idSimulacion
              AND p.id_usuario    = @idUsuario
            """;
        var sim = await conn.QuerySingleOrDefaultAsync<SimulacionRow>(
            new CommandDefinition(sqlSim, new { idSimulacion, idUsuario }, cancellationToken: ct));

        if (sim is null) return null;

        const string sqlParams = """
            SELECT spe.id_tipo_escenario::int,
                   te.nombre AS nombre_tipo_escenario,
                   spe.inflacion_mensual_min,
                   spe.inflacion_mensual_max,
                   spe.inflacion_mensual_min_usd,
                   spe.inflacion_mensual_max_usd
            FROM simulacion_parametro_escenario spe
            JOIN tipo_escenario te ON te.id_tipo_escenario = spe.id_tipo_escenario
            WHERE spe.id_simulacion = @idSimulacion
            ORDER BY te.id_tipo_escenario
            """;
        var parametros = (await conn.QueryAsync<ParametroEscenarioRow>(
            new CommandDefinition(sqlParams, new { idSimulacion }, cancellationToken: ct)))
            .Select(ToParametro).ToList();

        return new SimulacionDetalleResponse(
            sim.IdSimulacion, sim.IdPortfolio, sim.FechaEjecucion, sim.HorizonteMeses,
            sim.NumTrayectorias, sim.SeedAleatoria, sim.ValorInicial,
            sim.ValorEsperado, sim.ValorMinimo, sim.ValorMaximo,
            sim.RetornoEsperadoPct, sim.RendimientoRealPct, sim.DesvioEstandar,
            sim.Observaciones,
            sim.ValorInicialArs, sim.ValorInicialUsd, sim.ValorEsperadoArs, sim.ValorEsperadoUsd,
            sim.ValorMinimoArs, sim.ValorMinimoUsd, sim.ValorMaximoArs, sim.ValorMaximoUsd,
            sim.RetornoEsperadoPctArs, sim.RetornoEsperadoPctUsd,
            sim.RendimientoRealPctArs, sim.RendimientoRealPctUsd,
            parametros);
    }

    public async Task<IReadOnlyList<ResultadoSimulacionResponse>> ObtenerResultadosAsync(
        long idSimulacion, long idUsuario, string? ambito, CancellationToken ct = default)
    {
        using var conn = _db.Crear();
        const string sql = """
            SELECT rs.id_resultado,
                   rs.id_simulacion,
                   rs.ambito,
                   rs.escenario,
                   rs.metrica,
                   rs.stats::text AS stats
            FROM resultado_simulacion rs
            JOIN simulacion  s ON s.id_simulacion = rs.id_simulacion
            JOIN portfolio   p ON p.id_portfolio  = s.id_portfolio
            WHERE rs.id_simulacion = @idSimulacion
              AND p.id_usuario     = @idUsuario
              AND (@ambito::varchar IS NULL OR rs.ambito = @ambito)
            ORDER BY rs.ambito, rs.escenario, rs.metrica
            """;
        var rows = await conn.QueryAsync<ResultadoRow>(
            new CommandDefinition(sql, new { idSimulacion, idUsuario, ambito }, cancellationToken: ct));
        return rows.Select(ToResultado).ToList();
    }

    public async Task<IReadOnlyList<InstrumentoSimulacionResponse>> ObtenerInstrumentosAsync(
        long idSimulacion, long idUsuario, CancellationToken ct = default)
    {
        using var conn = _db.Crear();
        const string sql = """
            SELECT si.ambito,
                   si.tipo,
                   si.monto,
                   si.parametros::text AS parametros,
                   s.horizonte_meses::int
            FROM simulacion_instrumento si
            JOIN simulacion s ON s.id_simulacion = si.id_simulacion
            JOIN portfolio  p ON p.id_portfolio  = s.id_portfolio
            WHERE si.id_simulacion = @idSimulacion
              AND p.id_usuario     = @idUsuario
            ORDER BY si.ambito
            """;
        var rows = await conn.QueryAsync<InstrumentoRow>(
            new CommandDefinition(sql, new { idSimulacion, idUsuario }, cancellationToken: ct));
        return rows.Select(ToInstrumento).ToList();
    }

    public async Task<bool> EliminarAsync(long idSimulacion, long idUsuario, CancellationToken ct = default)
    {
        using var conn = _db.Crear();
        const string sql = """
            DELETE FROM simulacion s
            USING portfolio p
            WHERE s.id_simulacion = @idSimulacion
              AND s.id_portfolio  = p.id_portfolio
              AND p.id_usuario    = @idUsuario
            """;
        var affected = await conn.ExecuteAsync(
            new CommandDefinition(sql, new { idSimulacion, idUsuario }, cancellationToken: ct));
        return affected > 0;
    }

    public async Task<SimulacionPreviewResponse?> ObtenerPreviewAsync(
        long idPortfolio, long idUsuario, CancellationToken ct = default)
    {
        // Verify ownership and fetch capital_inicial
        using var connPortfolio = _db.Crear();
        const string sqlPortfolio = """
            SELECT p.capital_inicial
            FROM portfolio p
            WHERE p.id_portfolio = @idPortfolio
              AND p.id_usuario   = @idUsuario
            """;
        var portfolioRow = await connPortfolio.QuerySingleOrDefaultAsync<CapitalInicialRow>(
            new CommandDefinition(sqlPortfolio, new { idPortfolio, idUsuario }, cancellationToken: ct));

        if (portfolioRow is null) return null;

        // Fetch all instrument types
        using var connA = _db.Crear();
        using var connB = _db.Crear();
        using var connL = _db.Crear();
        using var connPf = _db.Crear();

        const string sqlAcciones = """
            SELECT a.id_accion,
                   a.ticker,
                   a.nombre,
                   pa.cantidad,
                   pa.precio_compra,
                   a.precio_actual,
                   pa.mu_retorno_esperado_compra    AS mu_original,
                   a.mu_retorno_esperado            AS mu_mercado,
                   pa.sigma_volatilidad_compra      AS sigma_original,
                   a.sigma_volatilidad              AS sigma_mercado,
                   pa.rho_correlacion_indice_compra AS rho_original,
                   a.rho_correlacion_indice         AS rho_mercado
            FROM portfolio_accion pa
            JOIN accion a ON a.id_accion = pa.id_accion
            WHERE pa.id_portfolio = @idPortfolio
            ORDER BY a.ticker
            """;

        const string sqlBonos = """
            SELECT b.id_bono,
                   b.ticker,
                   b.nombre,
                   pb.cantidad,
                   pb.precio_compra,
                   b.precio_actual,
                   b.fecha_vencimiento,
                   COUNT(fb.id_flujo_bono)::int                                  AS flujos_totales,
                   COUNT(*) FILTER (WHERE fb.fecha_pago > CURRENT_DATE)::int     AS flujos_vigentes,
                   COUNT(*) FILTER (WHERE fb.fecha_pago <= CURRENT_DATE)::int    AS flujos_vencidos,
                   pb.tasa_descuento_compra AS tasa_original,
                   b.tasa_descuento         AS tasa_mercado
            FROM portfolio_bono pb
            JOIN bono b ON b.id_bono = pb.id_bono
            LEFT JOIN flujo_bono fb ON fb.id_bono = b.id_bono
            WHERE pb.id_portfolio = @idPortfolio
            GROUP BY b.id_bono, b.ticker, b.nombre, pb.cantidad, pb.precio_compra,
                     b.precio_actual, b.fecha_vencimiento, pb.tasa_descuento_compra, b.tasa_descuento
            ORDER BY b.ticker
            """;

        const string sqlLetras = """
            SELECT l.id_letra,
                   l.ticker,
                   l.nombre,
                   pl.cantidad,
                   pl.precio_compra,
                   l.precio_actual,
                   l.fecha_vencimiento,
                   pl.tasa_compra AS tasa_original,
                   l.tasa         AS tasa_mercado
            FROM portfolio_letra pl
            JOIN letra l ON l.id_letra = pl.id_letra
            WHERE pl.id_portfolio = @idPortfolio
            ORDER BY l.ticker
            """;

        const string sqlPlazosFijos = """
            SELECT ppf.id_portfolio_plazo_fijo,
                   ppf.entidad_financiera,
                   m.codigo_iso AS codigo_moneda,
                   ppf.monto_invertido,
                   ppf.fecha_inicio,
                   ppf.duracion_dias::int,
                   ppf.reinvertir_al_vencimiento
            FROM portfolio_plazo_fijo ppf
            JOIN moneda m ON m.id_moneda = ppf.id_moneda
            WHERE ppf.id_portfolio = @idPortfolio
            ORDER BY ppf.fecha_inicio, ppf.id_portfolio_plazo_fijo
            """;

        var param = new { idPortfolio };
        var accionesTask   = connA .QueryAsync<PreviewAccionRow>   (new CommandDefinition(sqlAcciones,   param, cancellationToken: ct));
        var bonosTask      = connB .QueryAsync<PreviewBonoRow>     (new CommandDefinition(sqlBonos,      param, cancellationToken: ct));
        var letrasTask     = connL .QueryAsync<PreviewLetraRow>    (new CommandDefinition(sqlLetras,     param, cancellationToken: ct));
        var plazosFijosTask= connPf.QueryAsync<PreviewPlazoFijoRow>(new CommandDefinition(sqlPlazosFijos,param, cancellationToken: ct));

        await Task.WhenAll(accionesTask, bonosTask, letrasTask, plazosFijosTask);

        var today = DateOnly.FromDateTime(DateTime.UtcNow);
        var instrumentos = new List<InstrumentoPreviewItem>();

        foreach (var r in accionesTask.Result)
        {
            var (estado, esValido) = EstadoPrecio(r.PrecioActual, r.PrecioCompra);
            var estadoGbm     = EstadoGbm(r.MuOriginal, r.MuMercado, r.SigmaOriginal, r.SigmaMercado, r.RhoOriginal, r.RhoMercado);
            var montoOriginal = r.Cantidad * r.PrecioCompra;
            var montoMercado  = r.PrecioActual.HasValue ? r.Cantidad * r.PrecioActual.Value : (decimal?)null;
            instrumentos.Add(new InstrumentoPreviewItem(
                Id:                 $"accion_{r.IdAccion}",
                Tipo:               "accion",
                Ticker:             r.Ticker,
                Nombre:             r.Nombre,
                EntidadFinanciera:  null,
                CodigoMoneda:       null,
                Cantidad:           r.Cantidad,
                PrecioOriginal:     r.PrecioCompra,
                PrecioMercado:      r.PrecioActual,
                MontoOriginal:      montoOriginal,
                MontoMercado:       montoMercado,
                Estado:             estado,
                EsValidoParaSimular: esValido,
                FlujosTotales:      null,
                FlujosVigentes:     null,
                FlujosVencidos:     null,
                FechaVencimiento:   null,
                MesesRestantes:     null,
                EstadoTasa:         estadoGbm,
                TasaOriginal:       null,
                TasaMercado:        null,
                MuOriginal:         r.MuOriginal,
                MuMercado:          r.MuMercado,
                SigmaOriginal:      r.SigmaOriginal,
                SigmaMercado:       r.SigmaMercado,
                RhoOriginal:        r.RhoOriginal,
                RhoMercado:         r.RhoMercado));
        }

        foreach (var r in bonosTask.Result)
        {
            string estado;
            bool esValido;
            if (r.FlujosVencidos > 0 && r.FlujosVigentes == 0)
            {
                estado   = "VENCIDO";
                esValido = false;
            }
            else if (r.FlujosVencidos > 0)
            {
                estado   = "PARCIALMENTE_VENCIDO";
                esValido = true;
            }
            else
            {
                (estado, esValido) = EstadoPrecio(r.PrecioActual, r.PrecioCompra);
            }

            var montoOriginal = r.Cantidad * r.PrecioCompra;
            var montoMercado  = r.PrecioActual.HasValue ? r.Cantidad * r.PrecioActual.Value : (decimal?)null;
            var mesesRestantes = MesesEntre(today, r.FechaVencimiento);
            var (estadoTasa, _) = EstadoPrecio(r.TasaMercado, r.TasaOriginal);
            instrumentos.Add(new InstrumentoPreviewItem(
                Id:                 $"bono_{r.IdBono}",
                Tipo:               "bono",
                Ticker:             r.Ticker,
                Nombre:             r.Nombre,
                EntidadFinanciera:  null,
                CodigoMoneda:       null,
                Cantidad:           r.Cantidad,
                PrecioOriginal:     r.PrecioCompra,
                PrecioMercado:      r.PrecioActual,
                MontoOriginal:      montoOriginal,
                MontoMercado:       montoMercado,
                Estado:             estado,
                EsValidoParaSimular: esValido,
                FlujosTotales:      r.FlujosTotales,
                FlujosVigentes:     r.FlujosVigentes,
                FlujosVencidos:     r.FlujosVencidos,
                FechaVencimiento:   r.FechaVencimiento,
                MesesRestantes:     mesesRestantes,
                EstadoTasa:         estadoTasa,
                TasaOriginal:       r.TasaOriginal,
                TasaMercado:        r.TasaMercado,
                MuOriginal:         null,
                MuMercado:          null,
                SigmaOriginal:      null,
                SigmaMercado:       null,
                RhoOriginal:        null,
                RhoMercado:         null));
        }

        foreach (var r in letrasTask.Result)
        {
            string estado;
            bool esValido;
            if (r.FechaVencimiento <= today)
            {
                estado   = "VENCIDO";
                esValido = false;
            }
            else
            {
                (estado, esValido) = EstadoPrecio(r.PrecioActual, r.PrecioCompra);
            }

            var montoOriginal  = r.Cantidad * r.PrecioCompra;
            var montoMercado   = r.PrecioActual.HasValue ? r.Cantidad * r.PrecioActual.Value : (decimal?)null;
            var mesesRestantes = MesesEntre(today, r.FechaVencimiento);
            var (estadoTasa, _) = EstadoPrecio(r.TasaMercado, r.TasaOriginal);
            instrumentos.Add(new InstrumentoPreviewItem(
                Id:                 $"letra_{r.IdLetra}",
                Tipo:               "letra",
                Ticker:             r.Ticker,
                Nombre:             r.Nombre,
                EntidadFinanciera:  null,
                CodigoMoneda:       null,
                Cantidad:           r.Cantidad,
                PrecioOriginal:     r.PrecioCompra,
                PrecioMercado:      r.PrecioActual,
                MontoOriginal:      montoOriginal,
                MontoMercado:       montoMercado,
                Estado:             estado,
                EsValidoParaSimular: esValido,
                FlujosTotales:      null,
                FlujosVigentes:     null,
                FlujosVencidos:     null,
                FechaVencimiento:   r.FechaVencimiento,
                MesesRestantes:     mesesRestantes,
                EstadoTasa:         estadoTasa,
                TasaOriginal:       r.TasaOriginal,
                TasaMercado:        r.TasaMercado,
                MuOriginal:         null,
                MuMercado:          null,
                SigmaOriginal:      null,
                SigmaMercado:       null,
                RhoOriginal:        null,
                RhoMercado:         null));
        }

        foreach (var r in plazosFijosTask.Result)
        {
            var fechaVencimiento = r.FechaInicio.AddDays(r.DuracionDias);
            var vencido          = fechaVencimiento <= today && !r.ReinvertirAlVencimiento;
            var estado           = vencido ? "VENCIDO" : "ACTIVO";
            var mesesRestantes   = MesesEntre(today, fechaVencimiento);
            instrumentos.Add(new InstrumentoPreviewItem(
                Id:                 $"plazo_fijo_{r.IdPortfolioPlazoFijo}",
                Tipo:               "plazo_fijo",
                Ticker:             null,
                Nombre:             null,
                EntidadFinanciera:  r.EntidadFinanciera,
                CodigoMoneda:       r.CodigoMoneda,
                Cantidad:           0m,
                PrecioOriginal:     r.MontoInvertido,
                PrecioMercado:      null,
                MontoOriginal:      r.MontoInvertido,
                MontoMercado:       null,
                Estado:             estado,
                EsValidoParaSimular: !vencido,
                FlujosTotales:      null,
                FlujosVigentes:     null,
                FlujosVencidos:     null,
                FechaVencimiento:   fechaVencimiento,
                MesesRestantes:     mesesRestantes,
                EstadoTasa:         null,
                TasaOriginal:       null,
                TasaMercado:        null,
                MuOriginal:         null,
                MuMercado:          null,
                SigmaOriginal:      null,
                SigmaMercado:       null,
                RhoOriginal:        null,
                RhoMercado:         null));
        }

        var totalOriginal = instrumentos.Sum(i => i.MontoOriginal);
        var hayInstrumentoSinPrecio = instrumentos.Any(i => i.MontoMercado is null && i.Tipo != "plazo_fijo");
        decimal? totalMercado = hayInstrumentoSinPrecio
            ? null
            : instrumentos.Sum(i => i.MontoMercado ?? i.MontoOriginal);
        var puedeSimular = instrumentos.All(i => i.EsValidoParaSimular);
        var tieneActualizaciones = instrumentos.Any(i => i.Estado == "ACTUALIZADO" || i.EstadoTasa == "ACTUALIZADO");

        return new SimulacionPreviewResponse(
            CapitalInicial:          portfolioRow.CapitalInicial,
            TotalInvertidoOriginal:  totalOriginal,
            TotalInvertidoMercado:   totalMercado,
            PuedeSimular:            puedeSimular,
            TieneActualizaciones:    tieneActualizaciones,
            Instrumentos:            instrumentos);
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    private static (string Estado, bool EsValido) EstadoPrecio(decimal? precioActual, decimal precioCompra)
    {
        if (!precioActual.HasValue)
            return ("SIN_PRECIO", true);

        if (precioCompra == 0m)
            return ("ACTUALIZADO", true);

        var diffPct = Math.Abs((precioActual.Value - precioCompra) / precioCompra);
        return diffPct < 0.001m
            ? ("IGUAL", true)
            : ("ACTUALIZADO", true);
    }

    private static string EstadoGbm(
        decimal? muOriginal, decimal? muMercado,
        decimal? sigmaOriginal, decimal? sigmaMercado,
        decimal? rhoOriginal, decimal? rhoMercado)
    {
        if (!muMercado.HasValue && !sigmaMercado.HasValue && !rhoMercado.HasValue)
            return "SIN_PRECIO";

        bool Difiere(decimal? original, decimal? mercado)
        {
            if (!original.HasValue || !mercado.HasValue) return original.HasValue != mercado.HasValue;
            if (original.Value == 0m) return mercado.Value != 0m;
            return Math.Abs((mercado.Value - original.Value) / original.Value) >= 0.001m;
        }

        return Difiere(muOriginal, muMercado) || Difiere(sigmaOriginal, sigmaMercado) || Difiere(rhoOriginal, rhoMercado)
            ? "ACTUALIZADO"
            : "IGUAL";
    }

    private static int MesesEntre(DateOnly desde, DateOnly hasta)
        => (hasta.Year - desde.Year) * 12 + (hasta.Month - desde.Month);

    // ── Write queries ─────────────────────────────────────────────────────────

    public async Task ExecuteInTransaccionAsync(
        Func<IDbConnection, IDbTransaction, CancellationToken, Task> work,
        CancellationToken ct = default)
    {
        using var conn = (NpgsqlConnection)_db.Crear();
        await conn.OpenAsync(ct);
        await using var tx = await conn.BeginTransactionAsync(ct);
        try
        {
            await work(conn, tx, ct);
            await tx.CommitAsync(ct);
        }
        catch
        {
            await tx.RollbackAsync(ct);
            throw;
        }
    }

    public async Task<TenenciasSimulacionData> ObtenerTenenciasParaSimulacionAsync(
        long idPortfolio, CancellationToken ct = default)
    {
        using var connA  = _db.Crear();
        using var connB  = _db.Crear();
        using var connBf = _db.Crear();
        using var connL  = _db.Crear();
        using var connPf = _db.Crear();

        var param = new { idPortfolio };

        const string sqlAcciones = """
            SELECT a.id_accion,
                   a.ticker,
                   pa.cantidad,
                   pa.precio_compra,
                   pa.mu_retorno_esperado_compra    AS mu,
                   pa.sigma_volatilidad_compra      AS sigma,
                   pa.rho_correlacion_indice_compra AS rho
            FROM portfolio_accion pa
            JOIN accion a ON a.id_accion = pa.id_accion
            WHERE pa.id_portfolio = @idPortfolio
            ORDER BY a.ticker
            """;

        const string sqlBonos = """
            SELECT b.id_bono,
                   b.ticker,
                   tbo.codigo             AS tipo,
                   pb.cantidad,
                   pb.precio_compra,
                   pb.tasa_descuento_compra AS tasa_descuento
            FROM portfolio_bono pb
            JOIN bono b       ON b.id_bono        = pb.id_bono
            JOIN tipo_bono tbo ON tbo.id_tipo_bono = b.id_tipo_bono
            WHERE pb.id_portfolio = @idPortfolio
            ORDER BY b.ticker
            """;

        const string sqlFlujosBonos = """
            SELECT fb.id_bono,
                   fb.fecha_pago,
                   fb.monto_cupon,
                   fb.monto_capital
            FROM flujo_bono fb
            WHERE fb.id_bono IN (
                SELECT pb.id_bono
                FROM portfolio_bono pb
                WHERE pb.id_portfolio = @idPortfolio
            )
            ORDER BY fb.id_bono, fb.fecha_pago
            """;

        const string sqlLetras = """
            SELECT l.id_letra,
                   tl.codigo               AS tipo,
                   pl.cantidad,
                   pl.precio_compra,
                   pl.tasa_compra          AS tna,
                   l.fecha_vencimiento
            FROM portfolio_letra pl
            JOIN letra l       ON l.id_letra       = pl.id_letra
            JOIN tipo_letra tl ON tl.id_tipo_letra = l.id_tipo_letra
            WHERE pl.id_portfolio = @idPortfolio
            ORDER BY l.ticker
            """;

        const string sqlPlazosFijos = """
            SELECT ppf.id_portfolio_plazo_fijo,
                   tpf.codigo    AS tipo_codigo,
                   mo.codigo_iso AS moneda_codigo,
                   ppf.monto_invertido,
                   ppf.tna_pactada,
                   ppf.fecha_inicio,
                   ppf.duracion_dias::int,
                   ppf.reinvertir_al_vencimiento
            FROM portfolio_plazo_fijo ppf
            JOIN tipo_plazo_fijo tpf ON tpf.id_tipo_plazo_fijo = ppf.id_tipo_plazo_fijo
            JOIN moneda mo           ON mo.id_moneda            = ppf.id_moneda
            WHERE ppf.id_portfolio = @idPortfolio
            ORDER BY ppf.fecha_inicio, ppf.id_portfolio_plazo_fijo
            """;

        var accionesTask    = connA .QueryAsync<AccionRow>    (new CommandDefinition(sqlAcciones,    param, cancellationToken: ct));
        var bonosTask       = connB .QueryAsync<BonoRow>      (new CommandDefinition(sqlBonos,       param, cancellationToken: ct));
        var flujosTask      = connBf.QueryAsync<FlujoBonoRow> (new CommandDefinition(sqlFlujosBonos, param, cancellationToken: ct));
        var letrasTask      = connL .QueryAsync<LetraRow>     (new CommandDefinition(sqlLetras,      param, cancellationToken: ct));
        var plazosFijosTask = connPf.QueryAsync<PlazoFijoRow> (new CommandDefinition(sqlPlazosFijos, param, cancellationToken: ct));

        await Task.WhenAll(accionesTask, bonosTask, flujosTask, letrasTask, plazosFijosTask);

        var flujosPorBono = flujosTask.Result
            .GroupBy(f => f.IdBono)
            .ToDictionary(g => g.Key, g => (IReadOnlyList<FlujoSimulacion>)g
                .Select(f => new FlujoSimulacion(f.FechaPago, f.MontoCupon, f.MontoCapital))
                .ToList());

        var acciones = accionesTask.Result
            .Select(r => new AccionTenenciaSimulacion(r.IdAccion, r.Ticker, r.Cantidad, r.PrecioCompra, r.Mu, r.Sigma, r.Rho))
            .ToList();

        var bonos = bonosTask.Result
            .Select(r => new BonoTenenciaSimulacion(
                r.IdBono, r.Ticker,
                r.Tipo == "TASA_FIJA" ? "bono_tasa_fija" : "bono_indexado",
                r.Cantidad, r.PrecioCompra, r.TasaDescuento,
                flujosPorBono.GetValueOrDefault(r.IdBono, [])))
            .ToList();

        var letras = letrasTask.Result
            .Select(r => new LetraTenenciaSimulacion(r.IdLetra, r.Tipo.ToLowerInvariant(), r.Cantidad, r.PrecioCompra, r.Tna, r.FechaVencimiento))
            .ToList();

        var plazosFijos = plazosFijosTask.Result
            .Select(r => new PlazoFijoTenenciaSimulacion(r.IdPortfolioPlazoFijo, r.TipoCodigo, r.MonedaCodigo, r.MontoInvertido, r.TnaPactada, r.FechaInicio, r.DuracionDias, r.ReinvertirAlVencimiento))
            .ToList();

        return new TenenciasSimulacionData(acciones, bonos, letras, plazosFijos);
    }

    public async Task<EscenarioSimulacion[]> ObtenerEscenariosVigentesAsync(CancellationToken ct = default)
    {
        using var conn = _db.Crear();
        const string sql = """
            SELECT te.id_tipo_escenario::int,
                   te.codigo,
                   ee.inflacion_mensual_min,
                   ee.inflacion_mensual_max,
                   ee.inflacion_mensual_min_usd,
                   ee.inflacion_mensual_max_usd
            FROM escenario_economico ee
            JOIN tipo_escenario te ON te.id_tipo_escenario = ee.id_tipo_escenario
            WHERE ee.vigente_desde <= CURRENT_DATE
              AND (ee.vigente_hasta IS NULL OR ee.vigente_hasta >= CURRENT_DATE)
            ORDER BY te.id_tipo_escenario
            """;
        var rows = await conn.QueryAsync<EscenarioRow>(new CommandDefinition(sql, cancellationToken: ct));
        return rows
            .Select(r => new EscenarioSimulacion(
                r.IdTipoEscenario, r.Codigo, r.InflacionMensualMin, r.InflacionMensualMax,
                r.InflacionMensualMinUsd, r.InflacionMensualMaxUsd))
            .ToArray();
    }

    public async Task<long> InsertSimulacionAsync(
        InsertSimulacionData data, IDbConnection conn, IDbTransaction tx, CancellationToken ct = default)
    {
        const string sql = """
            INSERT INTO simulacion (id_portfolio, horizonte_meses, num_trayectorias, seed_aleatoria,
                                    valor_inicial, valor_esperado, valor_minimo, valor_maximo,
                                    retorno_esperado_pct, rendimiento_real_pct, desvio_estandar,
                                    valor_inicial_ars, valor_inicial_usd,
                                    valor_esperado_ars, valor_esperado_usd,
                                    valor_minimo_ars, valor_minimo_usd,
                                    valor_maximo_ars, valor_maximo_usd,
                                    retorno_esperado_pct_ars, retorno_esperado_pct_usd,
                                    rendimiento_real_pct_ars, rendimiento_real_pct_usd)
            VALUES (@IdPortfolio, @HorizonteMeses, @NumTrayectorias, @SeedAleatoria,
                    @ValorInicial, @ValorEsperado, @ValorMinimo, @ValorMaximo,
                    @RetornoEsperadoPct, @RendimientoRealPct, @DesvioEstandar,
                    @ValorInicialArs, @ValorInicialUsd,
                    @ValorEsperadoArs, @ValorEsperadoUsd,
                    @ValorMinimoArs, @ValorMinimoUsd,
                    @ValorMaximoArs, @ValorMaximoUsd,
                    @RetornoEsperadoPctArs, @RetornoEsperadoPctUsd,
                    @RendimientoRealPctArs, @RendimientoRealPctUsd)
            RETURNING id_simulacion
            """;
        return await conn.ExecuteScalarAsync<long>(
            new CommandDefinition(sql, data, transaction: tx, cancellationToken: ct));
    }

    public async Task InsertParametrosEscenarioAsync(
        long idSimulacion, EscenarioSimulacion[] escenarios,
        IDbConnection conn, IDbTransaction tx, CancellationToken ct = default)
    {
        const string sql = """
            INSERT INTO simulacion_parametro_escenario
                (id_simulacion, id_tipo_escenario, inflacion_mensual_min, inflacion_mensual_max,
                 inflacion_mensual_min_usd, inflacion_mensual_max_usd)
            SELECT @idSimulacion,
                   unnest(@idsTipoEscenario::smallint[]),
                   unnest(@mins::numeric[]),
                   unnest(@maxs::numeric[]),
                   unnest(@minsUsd::numeric[]),
                   unnest(@maxsUsd::numeric[])
            """;
        await conn.ExecuteAsync(new CommandDefinition(sql, new
        {
            idSimulacion,
            idsTipoEscenario = escenarios.Select(e => (short)e.IdTipoEscenario).ToArray(),
            mins             = escenarios.Select(e => e.InflacionMensualMin).ToArray(),
            maxs             = escenarios.Select(e => e.InflacionMensualMax).ToArray(),
            minsUsd          = escenarios.Select(e => e.InflacionMensualMinUsd).ToArray(),
            maxsUsd          = escenarios.Select(e => e.InflacionMensualMaxUsd).ToArray()
        }, transaction: tx, cancellationToken: ct));
    }

    public async Task InsertSimulacionInstrumentosAsync(
        long idSimulacion, IReadOnlyList<InstrumentoSimulacionSnapshot> snapshots,
        IDbConnection conn, IDbTransaction tx, CancellationToken ct = default)
    {
        const string sql = """
            INSERT INTO simulacion_instrumento
                (id_simulacion, ambito, tipo, id_accion, id_bono, id_letra, id_portfolio_plazo_fijo, monto, parametros)
            SELECT @idSimulacion,
                   unnest(@ambitos::varchar[]),
                   unnest(@tipos::varchar[]),
                   unnest(@idsAccion::bigint[]),
                   unnest(@idsBono::bigint[]),
                   unnest(@idsLetra::bigint[]),
                   unnest(@idsPlazoFijo::bigint[]),
                   unnest(@montos::numeric[]),
                   unnest(@parametros::jsonb[])
            """;
        await conn.ExecuteAsync(new CommandDefinition(sql, new
        {
            idSimulacion,
            ambitos      = snapshots.Select(s => s.Ambito).ToArray(),
            tipos        = snapshots.Select(s => s.Tipo).ToArray(),
            idsAccion    = snapshots.Select(s => s.IdAccion).ToArray(),
            idsBono      = snapshots.Select(s => s.IdBono).ToArray(),
            idsLetra     = snapshots.Select(s => s.IdLetra).ToArray(),
            idsPlazoFijo = snapshots.Select(s => s.IdPortfolioPlazoFijo).ToArray(),
            montos       = snapshots.Select(s => s.Monto).ToArray(),
            parametros   = snapshots.Select(s => s.ParametrosJson).ToArray()
        }, transaction: tx, cancellationToken: ct));
    }

    public async Task InsertResultadosAsync(
        long idSimulacion, int horizonteMeses, JsonElement motorResponse,
        IDbConnection conn, IDbTransaction tx, CancellationToken ct = default)
    {
        var ambitos    = new List<string>();
        var escenarios = new List<string>();
        var metricas   = new List<string>();
        var stats      = new List<string>();

        var metricsSet = new[] { "patrimonio", "ganancias_nominales", "ganancias_reales" };
        var scenarioSet = new[] { "global", "favorable", "moderado", "desfavorable" };

        // portfolio_ars and portfolio_usd are top-level
        foreach (var portfolioAmbito in new[] { "portfolio_ars", "portfolio_usd" })
        {
            if (!motorResponse.TryGetProperty(portfolioAmbito, out var portfolioEl)) continue;
            ExtractMetrics(portfolioAmbito, portfolioEl, metricsSet, scenarioSet, ambitos, escenarios, metricas, stats);
        }

        // per-instrument results are under "instrumentos"
        if (motorResponse.TryGetProperty("instrumentos", out var instrumentosEl))
        {
            foreach (var instrumento in instrumentosEl.EnumerateObject())
            {
                ExtractMetrics(instrumento.Name, instrumento.Value, metricsSet, scenarioSet, ambitos, escenarios, metricas, stats);
            }
        }

        // Las métricas de inflación son de nivel superior (escenario directo, sin ámbito ni
        // desglose por moneda/instrumento) — no encajan en ExtractMetrics, que espera
        // ambito.metrica.escenario.
        var metricasInflacion = new[] { "inflacion_acumulada", "inflacion_acumulada_usd", "inflacion_mensual", "inflacion_mensual_usd" };
        foreach (var metricaInflacion in metricasInflacion)
        {
            if (!motorResponse.TryGetProperty(metricaInflacion, out var inflacionEl)) continue;
            foreach (var escenario in scenarioSet)
            {
                if (!inflacionEl.TryGetProperty(escenario, out var statsEl)) continue;
                ambitos.Add("global");
                escenarios.Add(escenario);
                metricas.Add(metricaInflacion);
                stats.Add(statsEl.GetRawText());
            }
        }

        if (ambitos.Count == 0) return;

        const string sql = """
            INSERT INTO resultado_simulacion (id_simulacion, ambito, escenario, metrica, stats)
            SELECT @idSimulacion,
                   unnest(@ambitos::varchar[]),
                   unnest(@escenarios::varchar[]),
                   unnest(@metricas::varchar[]),
                   unnest(@stats::jsonb[])
            ON CONFLICT (id_simulacion, ambito, escenario, metrica) DO UPDATE SET stats = EXCLUDED.stats
            """;
        await conn.ExecuteAsync(new CommandDefinition(sql, new
        {
            idSimulacion,
            ambitos    = ambitos.ToArray(),
            escenarios = escenarios.ToArray(),
            metricas   = metricas.ToArray(),
            stats      = stats.ToArray()
        }, transaction: tx, cancellationToken: ct));
    }

    private static void ExtractMetrics(
        string ambito, JsonElement ambitoEl,
        string[] metricsSet, string[] scenarioSet,
        List<string> ambitos, List<string> escenarios, List<string> metricas, List<string> stats)
    {
        foreach (var metrica in metricsSet)
        {
            if (!ambitoEl.TryGetProperty(metrica, out var metricaEl)) continue;
            foreach (var escenario in scenarioSet)
            {
                if (!metricaEl.TryGetProperty(escenario, out var statsEl)) continue;
                ambitos.Add(ambito);
                escenarios.Add(escenario);
                metricas.Add(metrica);
                stats.Add(statsEl.GetRawText());
            }
        }
    }

    // ── Rows for write queries ────────────────────────────────────────────────

    private sealed class AccionRow
    {
        public long     IdAccion    { get; set; }
        public string   Ticker      { get; set; } = "";
        public decimal  Cantidad    { get; set; }
        public decimal  PrecioCompra { get; set; }
        public decimal? Mu          { get; set; }
        public decimal? Sigma       { get; set; }
        public decimal? Rho         { get; set; }
    }

    private sealed class BonoRow
    {
        public long    IdBono        { get; set; }
        public string  Ticker        { get; set; } = "";
        public string  Tipo          { get; set; } = "";
        public decimal Cantidad      { get; set; }
        public decimal PrecioCompra  { get; set; }
        public decimal TasaDescuento { get; set; }
    }

    private sealed class FlujoBonoRow
    {
        public long     IdBono       { get; set; }
        public DateOnly FechaPago    { get; set; }
        public decimal  MontoCupon   { get; set; }
        public decimal  MontoCapital { get; set; }
    }

    private sealed class LetraRow
    {
        public long     IdLetra          { get; set; }
        public string   Tipo             { get; set; } = "";
        public decimal  Cantidad         { get; set; }
        public decimal  PrecioCompra     { get; set; }
        public decimal  Tna              { get; set; }
        public DateOnly FechaVencimiento { get; set; }
    }

    private sealed class PlazoFijoRow
    {
        public long     IdPortfolioPlazoFijo    { get; set; }
        public string   TipoCodigo              { get; set; } = "";
        public string   MonedaCodigo            { get; set; } = "";
        public decimal  MontoInvertido          { get; set; }
        public decimal  TnaPactada              { get; set; }
        public DateOnly FechaInicio             { get; set; }
        public int      DuracionDias           { get; set; }
        public bool     ReinvertirAlVencimiento { get; set; }
    }

    private sealed class EscenarioRow
    {
        public int     IdTipoEscenario        { get; set; }
        public string  Codigo                 { get; set; } = "";
        public decimal InflacionMensualMin    { get; set; }
        public decimal InflacionMensualMax    { get; set; }
        public decimal InflacionMensualMinUsd { get; set; }
        public decimal InflacionMensualMaxUsd { get; set; }
    }
}
