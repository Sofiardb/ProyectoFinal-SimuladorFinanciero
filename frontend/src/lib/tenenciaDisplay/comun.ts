import { formatMoneda, formatPorcentaje } from '@/lib/format'
import { MONTO_CONVERTIDO_TOOLTIP, PRECIO_VN_TOOLTIP } from '@/lib/tooltips'
import type { CampoPreview } from '@/lib/tenenciaDisplay/tipos'

export function tasaTexto(tipo: string, tasa: number): string {
  return `${tipo} ${formatPorcentaje(tasa * 100)}`
}

export function precioVnField(precioActual?: number): CampoPreview {
  return {
    label:   'Precio actual',
    value:   precioActual != null ? `$${precioActual.toFixed(2)} / VN 100` : '—',
    tooltip: PRECIO_VN_TOOLTIP,
  }
}

/** Cantidad de lotes de VN100 mostrada como el valor nominal en $ que el usuario ingresó. */
export function valorNominalField(cantidadLotes: number): CampoPreview {
  return { label: 'Valor nominal', value: `$${(cantidadLotes * 100).toLocaleString('es-AR')}` }
}

export function montoConvertidoField(
  monto: number,
  monedaInstrumento: 'ARS' | 'USD',
  monedaBase: string,
  tipoCambio: number | undefined,
): CampoPreview | null {
  if (monedaInstrumento === monedaBase || tipoCambio == null) return null
  const convertido = monedaInstrumento === 'USD' ? monto * tipoCambio : monto / tipoCambio
  return {
    label: 'Monto convertido',
    value: `≈ ${formatMoneda(convertido, monedaBase)}`,
    tooltip: MONTO_CONVERTIDO_TOOLTIP,
  }
}
