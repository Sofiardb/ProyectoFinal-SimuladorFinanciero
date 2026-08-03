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

export const TASA_TOOLTIP =
  'Tasa anual vigente hoy para este instrumento: la tasa nominal pactada si es a tasa fija, o el spread real sobre la inflación si ajusta por CER.'

export const TIPO_TASA_TOOLTIP =
  'Tasa fija: la tasa no cambia durante toda la vida del instrumento. Indexado por inflación (CER): el capital y/o los cupones ajustan por la inflación acumulada, además de la tasa.'

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

export const RESULTADOS_TOOLTIPS = {
  patrimonio: {
    term: 'Patrimonio',
    definition: 'Valor total del instrumento o portfolio en cada mes, en moneda nominal (sin ajustar por inflación).',
  },
  gananciasNominales: {
    term: 'Ganancias nominales',
    definition: 'Cuánto ganaste en pesos/dólares desde que invertiste (patrimonio menos monto invertido), sin descontar la inflación del período.',
  },
  gananciasReales: {
    term: 'Ganancias reales',
    definition: 'Lo mismo que las ganancias nominales, pero ajustado por la inflación acumulada — mide si tu poder de compra efectivamente aumentó o no.',
  },
  escenarios: {
    term: 'Escenarios',
    definition: 'Favorable, moderado y desfavorable son los mismos supuestos de mercado con distintos rangos de inflación asumida. Los rangos exactos de cada uno están en la tabla de abajo.',
  },
  banda: {
    term: 'Banda p25–p75',
    definition: 'El área sombreada muestra dónde cayó el 50% central de las simulaciones (entre el percentil 25 y el 75). Las líneas tenues marcan el mínimo y el máximo simulados, como referencia de los extremos.',
  },
  zonaVencida: {
    term: 'Capital vencido',
    definition: 'Cuando un instrumento vence, su capital no se reinvierte automáticamente: queda "parado" en la simulación. Por eso el patrimonio y las ganancias nominales dejan de moverse, pero las ganancias reales pueden seguir cayendo — ese capital inmóvil sigue expuesto a la inflación mientras no se decida qué hacer con él.',
  },
} as const
