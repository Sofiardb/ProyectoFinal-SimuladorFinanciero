using Dapper;
using SimuladorFinanciero.Api.DTOs.Portfolio;
using SimuladorFinanciero.Api.Infrastructure.Database;
using SimuladorFinanciero.Api.Models;

namespace SimuladorFinanciero.Api.Repositories;

// ── Datos para actualizar un plazo fijo (ya mergeados en el servicio) ─────────
public sealed class ActualizarPlazoFijoData
{
    public required int      IdTipoPlazoFijo         { get; init; }
    public required int      IdMoneda                { get; init; }
    public required string   EntidadFinanciera        { get; init; }
    public required decimal  MontoInvertido           { get; init; }
    public required decimal  TnaPactada              { get; init; }
    public required DateOnly FechaInicio              { get; init; }
    public required int      DuracionDias            { get; init; }
    public required bool     ReinvertirAlVencimiento  { get; init; }
}

public interface IPortfolioRepository
{
    // Portfolio CRUD
    Task<IReadOnlyList<PortfolioResumenResponse>> ObtenerPorUsuarioAsync(long idUsuario, CancellationToken ct = default);
    Task<PortfolioDetalleResponse?> ObtenerDetalleAsync(long idPortfolio, long idUsuario, CancellationToken ct = default);
    Task<Portfolio?> ObtenerCabeceraAsync(long idPortfolio, long idUsuario, CancellationToken ct = default);
    Task<PortfolioResumenResponse> CrearAsync(long idUsuario, CrearPortfolioRequest req, CancellationToken ct = default);
    Task<PortfolioResumenResponse?> ActualizarAsync(long idPortfolio, long idUsuario, string nombre, string? descripcion, int idPerfilRiesgo, int idMonedaBase, decimal? capitalInicial, int horizonteMeses, string estado, CancellationToken ct = default);
    Task<(decimal TotalUsd, decimal TotalArs)> ObtenerTotalInvertidoPorMonedaAsync(long idPortfolio, CancellationToken ct = default);
    Task<bool> EliminarAsync(long idPortfolio, long idUsuario, CancellationToken ct = default);

    // Validaciones de catálogo
    Task<bool> ExistePerfilRiesgoAsync(int idPerfilRiesgo, CancellationToken ct = default);
    Task<bool> ExisteMonedaAsync(int idMoneda, CancellationToken ct = default);
    Task<string?> ObtenerCodigoMonedaAsync(int idMoneda, CancellationToken ct = default);
    Task<bool> ExisteTipoPlazoFijoAsync(int idTipoPlazoFijo, CancellationToken ct = default);
    Task<decimal> ObtenerSigmaMaxAsync(int idPerfilRiesgo, CancellationToken ct = default);
    Task<(bool Activa, decimal? Sigma)?> ObtenerInfoAccionAsync(long idAccion, CancellationToken ct = default);
    Task<bool> ExisteBonoActivoAsync(long idBono, CancellationToken ct = default);
    Task<bool> ExisteLetraActivaAsync(long idLetra, CancellationToken ct = default);
    Task<bool> ExisteNombreAsync(long idUsuario, string nombre, int idPerfilRiesgo, CancellationToken ct = default);
    Task<bool> ExisteNombreParaOtroAsync(long idUsuario, string nombre, int idPerfilRiesgo, long idPortfolio, CancellationToken ct = default);
    Task<bool> AccionesCompatiblesConPerfilAsync(long idPortfolio, int idPerfilRiesgo, CancellationToken ct = default);

    // Tenencias — Acciones
    Task<bool> ExisteAccionEnPortfolioAsync(long idPortfolio, long idAccion, CancellationToken ct = default);
    Task<PortfolioAccionResponse?> ObtenerAccionTenenciaAsync(long idPortfolio, long idAccion, CancellationToken ct = default);
    Task<PortfolioAccionResponse> AgregarAccionAsync(long idPortfolio, long idAccion, decimal cantidad, decimal precioCompra, CancellationToken ct = default);
    Task<PortfolioAccionResponse?> ActualizarAccionAsync(long idPortfolio, long idAccion, decimal cantidad, decimal precioCompra, CancellationToken ct = default);
    Task<bool> EliminarAccionAsync(long idPortfolio, long idAccion, CancellationToken ct = default);

    // Tenencias — Bonos
    Task<bool> ExisteBonoEnPortfolioAsync(long idPortfolio, long idBono, CancellationToken ct = default);
    Task<PortfolioBonoResponse?> ObtenerBonoTenenciaAsync(long idPortfolio, long idBono, CancellationToken ct = default);
    Task<PortfolioBonoResponse> AgregarBonoAsync(long idPortfolio, long idBono, decimal cantidad, decimal precioCompra, CancellationToken ct = default);
    Task<PortfolioBonoResponse?> ActualizarBonoAsync(long idPortfolio, long idBono, decimal cantidad, decimal precioCompra, CancellationToken ct = default);
    Task<bool> EliminarBonoAsync(long idPortfolio, long idBono, CancellationToken ct = default);

    // Tenencias — Letras
    Task<bool> ExisteLetraEnPortfolioAsync(long idPortfolio, long idLetra, CancellationToken ct = default);
    Task<PortfolioLetraResponse?> ObtenerLetraTenenciaAsync(long idPortfolio, long idLetra, CancellationToken ct = default);
    Task<PortfolioLetraResponse> AgregarLetraAsync(long idPortfolio, long idLetra, decimal cantidad, decimal precioCompra, CancellationToken ct = default);
    Task<PortfolioLetraResponse?> ActualizarLetraAsync(long idPortfolio, long idLetra, decimal cantidad, decimal precioCompra, CancellationToken ct = default);
    Task<bool> EliminarLetraAsync(long idPortfolio, long idLetra, CancellationToken ct = default);

    // Tenencias — Plazos Fijos
    Task<PortfolioPlazoFijoResponse?> ObtenerPlazoFijoTenenciaAsync(long idPortfolioPlazoFijo, long idPortfolio, CancellationToken ct = default);
    Task<PortfolioPlazoFijoResponse> AgregarPlazoFijoAsync(long idPortfolio, AgregarPlazoFijoRequest req, CancellationToken ct = default);
    Task<PortfolioPlazoFijoResponse?> ActualizarPlazoFijoAsync(long idPortfolioPlazoFijo, long idPortfolio, ActualizarPlazoFijoData data, CancellationToken ct = default);
    Task<bool> EliminarPlazoFijoAsync(long idPortfolioPlazoFijo, long idPortfolio, CancellationToken ct = default);
}

public sealed class PortfolioRepository : IPortfolioRepository
{
    private readonly IDbConnectionFactory _db;

    public PortfolioRepository(IDbConnectionFactory db) => _db = db;

    // ── SQL compartido ────────────────────────────────────────────────────────

    private const string PortfolioHeaderSql = """
        SELECT p.id_portfolio,
               p.nombre,
               p.descripcion,
               p.id_perfil_riesgo::int,
               pr.nombre AS nombre_perfil_riesgo,
               p.id_moneda_base::int,
               m.codigo_iso AS codigo_moneda_base,
               p.capital_inicial,
               p.horizonte_meses::int,
               p.fecha_creacion,
               p.fecha_modificacion,
               p.estado
        FROM portfolio p
        JOIN perfil_riesgo pr ON pr.id_perfil_riesgo = p.id_perfil_riesgo
        JOIN moneda        m  ON m.id_moneda          = p.id_moneda_base
        """;

    private const string AccionTenenciaSql = """
        SELECT pa.id_portfolio_accion,
               pa.id_accion,
               pa.cantidad,
               pa.precio_compra,
               a.ticker,
               a.nombre,
               a.sector,
               a.mu_retorno_esperado,
               a.sigma_volatilidad,
               a.precio_actual
        FROM portfolio_accion pa
        JOIN accion a ON a.id_accion = pa.id_accion
        """;

    private const string BonoTenenciaSql = """
        SELECT pb.id_portfolio_bono,
               pb.id_bono,
               pb.cantidad,
               pb.precio_compra,
               b.ticker,
               b.nombre,
               b.emisor,
               b.precio_actual
        FROM portfolio_bono pb
        JOIN bono b ON b.id_bono = pb.id_bono
        """;

    private const string LetraTenenciaSql = """
        SELECT pl.id_portfolio_letra,
               pl.id_letra,
               pl.cantidad,
               pl.precio_compra,
               l.ticker,
               l.nombre,
               l.tasa,
               l.fecha_vencimiento,
               l.precio_actual
        FROM portfolio_letra pl
        JOIN letra l ON l.id_letra = pl.id_letra
        """;

    private const string PlazoFijoTenenciaSql = """
        SELECT ppf.id_portfolio_plazo_fijo,
               ppf.id_tipo_plazo_fijo::int,
               tpf.nombre AS nombre_tipo_plazo_fijo,
               ppf.id_moneda::int,
               m.codigo_iso AS codigo_moneda,
               ppf.entidad_financiera,
               ppf.monto_invertido,
               ppf.tna_pactada,
               ppf.fecha_inicio,
               ppf.duracion_dias::int,
               ppf.reinvertir_al_vencimiento
        FROM portfolio_plazo_fijo ppf
        JOIN tipo_plazo_fijo tpf ON tpf.id_tipo_plazo_fijo = ppf.id_tipo_plazo_fijo
        JOIN moneda          m   ON m.id_moneda             = ppf.id_moneda
        """;

    // ── Filas internas de Dapper ──────────────────────────────────────────────

    private sealed class PortfolioHeaderRow
    {
        public long     IdPortfolio        { get; set; }
        public string   Nombre             { get; set; } = "";
        public string?  Descripcion        { get; set; }
        public int      IdPerfilRiesgo     { get; set; }
        public string   NombrePerfilRiesgo { get; set; } = "";
        public int      IdMonedaBase       { get; set; }
        public string   CodigoMonedaBase   { get; set; } = "";
        public decimal? CapitalInicial     { get; set; }
        public int      HorizonteMeses     { get; set; }
        public DateTimeOffset FechaCreacion     { get; set; }
        public DateTimeOffset FechaModificacion { get; set; }
        public string   Estado             { get; set; } = "ACTIVO";
    }

    private sealed class AccionTenenciaRow
    {
        public long     IdPortfolioAccion  { get; set; }
        public long     IdAccion           { get; set; }
        public decimal  Cantidad           { get; set; }
        public decimal  PrecioCompra       { get; set; }
        public string   Ticker             { get; set; } = "";
        public string   Nombre             { get; set; } = "";
        public string?  Sector             { get; set; }
        public decimal? MuRetornoEsperado  { get; set; }
        public decimal? SigmaVolatilidad   { get; set; }
        public decimal? PrecioActual       { get; set; }
    }

    private sealed class BonoTenenciaRow
    {
        public long    IdPortfolioBono { get; set; }
        public long    IdBono          { get; set; }
        public decimal Cantidad        { get; set; }
        public decimal PrecioCompra    { get; set; }
        public string  Ticker          { get; set; } = "";
        public string  Nombre          { get; set; } = "";
        public string? Emisor          { get; set; }
        public decimal? PrecioActual   { get; set; }
    }

    private sealed class LetraTenenciaRow
    {
        public long    IdPortfolioLetra  { get; set; }
        public long    IdLetra           { get; set; }
        public decimal Cantidad          { get; set; }
        public decimal PrecioCompra      { get; set; }
        public string  Ticker            { get; set; } = "";
        public string  Nombre            { get; set; } = "";
        public decimal Tasa              { get; set; }
        public DateOnly FechaVencimiento { get; set; }
        public decimal? PrecioActual     { get; set; }
    }

    private sealed class PlazoFijoTenenciaRow
    {
        public long    IdPortfolioPlazoFijo     { get; set; }
        public int     IdTipoPlazoFijo          { get; set; }
        public string  NombreTipoPlazoFijo      { get; set; } = "";
        public int     IdMoneda                 { get; set; }
        public string  CodigoMoneda             { get; set; } = "";
        public string  EntidadFinanciera        { get; set; } = "";
        public decimal MontoInvertido           { get; set; }
        public decimal TnaPactada              { get; set; }
        public DateOnly FechaInicio             { get; set; }
        public int     DuracionDias            { get; set; }
        public bool    ReinvertirAlVencimiento  { get; set; }
    }

    // ── Mappers ───────────────────────────────────────────────────────────────

    private static PortfolioResumenResponse ToResumen(PortfolioHeaderRow r) => new(
        r.IdPortfolio, r.Nombre, r.Descripcion,
        r.IdPerfilRiesgo, r.NombrePerfilRiesgo,
        r.IdMonedaBase, r.CodigoMonedaBase,
        r.CapitalInicial, r.HorizonteMeses,
        r.FechaCreacion, r.FechaModificacion, r.Estado);

    private static PortfolioAccionResponse ToAccion(AccionTenenciaRow r) => new(
        r.IdPortfolioAccion, r.IdAccion, r.Ticker, r.Nombre, r.Sector,
        r.MuRetornoEsperado, r.SigmaVolatilidad, r.PrecioActual,
        r.Cantidad, r.PrecioCompra);

    private static PortfolioBonoResponse ToBono(BonoTenenciaRow r) => new(
        r.IdPortfolioBono, r.IdBono, r.Ticker, r.Nombre, r.Emisor,
        r.PrecioActual, r.Cantidad, r.PrecioCompra);

    private static PortfolioLetraResponse ToLetra(LetraTenenciaRow r) => new(
        r.IdPortfolioLetra, r.IdLetra, r.Ticker, r.Nombre,
        r.Tasa, r.FechaVencimiento, r.PrecioActual, r.Cantidad, r.PrecioCompra);

    private static PortfolioPlazoFijoResponse ToPlazoFijo(PlazoFijoTenenciaRow r) => new(
        r.IdPortfolioPlazoFijo, r.IdTipoPlazoFijo, r.NombreTipoPlazoFijo,
        r.IdMoneda, r.CodigoMoneda, r.EntidadFinanciera,
        r.MontoInvertido, r.TnaPactada, r.FechaInicio,
        r.DuracionDias, r.ReinvertirAlVencimiento);

    // ── Portfolio CRUD ────────────────────────────────────────────────────────

    public async Task<IReadOnlyList<PortfolioResumenResponse>> ObtenerPorUsuarioAsync(long idUsuario, CancellationToken ct = default)
    {
        using var conn = _db.Crear();
        var sql = PortfolioHeaderSql + " WHERE p.id_usuario = @idUsuario ORDER BY p.fecha_modificacion DESC";
        var rows = await conn.QueryAsync<PortfolioHeaderRow>(new CommandDefinition(sql, new { idUsuario }, cancellationToken: ct));
        return rows.Select(ToResumen).ToList();
    }

    public async Task<PortfolioDetalleResponse?> ObtenerDetalleAsync(long idPortfolio, long idUsuario, CancellationToken ct = default)
    {
        using var conn = _db.Crear();

        var header = await conn.QuerySingleOrDefaultAsync<PortfolioHeaderRow>(
            new CommandDefinition(
                PortfolioHeaderSql + " WHERE p.id_portfolio = @idPortfolio AND p.id_usuario = @idUsuario",
                new { idPortfolio, idUsuario }, cancellationToken: ct));

        if (header is null) return null;

        var acciones = (await conn.QueryAsync<AccionTenenciaRow>(
            new CommandDefinition(
                AccionTenenciaSql + " WHERE pa.id_portfolio = @idPortfolio ORDER BY a.ticker",
                new { idPortfolio }, cancellationToken: ct))).Select(ToAccion).ToList();

        var bonos = (await conn.QueryAsync<BonoTenenciaRow>(
            new CommandDefinition(
                BonoTenenciaSql + " WHERE pb.id_portfolio = @idPortfolio ORDER BY b.ticker",
                new { idPortfolio }, cancellationToken: ct))).Select(ToBono).ToList();

        var letras = (await conn.QueryAsync<LetraTenenciaRow>(
            new CommandDefinition(
                LetraTenenciaSql + " WHERE pl.id_portfolio = @idPortfolio ORDER BY l.ticker",
                new { idPortfolio }, cancellationToken: ct))).Select(ToLetra).ToList();

        var plazosFijos = (await conn.QueryAsync<PlazoFijoTenenciaRow>(
            new CommandDefinition(
                PlazoFijoTenenciaSql + " WHERE ppf.id_portfolio = @idPortfolio ORDER BY ppf.fecha_inicio",
                new { idPortfolio }, cancellationToken: ct))).Select(ToPlazoFijo).ToList();

        return new PortfolioDetalleResponse(
            header.IdPortfolio, header.Nombre, header.Descripcion,
            header.IdPerfilRiesgo, header.NombrePerfilRiesgo,
            header.IdMonedaBase, header.CodigoMonedaBase,
            header.CapitalInicial, header.HorizonteMeses,
            header.FechaCreacion, header.FechaModificacion, header.Estado,
            acciones, bonos, letras, plazosFijos);
    }

    public async Task<Portfolio?> ObtenerCabeceraAsync(long idPortfolio, long idUsuario, CancellationToken ct = default)
    {
        using var conn = _db.Crear();
        const string sql = """
            SELECT p.id_portfolio, p.id_usuario,
                   p.id_perfil_riesgo::int, p.id_moneda_base::int,
                   m.codigo_iso AS codigo_moneda_base,
                   p.nombre, p.descripcion, p.capital_inicial,
                   p.horizonte_meses::int,
                   p.fecha_creacion, p.fecha_modificacion, p.estado
            FROM portfolio p
            JOIN moneda m ON m.id_moneda = p.id_moneda_base
            WHERE p.id_portfolio = @idPortfolio AND p.id_usuario = @idUsuario
            """;
        return await conn.QuerySingleOrDefaultAsync<Portfolio>(
            new CommandDefinition(sql, new { idPortfolio, idUsuario }, cancellationToken: ct));
    }

    public async Task<PortfolioResumenResponse> CrearAsync(long idUsuario, CrearPortfolioRequest req, CancellationToken ct = default)
    {
        using var conn = _db.Crear();
        const string sql = """
            WITH ins AS (
                INSERT INTO portfolio (id_usuario, id_perfil_riesgo, id_moneda_base, nombre, descripcion, capital_inicial, horizonte_meses)
                VALUES (@idUsuario, @IdPerfilRiesgo::smallint, @IdMonedaBase::smallint, @Nombre, @Descripcion, @CapitalInicial, @HorizonteMeses::smallint)
                RETURNING *
            )
            SELECT ins.id_portfolio,
                   ins.nombre,
                   ins.descripcion,
                   ins.id_perfil_riesgo::int,
                   pr.nombre AS nombre_perfil_riesgo,
                   ins.id_moneda_base::int,
                   m.codigo_iso AS codigo_moneda_base,
                   ins.capital_inicial,
                   ins.horizonte_meses::int,
                   ins.fecha_creacion,
                   ins.fecha_modificacion,
                   ins.estado
            FROM ins
            JOIN perfil_riesgo pr ON pr.id_perfil_riesgo = ins.id_perfil_riesgo
            JOIN moneda        m  ON m.id_moneda          = ins.id_moneda_base
            """;
        var row = await conn.QuerySingleAsync<PortfolioHeaderRow>(
            new CommandDefinition(sql,
                new { idUsuario, req.IdPerfilRiesgo, req.IdMonedaBase, req.Nombre, req.Descripcion, req.CapitalInicial, req.HorizonteMeses },
                cancellationToken: ct));
        return ToResumen(row);
    }

    public async Task<PortfolioResumenResponse?> ActualizarAsync(long idPortfolio, long idUsuario, string nombre, string? descripcion, int idPerfilRiesgo, int idMonedaBase, decimal? capitalInicial, int horizonteMeses, string estado, CancellationToken ct = default)
    {
        using var conn = _db.Crear();
        const string sql = """
            WITH upd AS (
                UPDATE portfolio SET
                    nombre             = @nombre,
                    descripcion        = @descripcion,
                    id_perfil_riesgo   = @idPerfilRiesgo::smallint,
                    id_moneda_base     = @idMonedaBase::smallint,
                    capital_inicial    = @capitalInicial,
                    horizonte_meses    = @horizonteMeses::smallint,
                    estado             = @estado,
                    fecha_modificacion = NOW()
                WHERE id_portfolio = @idPortfolio AND id_usuario = @idUsuario
                RETURNING *
            )
            SELECT upd.id_portfolio,
                   upd.nombre,
                   upd.descripcion,
                   upd.id_perfil_riesgo::int,
                   pr.nombre AS nombre_perfil_riesgo,
                   upd.id_moneda_base::int,
                   m.codigo_iso AS codigo_moneda_base,
                   upd.capital_inicial,
                   upd.horizonte_meses::int,
                   upd.fecha_creacion,
                   upd.fecha_modificacion,
                   upd.estado
            FROM upd
            JOIN perfil_riesgo pr ON pr.id_perfil_riesgo = upd.id_perfil_riesgo
            JOIN moneda        m  ON m.id_moneda          = upd.id_moneda_base
            """;
        var row = await conn.QuerySingleOrDefaultAsync<PortfolioHeaderRow>(
            new CommandDefinition(sql,
                new { idPortfolio, idUsuario, nombre, descripcion, idPerfilRiesgo, idMonedaBase, capitalInicial, horizonteMeses, estado },
                cancellationToken: ct));
        return row is null ? null : ToResumen(row);
    }

    public async Task<bool> EliminarAsync(long idPortfolio, long idUsuario, CancellationToken ct = default)
    {
        using var conn = _db.Crear();
        var affected = await conn.ExecuteAsync(
            new CommandDefinition(
                "DELETE FROM portfolio WHERE id_portfolio = @idPortfolio AND id_usuario = @idUsuario",
                new { idPortfolio, idUsuario }, cancellationToken: ct));
        return affected > 0;
    }

    // ── Validaciones de catálogo ──────────────────────────────────────────────

    public async Task<bool> ExistePerfilRiesgoAsync(int idPerfilRiesgo, CancellationToken ct = default)
    {
        using var conn = _db.Crear();
        return await conn.ExecuteScalarAsync<bool>(
            new CommandDefinition(
                "SELECT EXISTS(SELECT 1 FROM perfil_riesgo WHERE id_perfil_riesgo = @idPerfilRiesgo::smallint)",
                new { idPerfilRiesgo }, cancellationToken: ct));
    }

    public async Task<bool> ExisteMonedaAsync(int idMoneda, CancellationToken ct = default)
    {
        using var conn = _db.Crear();
        return await conn.ExecuteScalarAsync<bool>(
            new CommandDefinition(
                "SELECT EXISTS(SELECT 1 FROM moneda WHERE id_moneda = @idMoneda::smallint)",
                new { idMoneda }, cancellationToken: ct));
    }

    public async Task<string?> ObtenerCodigoMonedaAsync(int idMoneda, CancellationToken ct = default)
    {
        using var conn = _db.Crear();
        return await conn.ExecuteScalarAsync<string?>(
            new CommandDefinition(
                "SELECT codigo_iso FROM moneda WHERE id_moneda = @idMoneda::smallint",
                new { idMoneda }, cancellationToken: ct));
    }

    public async Task<bool> ExisteTipoPlazoFijoAsync(int idTipoPlazoFijo, CancellationToken ct = default)
    {
        using var conn = _db.Crear();
        return await conn.ExecuteScalarAsync<bool>(
            new CommandDefinition(
                "SELECT EXISTS(SELECT 1 FROM tipo_plazo_fijo WHERE id_tipo_plazo_fijo = @idTipoPlazoFijo::smallint)",
                new { idTipoPlazoFijo }, cancellationToken: ct));
    }

    public async Task<decimal> ObtenerSigmaMaxAsync(int idPerfilRiesgo, CancellationToken ct = default)
    {
        using var conn = _db.Crear();
        return await conn.ExecuteScalarAsync<decimal>(
            new CommandDefinition(
                "SELECT sigma_max_accion FROM perfil_riesgo WHERE id_perfil_riesgo = @idPerfilRiesgo::smallint",
                new { idPerfilRiesgo }, cancellationToken: ct));
    }

    private sealed class AccionInfoRow
    {
        public bool     Activo           { get; set; }
        public decimal? SigmaVolatilidad { get; set; }
    }

    public async Task<(bool Activa, decimal? Sigma)?> ObtenerInfoAccionAsync(long idAccion, CancellationToken ct = default)
    {
        using var conn = _db.Crear();
        var row = await conn.QuerySingleOrDefaultAsync<AccionInfoRow>(
            new CommandDefinition(
                "SELECT activo, sigma_volatilidad FROM accion WHERE id_accion = @idAccion",
                new { idAccion }, cancellationToken: ct));
        return row is null ? null : (row.Activo, row.SigmaVolatilidad);
    }

    public async Task<bool> ExisteBonoActivoAsync(long idBono, CancellationToken ct = default)
    {
        using var conn = _db.Crear();
        return await conn.ExecuteScalarAsync<bool>(
            new CommandDefinition(
                "SELECT EXISTS(SELECT 1 FROM bono WHERE id_bono = @idBono AND activo = TRUE)",
                new { idBono }, cancellationToken: ct));
    }

    public async Task<bool> ExisteLetraActivaAsync(long idLetra, CancellationToken ct = default)
    {
        using var conn = _db.Crear();
        return await conn.ExecuteScalarAsync<bool>(
            new CommandDefinition(
                "SELECT EXISTS(SELECT 1 FROM letra WHERE id_letra = @idLetra AND activo = TRUE)",
                new { idLetra }, cancellationToken: ct));
    }

    public async Task<bool> ExisteNombreAsync(long idUsuario, string nombre, int idPerfilRiesgo, CancellationToken ct = default)
    {
        using var conn = _db.Crear();
        return await conn.ExecuteScalarAsync<bool>(
            new CommandDefinition(
                "SELECT EXISTS(SELECT 1 FROM portfolio WHERE id_usuario = @idUsuario AND nombre = @nombre AND id_perfil_riesgo = @idPerfilRiesgo)",
                new { idUsuario, nombre, idPerfilRiesgo }, cancellationToken: ct));
    }

    public async Task<bool> ExisteNombreParaOtroAsync(long idUsuario, string nombre, int idPerfilRiesgo, long idPortfolio, CancellationToken ct = default)
    {
        using var conn = _db.Crear();
        return await conn.ExecuteScalarAsync<bool>(
            new CommandDefinition(
                "SELECT EXISTS(SELECT 1 FROM portfolio WHERE id_usuario = @idUsuario AND nombre = @nombre AND id_perfil_riesgo = @idPerfilRiesgo AND id_portfolio <> @idPortfolio)",
                new { idUsuario, nombre, idPerfilRiesgo, idPortfolio }, cancellationToken: ct));
    }

    public async Task<bool> AccionesCompatiblesConPerfilAsync(long idPortfolio, int idPerfilRiesgo, CancellationToken ct = default)
    {
        using var conn = _db.Crear();
        // Retorna TRUE si todas las acciones del portfolio cumplen sigma <= sigma_max del nuevo perfil.
        return await conn.ExecuteScalarAsync<bool>(
            new CommandDefinition("""
                SELECT NOT EXISTS (
                    SELECT 1
                    FROM portfolio_accion pa
                    JOIN accion       a  ON a.id_accion       = pa.id_accion
                    JOIN perfil_riesgo pr ON pr.id_perfil_riesgo = @idPerfilRiesgo::smallint
                    WHERE pa.id_portfolio = @idPortfolio
                      AND a.sigma_volatilidad IS NOT NULL
                      AND a.sigma_volatilidad > pr.sigma_max_accion
                )
                """,
                new { idPortfolio, idPerfilRiesgo }, cancellationToken: ct));
    }

    // ── Tenencias — Acciones ──────────────────────────────────────────────────

    public async Task<bool> ExisteAccionEnPortfolioAsync(long idPortfolio, long idAccion, CancellationToken ct = default)
    {
        using var conn = _db.Crear();
        return await conn.ExecuteScalarAsync<bool>(
            new CommandDefinition(
                "SELECT EXISTS(SELECT 1 FROM portfolio_accion WHERE id_portfolio = @idPortfolio AND id_accion = @idAccion)",
                new { idPortfolio, idAccion }, cancellationToken: ct));
    }

    public async Task<PortfolioAccionResponse?> ObtenerAccionTenenciaAsync(long idPortfolio, long idAccion, CancellationToken ct = default)
    {
        using var conn = _db.Crear();
        var row = await conn.QuerySingleOrDefaultAsync<AccionTenenciaRow>(
            new CommandDefinition(
                AccionTenenciaSql + " WHERE pa.id_portfolio = @idPortfolio AND pa.id_accion = @idAccion",
                new { idPortfolio, idAccion }, cancellationToken: ct));
        return row is null ? null : ToAccion(row);
    }

    public async Task<PortfolioAccionResponse> AgregarAccionAsync(long idPortfolio, long idAccion, decimal cantidad, decimal precioCompra, CancellationToken ct = default)
    {
        using var conn = _db.Crear();
        conn.Open();
        using var tx = conn.BeginTransaction();

        const string sql = """
            WITH ins AS (
                INSERT INTO portfolio_accion (id_portfolio, id_accion, cantidad, precio_compra)
                VALUES (@idPortfolio, @idAccion, @cantidad, @precioCompra)
                RETURNING id_portfolio_accion, id_accion, cantidad, precio_compra
            )
            SELECT ins.id_portfolio_accion,
                   ins.id_accion,
                   ins.cantidad,
                   ins.precio_compra,
                   a.ticker, a.nombre, a.sector,
                   a.mu_retorno_esperado, a.sigma_volatilidad, a.precio_actual
            FROM ins
            JOIN accion a ON a.id_accion = ins.id_accion
            """;
        var row = await conn.QuerySingleAsync<AccionTenenciaRow>(
            new CommandDefinition(sql, new { idPortfolio, idAccion, cantidad, precioCompra }, transaction: tx, cancellationToken: ct));

        await TouchPortfolioAsync(conn, idPortfolio, tx, ct);
        tx.Commit();
        return ToAccion(row);
    }

    public async Task<PortfolioAccionResponse?> ActualizarAccionAsync(long idPortfolio, long idAccion, decimal cantidad, decimal precioCompra, CancellationToken ct = default)
    {
        using var conn = _db.Crear();
        conn.Open();
        using var tx = conn.BeginTransaction();

        const string sql = """
            WITH upd AS (
                UPDATE portfolio_accion SET cantidad = @cantidad, precio_compra = @precioCompra
                WHERE id_portfolio = @idPortfolio AND id_accion = @idAccion
                RETURNING id_portfolio_accion, id_accion, cantidad, precio_compra
            )
            SELECT upd.id_portfolio_accion, upd.id_accion, upd.cantidad, upd.precio_compra,
                   a.ticker, a.nombre, a.sector,
                   a.mu_retorno_esperado, a.sigma_volatilidad, a.precio_actual
            FROM upd
            JOIN accion a ON a.id_accion = upd.id_accion
            """;
        var row = await conn.QuerySingleOrDefaultAsync<AccionTenenciaRow>(
            new CommandDefinition(sql, new { idPortfolio, idAccion, cantidad, precioCompra }, transaction: tx, cancellationToken: ct));

        if (row is null) { tx.Rollback(); return null; }

        await TouchPortfolioAsync(conn, idPortfolio, tx, ct);
        tx.Commit();
        return ToAccion(row);
    }

    public async Task<bool> EliminarAccionAsync(long idPortfolio, long idAccion, CancellationToken ct = default)
    {
        using var conn = _db.Crear();
        conn.Open();
        using var tx = conn.BeginTransaction();

        var affected = await conn.ExecuteAsync(
            new CommandDefinition(
                "DELETE FROM portfolio_accion WHERE id_portfolio = @idPortfolio AND id_accion = @idAccion",
                new { idPortfolio, idAccion }, transaction: tx, cancellationToken: ct));

        if (affected == 0) { tx.Rollback(); return false; }

        await TouchPortfolioAsync(conn, idPortfolio, tx, ct);
        tx.Commit();
        return true;
    }

    // ── Tenencias — Bonos ─────────────────────────────────────────────────────

    public async Task<bool> ExisteBonoEnPortfolioAsync(long idPortfolio, long idBono, CancellationToken ct = default)
    {
        using var conn = _db.Crear();
        return await conn.ExecuteScalarAsync<bool>(
            new CommandDefinition(
                "SELECT EXISTS(SELECT 1 FROM portfolio_bono WHERE id_portfolio = @idPortfolio AND id_bono = @idBono)",
                new { idPortfolio, idBono }, cancellationToken: ct));
    }

    public async Task<PortfolioBonoResponse?> ObtenerBonoTenenciaAsync(long idPortfolio, long idBono, CancellationToken ct = default)
    {
        using var conn = _db.Crear();
        var row = await conn.QuerySingleOrDefaultAsync<BonoTenenciaRow>(
            new CommandDefinition(
                BonoTenenciaSql + " WHERE pb.id_portfolio = @idPortfolio AND pb.id_bono = @idBono",
                new { idPortfolio, idBono }, cancellationToken: ct));
        return row is null ? null : ToBono(row);
    }

    public async Task<PortfolioBonoResponse> AgregarBonoAsync(long idPortfolio, long idBono, decimal cantidad, decimal precioCompra, CancellationToken ct = default)
    {
        using var conn = _db.Crear();
        conn.Open();
        using var tx = conn.BeginTransaction();

        const string sql = """
            WITH ins AS (
                INSERT INTO portfolio_bono (id_portfolio, id_bono, cantidad, precio_compra)
                VALUES (@idPortfolio, @idBono, @cantidad, @precioCompra)
                RETURNING id_portfolio_bono, id_bono, cantidad, precio_compra
            )
            SELECT ins.id_portfolio_bono, ins.id_bono, ins.cantidad, ins.precio_compra,
                   b.ticker, b.nombre, b.emisor, b.precio_actual
            FROM ins
            JOIN bono b ON b.id_bono = ins.id_bono
            """;
        var row = await conn.QuerySingleAsync<BonoTenenciaRow>(
            new CommandDefinition(sql, new { idPortfolio, idBono, cantidad, precioCompra }, transaction: tx, cancellationToken: ct));

        await TouchPortfolioAsync(conn, idPortfolio, tx, ct);
        tx.Commit();
        return ToBono(row);
    }

    public async Task<PortfolioBonoResponse?> ActualizarBonoAsync(long idPortfolio, long idBono, decimal cantidad, decimal precioCompra, CancellationToken ct = default)
    {
        using var conn = _db.Crear();
        conn.Open();
        using var tx = conn.BeginTransaction();

        const string sql = """
            WITH upd AS (
                UPDATE portfolio_bono SET cantidad = @cantidad, precio_compra = @precioCompra
                WHERE id_portfolio = @idPortfolio AND id_bono = @idBono
                RETURNING id_portfolio_bono, id_bono, cantidad, precio_compra
            )
            SELECT upd.id_portfolio_bono, upd.id_bono, upd.cantidad, upd.precio_compra,
                   b.ticker, b.nombre, b.emisor, b.precio_actual
            FROM upd
            JOIN bono b ON b.id_bono = upd.id_bono
            """;
        var row = await conn.QuerySingleOrDefaultAsync<BonoTenenciaRow>(
            new CommandDefinition(sql, new { idPortfolio, idBono, cantidad, precioCompra }, transaction: tx, cancellationToken: ct));

        if (row is null) { tx.Rollback(); return null; }

        await TouchPortfolioAsync(conn, idPortfolio, tx, ct);
        tx.Commit();
        return ToBono(row);
    }

    public async Task<bool> EliminarBonoAsync(long idPortfolio, long idBono, CancellationToken ct = default)
    {
        using var conn = _db.Crear();
        conn.Open();
        using var tx = conn.BeginTransaction();

        var affected = await conn.ExecuteAsync(
            new CommandDefinition(
                "DELETE FROM portfolio_bono WHERE id_portfolio = @idPortfolio AND id_bono = @idBono",
                new { idPortfolio, idBono }, transaction: tx, cancellationToken: ct));

        if (affected == 0) { tx.Rollback(); return false; }

        await TouchPortfolioAsync(conn, idPortfolio, tx, ct);
        tx.Commit();
        return true;
    }

    // ── Tenencias — Letras ────────────────────────────────────────────────────

    public async Task<bool> ExisteLetraEnPortfolioAsync(long idPortfolio, long idLetra, CancellationToken ct = default)
    {
        using var conn = _db.Crear();
        return await conn.ExecuteScalarAsync<bool>(
            new CommandDefinition(
                "SELECT EXISTS(SELECT 1 FROM portfolio_letra WHERE id_portfolio = @idPortfolio AND id_letra = @idLetra)",
                new { idPortfolio, idLetra }, cancellationToken: ct));
    }

    public async Task<PortfolioLetraResponse?> ObtenerLetraTenenciaAsync(long idPortfolio, long idLetra, CancellationToken ct = default)
    {
        using var conn = _db.Crear();
        var row = await conn.QuerySingleOrDefaultAsync<LetraTenenciaRow>(
            new CommandDefinition(
                LetraTenenciaSql + " WHERE pl.id_portfolio = @idPortfolio AND pl.id_letra = @idLetra",
                new { idPortfolio, idLetra }, cancellationToken: ct));
        return row is null ? null : ToLetra(row);
    }

    public async Task<PortfolioLetraResponse> AgregarLetraAsync(long idPortfolio, long idLetra, decimal cantidad, decimal precioCompra, CancellationToken ct = default)
    {
        using var conn = _db.Crear();
        conn.Open();
        using var tx = conn.BeginTransaction();

        const string sql = """
            WITH ins AS (
                INSERT INTO portfolio_letra (id_portfolio, id_letra, cantidad, precio_compra)
                VALUES (@idPortfolio, @idLetra, @cantidad, @precioCompra)
                RETURNING id_portfolio_letra, id_letra, cantidad, precio_compra
            )
            SELECT ins.id_portfolio_letra, ins.id_letra, ins.cantidad, ins.precio_compra,
                   l.ticker, l.nombre, l.tasa, l.fecha_vencimiento, l.precio_actual
            FROM ins
            JOIN letra l ON l.id_letra = ins.id_letra
            """;
        var row = await conn.QuerySingleAsync<LetraTenenciaRow>(
            new CommandDefinition(sql, new { idPortfolio, idLetra, cantidad, precioCompra }, transaction: tx, cancellationToken: ct));

        await TouchPortfolioAsync(conn, idPortfolio, tx, ct);
        tx.Commit();
        return ToLetra(row);
    }

    public async Task<PortfolioLetraResponse?> ActualizarLetraAsync(long idPortfolio, long idLetra, decimal cantidad, decimal precioCompra, CancellationToken ct = default)
    {
        using var conn = _db.Crear();
        conn.Open();
        using var tx = conn.BeginTransaction();

        const string sql = """
            WITH upd AS (
                UPDATE portfolio_letra SET cantidad = @cantidad, precio_compra = @precioCompra
                WHERE id_portfolio = @idPortfolio AND id_letra = @idLetra
                RETURNING id_portfolio_letra, id_letra, cantidad, precio_compra
            )
            SELECT upd.id_portfolio_letra, upd.id_letra, upd.cantidad, upd.precio_compra,
                   l.ticker, l.nombre, l.tasa, l.fecha_vencimiento, l.precio_actual
            FROM upd
            JOIN letra l ON l.id_letra = upd.id_letra
            """;
        var row = await conn.QuerySingleOrDefaultAsync<LetraTenenciaRow>(
            new CommandDefinition(sql, new { idPortfolio, idLetra, cantidad, precioCompra }, transaction: tx, cancellationToken: ct));

        if (row is null) { tx.Rollback(); return null; }

        await TouchPortfolioAsync(conn, idPortfolio, tx, ct);
        tx.Commit();
        return ToLetra(row);
    }

    public async Task<bool> EliminarLetraAsync(long idPortfolio, long idLetra, CancellationToken ct = default)
    {
        using var conn = _db.Crear();
        conn.Open();
        using var tx = conn.BeginTransaction();

        var affected = await conn.ExecuteAsync(
            new CommandDefinition(
                "DELETE FROM portfolio_letra WHERE id_portfolio = @idPortfolio AND id_letra = @idLetra",
                new { idPortfolio, idLetra }, transaction: tx, cancellationToken: ct));

        if (affected == 0) { tx.Rollback(); return false; }

        await TouchPortfolioAsync(conn, idPortfolio, tx, ct);
        tx.Commit();
        return true;
    }

    // ── Tenencias — Plazos Fijos ──────────────────────────────────────────────

    public async Task<PortfolioPlazoFijoResponse?> ObtenerPlazoFijoTenenciaAsync(long idPortfolioPlazoFijo, long idPortfolio, CancellationToken ct = default)
    {
        using var conn = _db.Crear();
        var row = await conn.QuerySingleOrDefaultAsync<PlazoFijoTenenciaRow>(
            new CommandDefinition(
                PlazoFijoTenenciaSql + " WHERE ppf.id_portfolio_plazo_fijo = @idPortfolioPlazoFijo AND ppf.id_portfolio = @idPortfolio",
                new { idPortfolioPlazoFijo, idPortfolio }, cancellationToken: ct));
        return row is null ? null : ToPlazoFijo(row);
    }

    public async Task<PortfolioPlazoFijoResponse> AgregarPlazoFijoAsync(long idPortfolio, AgregarPlazoFijoRequest req, CancellationToken ct = default)
    {
        using var conn = _db.Crear();
        conn.Open();
        using var tx = conn.BeginTransaction();

        const string sql = """
            WITH ins AS (
                INSERT INTO portfolio_plazo_fijo
                    (id_portfolio, id_tipo_plazo_fijo, id_moneda, entidad_financiera,
                     monto_invertido, tna_pactada, fecha_inicio, duracion_dias, reinvertir_al_vencimiento)
                VALUES
                    (@idPortfolio, @IdTipoPlazoFijo::smallint, @IdMoneda::smallint, @EntidadFinanciera,
                     @MontoInvertido, @TnaPactada, @FechaInicio, @DuracionDias::smallint, @ReinvertirAlVencimiento)
                RETURNING id_portfolio_plazo_fijo, id_tipo_plazo_fijo, id_moneda,
                          entidad_financiera, monto_invertido, tna_pactada,
                          fecha_inicio, duracion_dias, reinvertir_al_vencimiento
            )
            SELECT ins.id_portfolio_plazo_fijo,
                   ins.id_tipo_plazo_fijo::int,
                   tpf.nombre AS nombre_tipo_plazo_fijo,
                   ins.id_moneda::int,
                   m.codigo_iso AS codigo_moneda,
                   ins.entidad_financiera, ins.monto_invertido, ins.tna_pactada,
                   ins.fecha_inicio, ins.duracion_dias::int, ins.reinvertir_al_vencimiento
            FROM ins
            JOIN tipo_plazo_fijo tpf ON tpf.id_tipo_plazo_fijo = ins.id_tipo_plazo_fijo
            JOIN moneda          m   ON m.id_moneda             = ins.id_moneda
            """;
        var row = await conn.QuerySingleAsync<PlazoFijoTenenciaRow>(
            new CommandDefinition(sql,
                new
                {
                    idPortfolio,
                    req.IdTipoPlazoFijo, req.IdMoneda, req.EntidadFinanciera,
                    req.MontoInvertido, req.TnaPactada,
                    FechaInicio = req.FechaInicio!.Value,
                    req.DuracionDias, req.ReinvertirAlVencimiento
                },
                transaction: tx, cancellationToken: ct));

        await TouchPortfolioAsync(conn, idPortfolio, tx, ct);
        tx.Commit();
        return ToPlazoFijo(row);
    }

    public async Task<PortfolioPlazoFijoResponse?> ActualizarPlazoFijoAsync(long idPortfolioPlazoFijo, long idPortfolio, ActualizarPlazoFijoData data, CancellationToken ct = default)
    {
        using var conn = _db.Crear();
        conn.Open();
        using var tx = conn.BeginTransaction();

        const string sql = """
            WITH upd AS (
                UPDATE portfolio_plazo_fijo SET
                    id_tipo_plazo_fijo        = @IdTipoPlazoFijo::smallint,
                    id_moneda                 = @IdMoneda::smallint,
                    entidad_financiera        = @EntidadFinanciera,
                    monto_invertido           = @MontoInvertido,
                    tna_pactada              = @TnaPactada,
                    fecha_inicio              = @FechaInicio,
                    duracion_dias            = @DuracionDias::smallint,
                    reinvertir_al_vencimiento = @ReinvertirAlVencimiento
                WHERE id_portfolio_plazo_fijo = @idPortfolioPlazoFijo AND id_portfolio = @idPortfolio
                RETURNING id_portfolio_plazo_fijo, id_tipo_plazo_fijo, id_moneda,
                          entidad_financiera, monto_invertido, tna_pactada,
                          fecha_inicio, duracion_dias, reinvertir_al_vencimiento
            )
            SELECT upd.id_portfolio_plazo_fijo,
                   upd.id_tipo_plazo_fijo::int,
                   tpf.nombre AS nombre_tipo_plazo_fijo,
                   upd.id_moneda::int,
                   m.codigo_iso AS codigo_moneda,
                   upd.entidad_financiera, upd.monto_invertido, upd.tna_pactada,
                   upd.fecha_inicio, upd.duracion_dias::int, upd.reinvertir_al_vencimiento
            FROM upd
            JOIN tipo_plazo_fijo tpf ON tpf.id_tipo_plazo_fijo = upd.id_tipo_plazo_fijo
            JOIN moneda          m   ON m.id_moneda             = upd.id_moneda
            """;
        var row = await conn.QuerySingleOrDefaultAsync<PlazoFijoTenenciaRow>(
            new CommandDefinition(sql,
                new
                {
                    idPortfolioPlazoFijo, idPortfolio,
                    data.IdTipoPlazoFijo, data.IdMoneda, data.EntidadFinanciera,
                    data.MontoInvertido, data.TnaPactada, data.FechaInicio,
                    data.DuracionDias, data.ReinvertirAlVencimiento
                },
                transaction: tx, cancellationToken: ct));

        if (row is null) { tx.Rollback(); return null; }

        await TouchPortfolioAsync(conn, idPortfolio, tx, ct);
        tx.Commit();
        return ToPlazoFijo(row);
    }

    public async Task<bool> EliminarPlazoFijoAsync(long idPortfolioPlazoFijo, long idPortfolio, CancellationToken ct = default)
    {
        using var conn = _db.Crear();
        conn.Open();
        using var tx = conn.BeginTransaction();

        var affected = await conn.ExecuteAsync(
            new CommandDefinition(
                "DELETE FROM portfolio_plazo_fijo WHERE id_portfolio_plazo_fijo = @idPortfolioPlazoFijo AND id_portfolio = @idPortfolio",
                new { idPortfolioPlazoFijo, idPortfolio }, transaction: tx, cancellationToken: ct));

        if (affected == 0) { tx.Rollback(); return false; }

        await TouchPortfolioAsync(conn, idPortfolio, tx, ct);
        tx.Commit();
        return true;
    }

    // ── Presupuesto ───────────────────────────────────────────────────────────

    private sealed class TotalInvertidoRow
    {
        public decimal TotalUsd { get; set; }
        public decimal TotalArs { get; set; }
    }

    public async Task<(decimal TotalUsd, decimal TotalArs)> ObtenerTotalInvertidoPorMonedaAsync(long idPortfolio, CancellationToken ct = default)
    {
        using var conn = _db.Crear();
        // Acciones siempre cotizan en USD y Bonos/Letras siempre en ARS (ver AccionRepository/BonoRepository/LetraRepository);
        // Plazo Fijo agrupa por su propia moneda.
        const string sql = """
            SELECT
                COALESCE((SELECT SUM(pa.cantidad * pa.precio_compra) FROM portfolio_accion pa WHERE pa.id_portfolio = @idPortfolio), 0)
                    + COALESCE((SELECT SUM(ppf.monto_invertido) FROM portfolio_plazo_fijo ppf JOIN moneda m ON m.id_moneda = ppf.id_moneda WHERE ppf.id_portfolio = @idPortfolio AND m.codigo_iso = 'USD'), 0) AS total_usd,
                COALESCE((SELECT SUM(pb.cantidad * pb.precio_compra) FROM portfolio_bono pb WHERE pb.id_portfolio = @idPortfolio), 0)
                    + COALESCE((SELECT SUM(pl.cantidad * pl.precio_compra) FROM portfolio_letra pl WHERE pl.id_portfolio = @idPortfolio), 0)
                    + COALESCE((SELECT SUM(ppf.monto_invertido) FROM portfolio_plazo_fijo ppf JOIN moneda m ON m.id_moneda = ppf.id_moneda WHERE ppf.id_portfolio = @idPortfolio AND m.codigo_iso = 'ARS'), 0) AS total_ars
            """;
        var row = await conn.QuerySingleAsync<TotalInvertidoRow>(
            new CommandDefinition(sql, new { idPortfolio }, cancellationToken: ct));
        return (row.TotalUsd, row.TotalArs);
    }

    // ── Helper ────────────────────────────────────────────────────────────────

    private static async Task TouchPortfolioAsync(System.Data.IDbConnection conn, long idPortfolio, System.Data.IDbTransaction tx, CancellationToken ct)
    {
        await conn.ExecuteAsync(
            new CommandDefinition(
                "UPDATE portfolio SET fecha_modificacion = NOW() WHERE id_portfolio = @idPortfolio",
                new { idPortfolio }, transaction: tx, cancellationToken: ct));
    }
}
