namespace SimuladorFinanciero.Api.DTOs.Portfolio;

public sealed record PortfolioResumenResponse(
    long     IdPortfolio,
    string   Nombre,
    string?  Descripcion,
    int      IdPerfilRiesgo,
    string   NombrePerfilRiesgo,
    int      IdMonedaBase,
    string   CodigoMonedaBase,
    decimal? CapitalInicial,
    int      HorizonteMeses,
    DateTimeOffset FechaCreacion,
    DateTimeOffset FechaModificacion,
    string   Estado
);

public sealed record PortfolioDetalleResponse(
    long     IdPortfolio,
    string   Nombre,
    string?  Descripcion,
    int      IdPerfilRiesgo,
    string   NombrePerfilRiesgo,
    int      IdMonedaBase,
    string   CodigoMonedaBase,
    decimal? CapitalInicial,
    int      HorizonteMeses,
    DateTimeOffset FechaCreacion,
    DateTimeOffset FechaModificacion,
    string   Estado,
    IReadOnlyList<PortfolioAccionResponse>    Acciones,
    IReadOnlyList<PortfolioBonoResponse>      Bonos,
    IReadOnlyList<PortfolioLetraResponse>     Letras,
    IReadOnlyList<PortfolioPlazoFijoResponse> PlazosFijos
);
