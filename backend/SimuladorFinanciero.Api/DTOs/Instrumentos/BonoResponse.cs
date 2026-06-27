namespace SimuladorFinanciero.Api.DTOs.Instrumentos;

public record BonoResponse(
    long                         IdBono,
    string                       Ticker,
    string                       Nombre,
    string                       TipoBono,           // "TASA_FIJA" | "INDEXADO_INFLACION"
    decimal                      TasaDescuento,
    DateOnly                     FechaVencimiento,
    int                          DiasAlVencimiento,
    decimal?                     PrecioActual,
    DateTimeOffset?              FechaPrecioActual,
    IReadOnlyList<FlujoCajaResponse> Flujos
);

public record FlujoCajaResponse(
    int      NumeroCupon,
    DateOnly FechaPago,
    decimal  MontoCupon,
    decimal  MontoCapital,
    decimal  MontoTotal
);
