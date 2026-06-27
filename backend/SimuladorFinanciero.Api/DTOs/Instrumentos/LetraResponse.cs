namespace SimuladorFinanciero.Api.DTOs.Instrumentos;

public record LetraResponse(
    long             IdLetra,
    string           Ticker,
    string           Nombre,
    string           TipoLetra,          // "LECAP" | "LECER"
    decimal          Tasa,
    DateOnly         FechaVencimiento,
    int              DiasAlVencimiento,
    decimal?         PrecioActual,
    DateTimeOffset?  FechaPrecioActual
);
