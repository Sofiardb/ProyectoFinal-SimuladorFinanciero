namespace SimuladorFinanciero.Api.DTOs.Simulacion;

/// <summary>
/// Snapshot liviano de un instrumento de una simulación, para marcar su vencimiento en los
/// gráficos. TVencMeses es null si el instrumento no vence dentro del horizonte simulado (nunca
/// para acciones, o si vence después de T_meses, o si es un plazo fijo con reinvertir=true) — en
/// esos casos no hay congelamiento de "ganancia real" que marcar.
/// </summary>
public sealed record InstrumentoSimulacionResponse(
    string  Ambito,
    string  Tipo,
    decimal Monto,
    int?    TVencMeses
);
