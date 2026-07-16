namespace SimuladorFinanciero.Api.DTOs.Portfolio;

public sealed record PortfolioAccionResponse(
    long     IdPortfolioAccion,
    long     IdAccion,
    string   Ticker,
    string   Nombre,
    string?  Sector,
    decimal? MuRetornoEsperado,
    decimal? SigmaVolatilidad,
    decimal? PrecioActual,
    decimal  Cantidad,
    decimal  PrecioCompra,
    decimal? MuRetornoEsperadoCompra,
    decimal? SigmaVolatilidadCompra,
    decimal? RhoCorrelacionIndiceCompra
);

public sealed record PortfolioBonoResponse(
    long     IdPortfolioBono,
    long     IdBono,
    string   Ticker,
    string   Nombre,
    string?  Emisor,
    decimal? PrecioActual,
    decimal  Cantidad,
    decimal  PrecioCompra,
    decimal  TasaDescuentoCompra
);

public sealed record PortfolioLetraResponse(
    long     IdPortfolioLetra,
    long     IdLetra,
    string   Ticker,
    string   Nombre,
    decimal  Tasa,
    DateOnly FechaVencimiento,
    decimal? PrecioActual,
    decimal  Cantidad,
    decimal  PrecioCompra,
    decimal  TasaCompra
);

public sealed record PortfolioPlazoFijoResponse(
    long     IdPortfolioPlazoFijo,
    int      IdTipoPlazoFijo,
    string   NombreTipoPlazoFijo,
    int      IdMoneda,
    string   CodigoMoneda,
    string   EntidadFinanciera,
    decimal  MontoInvertido,
    decimal  TnaPactada,
    DateOnly FechaInicio,
    int      DuracionDias,
    bool     ReinvertirAlVencimiento
);
