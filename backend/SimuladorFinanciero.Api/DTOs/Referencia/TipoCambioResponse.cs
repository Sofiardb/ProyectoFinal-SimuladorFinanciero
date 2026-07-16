namespace SimuladorFinanciero.Api.DTOs.Referencia;

public record TipoCambioResponse(
    decimal  Valor,
    DateOnly Fecha
);
