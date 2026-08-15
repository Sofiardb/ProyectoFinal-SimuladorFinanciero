import type { ReactNode } from 'react'
import { Skeleton } from '@/components/ui/skeleton'
import type { ResultadosSimulacionView } from '@/hooks/useResultadosSimulacionView'
import type { InstrumentoSimulacion, PortfolioDetalle, ResultadoSimulacionRow, SimulacionDetalle } from '@/types'
import { EtiquetaLado, type Lado } from './ladoComparacion'

/** Fila de comparación: mismo tipo de contenido para las dos simulaciones elegidas, una al lado
 * de la otra en desktop y apiladas en mobile*/
export function FilaComparacion({ children }: { children: [ReactNode, ReactNode] }) {
  return (
    <div className="comparacion-grid mb-5">
      <div>{children[0]}</div>
      <div>{children[1]}</div>
    </div>
  )
}

export function Columna({
  view,
  lado,
  alto = 'h-40',
  children,
}: {
  view: ResultadosSimulacionView
  lado: Lado
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
  const contenido = children({ sim: view.sim, filas: view.filas, detalle: view.detalle, instrumentos: view.instrumentos })
  if (contenido == null) return null
  return (
    <div className="mt-2">
      <div className="mt-2 mb-2 lg:hidden">
        <EtiquetaLado lado={lado} texto={view.detalle?.nombre} />
      </div>
      {contenido}
    </div>
  )
}
