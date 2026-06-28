namespace SimuladorFinanciero.Api.DTOs.Instrumentos;

public record GbmRefreshResult(
    string  Ticker,
    decimal MuRetornoEsperado,
    decimal SigmaVolatilidad,
    decimal RhoCorrelacionIndice,
    decimal PrecioActual,
    int     MesesDeDatos
);
