/** Definiciones de términos financieros mostradas en los InfoTooltip de la app, centralizadas para no repetir el mismo texto en cada pantalla. */

export const GBM_TOOLTIPS = {
  mu: {
    term: 'Retorno esperado',
    definition:
      'Tendencia de retorno anualizada observada históricamente para este ticker — hacia dónde tendió a moverse el precio en el pasado. La simulación lo convierte internamente a paso mensual.',
  },
  sigma: {
    term: 'Volatilidad',
    definition:
      'Cuánto tendió a oscilar el precio históricamente, anualizado. A mayor volatilidad, mayor el rango de resultados posibles en la simulación. La simulación lo convierte internamente a paso mensual.',
  },
  rho: {
    term: 'Correlación con su índice de referencia',
    definition: 'Qué tan de la mano se movió este ticker con su índice de referencia en el pasado.',
  },
} as const

export const PRECIO_VN_TOOLTIP =
  'El precio cotiza cada 100 de valor nominal (VN). Por ejemplo, $105 significa que pagás $105 por cada $100 de VN que comprás — no es el precio de "una unidad".'

export const SECCION_TOOLTIPS = {
  acciones: 'Participaciones de una empresa cotizante. Su valor sube o baja con el mercado; sin vencimiento.',
  bonos: 'Deuda emitida por el Estado o una empresa. Puede tener tasa fija o ajustar por CER (inflación).',
  letras: 'Deuda de corto plazo emitida por el Tesoro. Puede tener tasa fija o ajustar por CER (inflación).',
  plazoFijoUsd: 'Depósito a plazo en dólares con tasa fija (TNA) pactada de antemano, a devolver al vencimiento.',
  plazoFijoArs:
    'Depósito a plazo en pesos. Puede ser a tasa fija (monto conocido de antemano) o UVA (ajusta por inflación más una tasa real).',
} as const

function cantidadLotesTooltip(instrumento: string): string {
  return `Cada lote equivale a $100 de valor nominal de ${instrumento}. Por ejemplo, si querés tener el equivalente a $500.000, ingresá 5000 lotes (500.000 ÷ 100).`
}

export const CANTIDAD_LOTES_TOOLTIP_BONO = cantidadLotesTooltip('este bono')
export const CANTIDAD_LOTES_TOOLTIP_LETRA = cantidadLotesTooltip('esta letra')
