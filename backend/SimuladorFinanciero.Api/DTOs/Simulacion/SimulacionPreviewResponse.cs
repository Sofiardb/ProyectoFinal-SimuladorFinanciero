namespace SimuladorFinanciero.Api.DTOs.Simulacion;

public sealed record SimulacionPreviewResponse(
    decimal?  CapitalInicial,
    decimal   TotalInvertidoOriginal,
    decimal?  TotalInvertidoMercado,   // null si algún instrumento no tiene precio_actual
    bool      PuedeSimular,
    IReadOnlyList<InstrumentoPreviewItem> Instrumentos
);

/// <summary>
/// Estado de un instrumento respecto a la simulación.
/// IGUAL            — precio de mercado == precio de compra (diff < 0.1%).
/// ACTUALIZADO      — precio de mercado difiere del precio de compra.
/// SIN_PRECIO       — precio_actual es null; no bloquea (se usa precio_compra).
/// VENCIDO          — instrumento vencido; bloquea la simulación.
/// PARCIALMENTE_VENCIDO — bono con algunos flujos ya cobrados; no bloquea.
/// ACTIVO           — plazo fijo vigente (sin precio de mercado comparable).
/// </summary>
public sealed record InstrumentoPreviewItem(
    string    Id,                       // 'accion_42', 'bono_3', 'letra_7', 'plazo_fijo_101'
    string    Tipo,                     // 'accion' | 'bono' | 'letra' | 'plazo_fijo'
    string?   Ticker,
    string?   Nombre,
    string?   EntidadFinanciera,        // solo plazo_fijo
    string?   CodigoMoneda,            // solo plazo_fijo
    decimal   Cantidad,                 // 0 para plazo_fijo
    decimal   PrecioOriginal,           // precio_compra (o monto_invertido para pf)
    decimal?  PrecioMercado,            // precio_actual del catálogo
    decimal   MontoOriginal,
    decimal?  MontoMercado,
    string    Estado,
    bool      EsValidoParaSimular,
    // Específico de bonos
    int?      FlujosTotales,
    int?      FlujosVigentes,
    int?      FlujosVencidos,
    // Específico de letras / bonos / plazos fijos
    DateOnly? FechaVencimiento,
    int?      MesesRestantes            // > 0: vigente | <= 0: vencido
);
