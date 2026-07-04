using System.ComponentModel.DataAnnotations;

namespace SimuladorFinanciero.Api.DTOs.Simulacion;

public sealed class SimularRequest
{
    [Range(1, 360)]
    public int?  HorizonteMeses { get; init; }
    public long? Semilla        { get; init; }
}
