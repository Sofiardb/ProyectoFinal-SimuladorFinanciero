using Dapper;
using SimuladorFinanciero.Api.DTOs.Instrumentos;
using SimuladorFinanciero.Api.Infrastructure.Database;
using SimuladorFinanciero.Api.Models;

namespace SimuladorFinanciero.Api.Repositories;

public sealed class BonoUpsertData
{
    public required string  Ticker               { get; init; }
    public required string  Nombre               { get; init; }
    public          string  Emisor               { get; init; } = "Tesoro Nacional";
    public required string  TipoBonoCodigo       { get; init; } // "TASA_FIJA" | "INDEXADO_INFLACION"
    public          decimal ValorNominal         { get; init; } = 100m;
    public          decimal Cupon                { get; init; } = 0m;
    public          short   FrecuenciaCuponMeses { get; init; } = 6;
    public required decimal TasaDescuento        { get; init; }
    public required DateOnly FechaEmision        { get; init; }
    public required DateOnly FechaVencimiento    { get; init; }
    public          decimal? PrecioActual        { get; init; }
    public IReadOnlyList<FlujoBono> Flujos       { get; init; } = [];
}

public interface IBonoRepository
{
    Task UpsertAsync(BonoUpsertData data, CancellationToken ct = default);
    Task ActualizarPrecioAsync(string ticker, decimal precio, CancellationToken ct = default);
    Task ActualizarYieldAsync(string ticker, decimal tir, CancellationToken ct = default);

    /// <summary>
    /// Desactiva todo bono cuyo ticker no esté en <paramref name="tickersVigentes"/> — instrumentos que
    /// Docta ya no lista, o que Docta lista pero ninguna fuente de precio (data912) cotiza.
    /// </summary>
    Task DesactivarNoListadosAsync(IReadOnlyCollection<string> tickersVigentes, CancellationToken ct = default);

    Task<IReadOnlyList<BonoResponse>> ObtenerActivosAsync(CancellationToken ct = default);
    Task<BonoResponse?> ObtenerPorIdAsync(long id, CancellationToken ct = default);
}

public sealed class BonoRepository : IBonoRepository
{
    private readonly IDbConnectionFactory _db;
    public BonoRepository(IDbConnectionFactory db) => _db = db;

    public async Task UpsertAsync(BonoUpsertData data, CancellationToken ct = default)
    {
        using var conn = _db.Crear();
        conn.Open();
        using var tx = conn.BeginTransaction();

        // Upsert cabecera del bono
        const string upsertBono = """
            INSERT INTO bono (ticker, nombre, emisor, id_tipo_bono, id_moneda, valor_nominal,
                              cupon, frecuencia_cupon_meses, tasa_descuento,
                              fecha_emision, fecha_vencimiento, precio_actual, fecha_precio_actual, activo)
            SELECT @Ticker, @Nombre, @Emisor,
                   tb.id_tipo_bono,
                   m.id_moneda,
                   @ValorNominal, @Cupon, @FrecuenciaCuponMeses, @TasaDescuento,
                   @FechaEmision, @FechaVencimiento,
                   @PrecioActual, CASE WHEN @PrecioActual IS NULL THEN NULL ELSE NOW() END,
                   TRUE
            FROM tipo_bono tb
            CROSS JOIN moneda m
            WHERE tb.codigo = @TipoBonoCodigo
              AND m.codigo_iso = 'ARS'
            ON CONFLICT (ticker) DO UPDATE SET
                id_tipo_bono         = EXCLUDED.id_tipo_bono,
                tasa_descuento       = EXCLUDED.tasa_descuento,
                frecuencia_cupon_meses = EXCLUDED.frecuencia_cupon_meses,
                fecha_vencimiento    = EXCLUDED.fecha_vencimiento,
                precio_actual        = EXCLUDED.precio_actual,
                fecha_precio_actual  = EXCLUDED.fecha_precio_actual,
                activo               = TRUE
            RETURNING id_bono
            """;

        var idBono = await conn.ExecuteScalarAsync<long>(
            new CommandDefinition(upsertBono, data, transaction: tx, cancellationToken: ct));

        // Reemplazar flujos solo si vienen datos
        if (data.Flujos.Count > 0)
        {
            await conn.ExecuteAsync(
                new CommandDefinition(
                    "DELETE FROM flujo_bono WHERE id_bono = @idBono",
                    new { idBono }, transaction: tx, cancellationToken: ct));

            const string insertFlujo = """
                INSERT INTO flujo_bono (id_bono, numero_cupon, fecha_pago, monto_cupon, amortiza_capital, monto_capital)
                VALUES (@IdBono, @NumeroCupon, @FechaPago, @MontoCupon, @AmortizaCapital, @MontoCapital)
                """;

            await conn.ExecuteAsync(new CommandDefinition(
                insertFlujo,
                data.Flujos.Select(f => new
                {
                    IdBono          = idBono,
                    f.NumeroCupon,
                    f.FechaPago,
                    f.MontoCupon,
                    f.AmortizaCapital,
                    f.MontoCapital
                }),
                transaction: tx, cancellationToken: ct));
        }

        tx.Commit();
    }

    public async Task ActualizarPrecioAsync(string ticker, decimal precio, CancellationToken ct = default)
    {
        using var conn = _db.Crear();
        await conn.ExecuteAsync(
            new CommandDefinition(
                "UPDATE bono SET precio_actual = @precio, fecha_precio_actual = NOW() WHERE ticker = @ticker",
                new { precio, ticker }, cancellationToken: ct));
    }

    public async Task ActualizarYieldAsync(string ticker, decimal tir, CancellationToken ct = default)
    {
        using var conn = _db.Crear();
        await conn.ExecuteAsync(
            new CommandDefinition(
                "UPDATE bono SET tasa_descuento = @tir WHERE ticker = @ticker",
                new { tir, ticker }, cancellationToken: ct));
    }

    public async Task DesactivarNoListadosAsync(IReadOnlyCollection<string> tickersVigentes, CancellationToken ct = default)
    {
        // Lista vacía casi siempre significa que una fuente falló, no que no hay bonos vigentes.
        // No desactivar todo el catálogo por un error transitorio de red.
        if (tickersVigentes.Count == 0) return;

        using var conn = _db.Crear();
        await conn.ExecuteAsync(
            new CommandDefinition(
                "UPDATE bono SET activo = FALSE WHERE activo = TRUE AND NOT (ticker = ANY(@tickersVigentes))",
                new { tickersVigentes = tickersVigentes.ToArray() }, cancellationToken: ct));
    }

    public async Task<IReadOnlyList<BonoResponse>> ObtenerActivosAsync(CancellationToken ct = default)
    {
        using var conn = _db.Crear();

        const string sqlBonos = """
            SELECT b.id_bono, b.ticker, b.nombre, tb.codigo AS tipo_bono,
                   b.tasa_descuento, b.fecha_vencimiento,
                   (b.fecha_vencimiento - CURRENT_DATE) AS dias_al_vencimiento,
                   b.precio_actual, b.fecha_precio_actual
            FROM bono b
            JOIN tipo_bono tb ON tb.id_tipo_bono = b.id_tipo_bono
            WHERE b.activo = TRUE
            ORDER BY b.fecha_vencimiento
            """;

        const string sqlFlujos = """
            SELECT fb.id_bono, fb.numero_cupon, fb.fecha_pago,
                   fb.monto_cupon, fb.monto_capital, fb.amortiza_capital
            FROM flujo_bono fb
            JOIN bono b ON b.id_bono = fb.id_bono
            WHERE b.activo = TRUE
            ORDER BY fb.id_bono, fb.numero_cupon
            """;

        var bonos  = (await conn.QueryAsync<BonoRow>(new CommandDefinition(sqlBonos, cancellationToken: ct))).ToList();
        var flujos = (await conn.QueryAsync<FlujoRow>(new CommandDefinition(sqlFlujos, cancellationToken: ct))).ToList();

        var flujosPorBono = flujos.GroupBy(f => f.IdBono)
            .ToDictionary(g => g.Key, g => g.ToList());

        return bonos.Select(b =>
        {
            var fs = flujosPorBono.GetValueOrDefault(b.IdBono, [])
                .Select(f => new FlujoCajaResponse(
                    f.NumeroCupon, f.FechaPago, f.MontoCupon, f.MontoCapital,
                    f.MontoCupon + f.MontoCapital))
                .ToList();
            return new BonoResponse(b.IdBono, b.Ticker, b.Nombre, b.TipoBono,
                b.TasaDescuento, b.FechaVencimiento, b.DiasAlVencimiento,
                b.PrecioActual, b.FechaPrecioActual, fs);
        }).ToList();
    }

    public async Task<BonoResponse?> ObtenerPorIdAsync(long id, CancellationToken ct = default)
    {
        using var conn = _db.Crear();

        const string sqlBono = """
            SELECT b.id_bono, b.ticker, b.nombre, tb.codigo AS tipo_bono,
                   b.tasa_descuento, b.fecha_vencimiento,
                   (b.fecha_vencimiento - CURRENT_DATE) AS dias_al_vencimiento,
                   b.precio_actual, b.fecha_precio_actual
            FROM bono b
            JOIN tipo_bono tb ON tb.id_tipo_bono = b.id_tipo_bono
            WHERE b.id_bono = @id
            """;

        var bono = await conn.QuerySingleOrDefaultAsync<BonoRow>(
            new CommandDefinition(sqlBono, new { id }, cancellationToken: ct));
        if (bono is null) return null;

        const string sqlFlujos = """
            SELECT numero_cupon, fecha_pago, monto_cupon, monto_capital, amortiza_capital
            FROM flujo_bono WHERE id_bono = @id ORDER BY numero_cupon
            """;
        var flujos = await conn.QueryAsync<FlujoRow>(
            new CommandDefinition(sqlFlujos, new { id }, cancellationToken: ct));

        var fs = flujos.Select(f => new FlujoCajaResponse(
            f.NumeroCupon, f.FechaPago, f.MontoCupon, f.MontoCapital,
            f.MontoCupon + f.MontoCapital)).ToList();

        return new BonoResponse(bono.IdBono, bono.Ticker, bono.Nombre, bono.TipoBono,
            bono.TasaDescuento, bono.FechaVencimiento, bono.DiasAlVencimiento,
            bono.PrecioActual, bono.FechaPrecioActual, fs);
    }

    private sealed class BonoRow
    {
        public long     IdBono           { get; set; }
        public string   Ticker           { get; set; } = "";
        public string   Nombre           { get; set; } = "";
        public string   TipoBono         { get; set; } = "";
        public decimal  TasaDescuento    { get; set; }
        public DateOnly FechaVencimiento { get; set; }
        public int      DiasAlVencimiento { get; set; }
        public decimal? PrecioActual     { get; set; }
        public DateTimeOffset? FechaPrecioActual { get; set; }
    }

    private sealed class FlujoRow
    {
        public long     IdBono          { get; set; }
        public short    NumeroCupon     { get; set; }
        public DateOnly FechaPago       { get; set; }
        public decimal  MontoCupon      { get; set; }
        public decimal  MontoCapital    { get; set; }
        public bool     AmortizaCapital { get; set; }
    }
}
