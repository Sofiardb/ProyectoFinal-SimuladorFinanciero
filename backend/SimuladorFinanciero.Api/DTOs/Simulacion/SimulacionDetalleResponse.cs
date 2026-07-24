namespace SimuladorFinanciero.Api.DTOs.Simulacion;

public sealed record SimulacionParametroEscenarioResponse(
    int     IdTipoEscenario,
    string  NombreTipoEscenario,
    decimal InflacionMensualMin,
    decimal InflacionMensualMax,
    decimal InflacionMensualMinUsd,
    decimal InflacionMensualMaxUsd
);

public sealed record SimulacionDetalleResponse(
    long           IdSimulacion,
    long           IdPortfolio,
    DateTimeOffset FechaEjecucion,
    int            HorizonteMeses,
    int            NumTrayectorias,
    long           SeedAleatoria,
    decimal        ValorInicial,
    decimal?       ValorEsperado,
    decimal?       ValorMinimo,
    decimal?       ValorMaximo,
    decimal?       RetornoEsperadoPct,
    decimal?       RendimientoRealPct,
    decimal?       DesvioEstandar,
    string?        Observaciones,
    decimal?       ValorInicialArs,
    decimal?       ValorInicialUsd,
    decimal?       ValorEsperadoArs,
    decimal?       ValorEsperadoUsd,
    decimal?       ValorMinimoArs,
    decimal?       ValorMinimoUsd,
    decimal?       ValorMaximoArs,
    decimal?       ValorMaximoUsd,
    decimal?       RetornoEsperadoPctArs,
    decimal?       RetornoEsperadoPctUsd,
    decimal?       RendimientoRealPctArs,
    decimal?       RendimientoRealPctUsd,
    IReadOnlyList<SimulacionParametroEscenarioResponse> ParametrosEscenario
);
