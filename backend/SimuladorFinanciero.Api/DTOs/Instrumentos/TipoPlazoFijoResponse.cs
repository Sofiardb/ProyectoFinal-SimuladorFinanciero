namespace SimuladorFinanciero.Api.DTOs.Instrumentos;

public record TipoPlazoFijoResponse(
    int     IdTipoPlazoFijo,
    string  Codigo,
    string  Nombre,
    string? Descripcion
);
