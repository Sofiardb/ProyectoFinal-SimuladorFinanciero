namespace SimuladorFinanciero.Api.DTOs.Simulacion;

public sealed record SimulacionPreviewResponse(
    decimal?  CapitalInicial,
    decimal   TotalInvertidoOriginal,
    decimal?  TotalInvertidoMercado,   // null si algún instrumento no tiene precio_actual
    bool      PuedeSimular,
    bool      TieneActualizaciones,    // true si algún instrumento tiene precio y/o tasa/GBM desactualizado (docs/09)
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
    int?      MesesRestantes,           // > 0: vigente | <= 0: vencido
    // Tasa/parámetros GBM: snapshot de la tenencia (_compra) vs. catálogo actual (docs/09)
    string?   EstadoTasa,               // mismos valores que Estado; null si no aplica (plazo_fijo)
    decimal?  TasaOriginal,             // bono/letra: snapshot tasa_descuento_compra/tasa_compra
    decimal?  TasaMercado,              // bono/letra: valor vivo del catálogo
    decimal?  MuOriginal,               // accion: snapshot mu_retorno_esperado_compra
    decimal?  MuMercado,                // accion: valor vivo del catálogo
    decimal?  SigmaOriginal,            // accion: snapshot sigma_volatilidad_compra
    decimal?  SigmaMercado,             // accion: valor vivo del catálogo
    decimal?  RhoOriginal,              // accion: snapshot rho_correlacion_indice_compra
    decimal?  RhoMercado                // accion: valor vivo del catálogo
);
