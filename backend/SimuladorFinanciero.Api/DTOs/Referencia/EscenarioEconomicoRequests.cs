using System.ComponentModel.DataAnnotations;

namespace SimuladorFinanciero.Api.DTOs.Referencia;

public sealed class ActualizarEscenarioEconomicoItem
{
    [Range(1, 32767, ErrorMessage = "IdTipoEscenario debe ser un valor válido.")]
    public int IdTipoEscenario { get; init; }

    [Range(0, 1, ErrorMessage = "La inflación mensual mínima debe estar entre 0% y 100%.")]
    public decimal InflacionMensualMin { get; init; }

    [Range(0, 1, ErrorMessage = "La inflación mensual máxima debe estar entre 0% y 100%.")]
    public decimal InflacionMensualMax { get; init; }

    [Range(0, 1, ErrorMessage = "La inflación mensual mínima (USD) debe estar entre 0% y 100%.")]
    public decimal InflacionMensualMinUsd { get; init; }

    [Range(0, 1, ErrorMessage = "La inflación mensual máxima (USD) debe estar entre 0% y 100%.")]
    public decimal InflacionMensualMaxUsd { get; init; }
}

public sealed class ActualizarEscenariosEconomicosRequest
{
    public IReadOnlyList<ActualizarEscenarioEconomicoItem> Escenarios { get; init; } = [];
}
