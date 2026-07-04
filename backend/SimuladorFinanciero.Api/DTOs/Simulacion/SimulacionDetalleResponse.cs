namespace SimuladorFinanciero.Api.DTOs.Simulacion;

public sealed record SimulacionParametroEscenarioResponse(
    int     IdTipoEscenario,
    string  NombreTipoEscenario,
    decimal InflacionMensualMin,
    decimal InflacionMensualMax
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
    IReadOnlyList<SimulacionParametroEscenarioResponse> ParametrosEscenario
);
