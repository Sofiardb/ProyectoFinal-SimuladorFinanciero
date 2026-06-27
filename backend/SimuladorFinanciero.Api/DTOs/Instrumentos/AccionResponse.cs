namespace SimuladorFinanciero.Api.DTOs.Instrumentos;

public record AccionResponse(
    long            IdAccion,
    string          Ticker,
    string          Nombre,
    string?         Sector,
    decimal?        MuRetornoEsperado,
    decimal?        SigmaVolatilidad,
    decimal?        RhoCorrelacionIndice,
    decimal?        PrecioActual,
    DateTimeOffset? FechaPrecioActual,
    DateTimeOffset? FechaEstimacionParams,
    int?            MesesDeDatos
);
