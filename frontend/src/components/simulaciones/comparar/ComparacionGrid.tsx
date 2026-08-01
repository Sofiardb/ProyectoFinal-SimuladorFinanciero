import type { ReactNode } from 'react'
import { Skeleton } from '@/components/ui/skeleton'
import type { ResultadosSimulacionView } from '@/hooks/useResultadosSimulacionView'
import type { InstrumentoSimulacion, PortfolioDetalle, ResultadoSimulacionRow, SimulacionDetalle } from '@/types'

/** Fila de comparación: mismo tipo de contenido para las dos simulaciones elegidas, una al lado
 * de la otra en desktop y apiladas en mobile*/
export function FilaComparacion({ children }: { children: [ReactNode, ReactNode] }) {
  return (
    <div className="mb-5 grid grid-cols-1 gap-4 lg:grid-cols-2">
      <div>{children[0]}</div>
      <div>{children[1]}</div>
    </div>
  )
}

export function Columna({
  view,
  alto = 'h-40',
  children,
}: {
  view: ResultadosSimulacionView
  alto?: string
  children: (datos: {
    sim: SimulacionDetalle
    filas: ResultadoSimulacionRow[]
    detalle: PortfolioDetalle | undefined
    instrumentos: InstrumentoSimulacion[] | undefined
  }) => ReactNode
}) {
  if (view.isLoading) return <Skeleton className={`${alto} w-full`} />
  if (!view.sim || !view.filas) {
    return (
      <div className={`card flex ${alto} items-center justify-center text-center text-[13px] text-ink-soft`}>
        Elegí una simulación
      </div>
    )
  }
  return <>{children({ sim: view.sim, filas: view.filas, detalle: view.detalle, instrumentos: view.instrumentos })}</>
}
