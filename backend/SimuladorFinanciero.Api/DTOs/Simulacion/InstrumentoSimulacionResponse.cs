namespace SimuladorFinanciero.Api.DTOs.Simulacion;

/// <summary>
/// Snapshot liviano de un instrumento de una simulación, para marcar su vencimiento en los
/// gráficos y para resolver su nombre para mostrar. TVencMeses es null si el instrumento no vence
/// dentro del horizonte simulado (nunca para acciones, o si vence después de T_meses, o si es un
/// plazo fijo con reinvertir=true) — en esos casos no hay congelamiento de "ganancia real" que
/// marcar. Ticker/Nombre (accion/bono/letra) salen de la tabla maestra del catálogo, que nunca se
/// borra, así que siguen resolviendo aunque la tenencia del portfolio haya sido eliminada.
/// EntidadFinanciera/NombreTipoPlazoFijo/CodigoMoneda (plazo fijo) en cambio solo resuelven
/// mientras la tenencia siga viva, porque no existe catálogo maestro de plazos fijos.
/// </summary>
public sealed record InstrumentoSimulacionResponse(
    string  Ambito,
    string  Tipo,
    decimal Monto,
    int?    TVencMeses,
    string? Ticker,
    string? Nombre,
    string? EntidadFinanciera,
    string? NombreTipoPlazoFijo,
    string? CodigoMoneda
);
