namespace SimuladorFinanciero.Api.DTOs.Referencia;

public record EscenarioEconomicoResponse(
    int       IdEscenarioEconomico,
    int       IdTipoEscenario,
    string    CodigoEscenario,
    string    NombreEscenario,
    decimal   InflacionMensualMin,
    decimal   InflacionMensualMax,
    decimal   InflacionMensualMinUsd,
    decimal   InflacionMensualMaxUsd,
    DateOnly  VigenteDesde,
    DateOnly? VigenteHasta
);
