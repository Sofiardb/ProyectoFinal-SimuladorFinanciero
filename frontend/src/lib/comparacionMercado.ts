import { formatMoneda, formatPorcentaje } from '@/lib/format'
import { GBM_TOOLTIPS } from '@/lib/tooltips'
import type { InstrumentoPreviewItem } from '@/types'

export interface Metrica {
  label:      string
  oldDisplay: string
  newDisplay: string
  subida:     boolean | null // null = sin cambio
  tooltip?:   { term: string; definition: string }
}

export interface Fila {
  id:         string
  identifier: string
  tipoLabel:  string
  metricas:   Metrica[]
  notaMonto?: string
}

function cambio(a?: number, b?: number): boolean {
  if (a == null || b == null) return a !== b
  if (a === 0) return b !== 0
  return Math.abs((b - a) / a) >= 0.001
}

export function construirFilas(instrumentos: InstrumentoPreviewItem[]): Fila[] {
  const filas: Fila[] = []

  for (const inst of instrumentos) {
    const metricas: Metrica[] = []
    let notaMonto: string | undefined

    if (inst.estado === 'ACTUALIZADO' && inst.precioMercado != null) {
      const moneda = inst.tipo === 'accion' ? 'USD' : 'ARS'
      const label = inst.tipo === 'accion' ? 'Precio (por acción)' : 'Precio (VN 100)'
      const prefijo = moneda === 'USD' ? 'USD ' : '$'
      const nombreCantidad = inst.tipo === 'accion' ? 'la misma cantidad de acciones' : 'la misma cantidad de lotes'
      metricas.push({
        label,
        oldDisplay: `${prefijo}${inst.precioOriginal.toFixed(2)}`,
        newDisplay: `${prefijo}${inst.precioMercado.toFixed(2)}`,
        subida: inst.precioMercado > inst.precioOriginal,
      })
      if (inst.montoMercado != null) {
        notaMonto = `Manteniendo ${nombreCantidad}, actualizar este precio hace que el monto invertido derive de ${formatMoneda(inst.montoOriginal, moneda)} a ${formatMoneda(inst.montoMercado, moneda)}.`
      }
    }

    if (inst.tipo === 'bono' || inst.tipo === 'letra') {
      if (inst.estadoTasa === 'ACTUALIZADO' && inst.tasaOriginal != null && inst.tasaMercado != null) {
        metricas.push({
          label: 'Tasa',
          oldDisplay: formatPorcentaje(inst.tasaOriginal * 100),
          newDisplay: formatPorcentaje(inst.tasaMercado * 100),
          subida: inst.tasaMercado > inst.tasaOriginal,
        })
      }
    }

    if (inst.tipo === 'accion' && inst.estadoTasa === 'ACTUALIZADO') {
      if (cambio(inst.muOriginal, inst.muMercado) && inst.muOriginal != null && inst.muMercado != null) {
        metricas.push({
          label: 'Retorno esperado (μ)',
          oldDisplay: formatPorcentaje(inst.muOriginal * 100),
          newDisplay: formatPorcentaje(inst.muMercado * 100),
          subida: inst.muMercado > inst.muOriginal,
          tooltip: GBM_TOOLTIPS.mu,
        })
      }
      if (cambio(inst.sigmaOriginal, inst.sigmaMercado) && inst.sigmaOriginal != null && inst.sigmaMercado != null) {
        metricas.push({
          label: 'Volatilidad (σ)',
          oldDisplay: formatPorcentaje(inst.sigmaOriginal * 100),
          newDisplay: formatPorcentaje(inst.sigmaMercado * 100),
          subida: inst.sigmaMercado > inst.sigmaOriginal,
          tooltip: GBM_TOOLTIPS.sigma,
        })
      }
      if (cambio(inst.rhoOriginal, inst.rhoMercado) && inst.rhoOriginal != null && inst.rhoMercado != null) {
        metricas.push({
          label: 'Correlación (ρ)',
          oldDisplay: formatPorcentaje(inst.rhoOriginal * 100),
          newDisplay: formatPorcentaje(inst.rhoMercado * 100),
          subida: inst.rhoMercado > inst.rhoOriginal,
          tooltip: GBM_TOOLTIPS.rho,
        })
      }
    }

    if (metricas.length > 0) {
      filas.push({
        id: inst.id,
        identifier: inst.ticker ?? inst.entidadFinanciera ?? inst.id,
        tipoLabel:
          inst.tipo === 'accion' ? 'Acciones' : inst.tipo === 'bono' ? 'Bono' : inst.tipo === 'letra' ? 'Letra' : inst.tipo,
        metricas,
        notaMonto,
      })
    }
  }

  return filas
}
