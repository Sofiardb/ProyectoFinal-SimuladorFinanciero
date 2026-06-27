using Dapper;
using SimuladorFinanciero.Api.DTOs.Instrumentos;
using SimuladorFinanciero.Api.Infrastructure.Database;

namespace SimuladorFinanciero.Api.Repositories;

public sealed class LetraUpsertData
{
    public required string  Ticker            { get; init; }
    public required string  Nombre            { get; init; }
    public          string  Emisor            { get; init; } = "Secretaría de Finanzas";
    public required string  TipoLetraCodigo   { get; init; } // "LECAP" | "LECER"
    public          decimal ValorNominal      { get; init; } = 100m;
    public required decimal Tasa              { get; init; }
    public required DateOnly FechaEmision     { get; init; }
    public required DateOnly FechaVencimiento { get; init; }
    public required decimal PrecioActual      { get; init; }
}

public interface ILetraRepository
{
    Task UpsertAsync(LetraUpsertData data, CancellationToken ct = default);
    Task<IReadOnlyList<LetraResponse>> ObtenerActivasAsync(CancellationToken ct = default);
    Task<LetraResponse?> ObtenerPorIdAsync(long id, CancellationToken ct = default);
}

public sealed class LetraRepository : ILetraRepository
{
    private readonly IDbConnectionFactory _db;
    public LetraRepository(IDbConnectionFactory db) => _db = db;

    public async Task UpsertAsync(LetraUpsertData data, CancellationToken ct = default)
    {
        using var conn = _db.Crear();
        const string sql = """
            INSERT INTO letra (ticker, nombre, emisor, id_tipo_letra, id_moneda, valor_nominal,
                               tasa, fecha_emision, fecha_vencimiento, precio_actual, fecha_precio_actual, activo)
            SELECT @Ticker, @Nombre, @Emisor,
                   tl.id_tipo_letra,
                   m.id_moneda,
                   @ValorNominal, @Tasa, @FechaEmision, @FechaVencimiento, @PrecioActual, NOW(), TRUE
            FROM tipo_letra tl
            CROSS JOIN moneda m
            WHERE tl.codigo = @TipoLetraCodigo
              AND m.codigo_iso = 'ARS'
            ON CONFLICT (ticker) DO UPDATE SET
                tasa                = EXCLUDED.tasa,
                fecha_vencimiento   = EXCLUDED.fecha_vencimiento,
                precio_actual       = EXCLUDED.precio_actual,
                fecha_precio_actual = EXCLUDED.fecha_precio_actual,
                activo              = TRUE
            """;
        await conn.ExecuteAsync(new CommandDefinition(sql, data, cancellationToken: ct));
    }

    public async Task<IReadOnlyList<LetraResponse>> ObtenerActivasAsync(CancellationToken ct = default)
    {
        using var conn = _db.Crear();
        const string sql = """
            SELECT l.id_letra, l.ticker, l.nombre, tl.codigo AS tipo_letra,
                   l.tasa, l.fecha_vencimiento,
                   (l.fecha_vencimiento - CURRENT_DATE) AS dias_al_vencimiento,
                   l.precio_actual, l.fecha_precio_actual
            FROM letra l
            JOIN tipo_letra tl ON tl.id_tipo_letra = l.id_tipo_letra
            WHERE l.activo = TRUE
            ORDER BY l.fecha_vencimiento
            """;
        var rows = await conn.QueryAsync<LetraRow>(new CommandDefinition(sql, cancellationToken: ct));
        return rows.Select(r => new LetraResponse(
            r.IdLetra, r.Ticker, r.Nombre, r.TipoLetra,
            r.Tasa, r.FechaVencimiento, r.DiasAlVencimiento,
            r.PrecioActual, r.FechaPrecioActual)).ToList();
    }

    public async Task<LetraResponse?> ObtenerPorIdAsync(long id, CancellationToken ct = default)
    {
        using var conn = _db.Crear();
        const string sql = """
            SELECT l.id_letra, l.ticker, l.nombre, tl.codigo AS tipo_letra,
                   l.tasa, l.fecha_vencimiento,
                   (l.fecha_vencimiento - CURRENT_DATE) AS dias_al_vencimiento,
                   l.precio_actual, l.fecha_precio_actual
            FROM letra l
            JOIN tipo_letra tl ON tl.id_tipo_letra = l.id_tipo_letra
            WHERE l.id_letra = @id
            """;
        var row = await conn.QuerySingleOrDefaultAsync<LetraRow>(
            new CommandDefinition(sql, new { id }, cancellationToken: ct));
        if (row is null) return null;
        return new LetraResponse(
            row.IdLetra, row.Ticker, row.Nombre, row.TipoLetra,
            row.Tasa, row.FechaVencimiento, row.DiasAlVencimiento,
            row.PrecioActual, row.FechaPrecioActual);
    }

    // Clase interna para el mapping de la query de lectura
    private sealed class LetraRow
    {
        public long    IdLetra           { get; set; }
        public string  Ticker            { get; set; } = "";
        public string  Nombre            { get; set; } = "";
        public string  TipoLetra         { get; set; } = "";
        public decimal Tasa              { get; set; }
        public DateOnly FechaVencimiento { get; set; }
        public int     DiasAlVencimiento { get; set; }
        public decimal? PrecioActual     { get; set; }
        public DateTimeOffset? FechaPrecioActual { get; set; }
    }
}
