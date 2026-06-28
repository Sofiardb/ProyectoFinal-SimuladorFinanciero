namespace SimuladorFinanciero.Api.DTOs.Referencia;

public record PerfilRiesgoResponse(
    int      IdPerfilRiesgo,
    string   Nombre,
    string?  Descripcion,
    decimal  SigmaMaxAccion
);
