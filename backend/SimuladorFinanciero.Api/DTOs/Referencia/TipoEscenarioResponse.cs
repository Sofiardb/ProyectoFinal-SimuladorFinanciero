namespace SimuladorFinanciero.Api.DTOs.Referencia;

public record TipoEscenarioResponse(
    int     IdTipoEscenario,
    string  Codigo,
    string  Nombre,
    string? Descripcion
);
