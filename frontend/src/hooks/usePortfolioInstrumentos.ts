import { useMemo } from 'react'
import type { PortfolioDetalle } from '@/types'

export function tienePortfolioInstrumentos(detalle: PortfolioDetalle | undefined): boolean {
  if (!detalle) return false
  return detalle.acciones.length + detalle.bonos.length + detalle.letras.length + detalle.plazosFijos.length > 0
}

export function useTienePortfolioInstrumentos(detalle: PortfolioDetalle | undefined): boolean {
  return useMemo(() => tienePortfolioInstrumentos(detalle), [detalle])
}
