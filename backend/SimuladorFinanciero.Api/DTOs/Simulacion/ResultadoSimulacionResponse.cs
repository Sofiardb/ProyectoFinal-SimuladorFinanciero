using System.Text.Json;

namespace SimuladorFinanciero.Api.DTOs.Simulacion;

public sealed record ResultadoSimulacionResponse(
    long        IdResultado,
    long        IdSimulacion,
    string      Ambito,
    string      Escenario,
    string      Metrica,
    JsonElement Stats
);
