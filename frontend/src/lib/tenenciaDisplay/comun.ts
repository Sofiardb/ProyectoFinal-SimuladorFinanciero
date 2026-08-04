import { formatPorcentaje } from '@/lib/format'
import { PRECIO_VN_TOOLTIP } from '@/lib/tooltips'
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
