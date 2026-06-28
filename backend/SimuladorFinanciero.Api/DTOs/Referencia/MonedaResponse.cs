namespace SimuladorFinanciero.Api.DTOs.Referencia;

public record MonedaResponse(
    int    IdMoneda,
    string CodigoIso,
    string Nombre,
    string Simbolo
);
