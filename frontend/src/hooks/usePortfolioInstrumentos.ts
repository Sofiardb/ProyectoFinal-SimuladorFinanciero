import { useMemo } from 'react'
import type { PortfolioDetalle } from '@/types'

/** true si el portfolio tiene al menos un instrumento cargado (acción, bono, letra o plazo fijo).
 * Centralizado acá porque se usa en varios lugares para decidir si "Simular" debe estar habilitado
 * (PortfolioCard, PortfolioDetallePage) — sin instrumentos no hay nada que simular. */
export function useTienePortfolioInstrumentos(detalle: PortfolioDetalle | undefined): boolean {
  return useMemo(() => {
    if (!detalle) return false
    return detalle.acciones.length + detalle.bonos.length + detalle.letras.length + detalle.plazosFijos.length > 0
  }, [detalle])
}
