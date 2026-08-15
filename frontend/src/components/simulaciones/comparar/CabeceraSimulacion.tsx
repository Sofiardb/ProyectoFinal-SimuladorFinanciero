import { Skeleton } from '@/components/ui/skeleton'
import PerfilBadge from '@/components/portfolios/PerfilBadge'
import type { ResultadosSimulacionView } from '@/hooks/useResultadosSimulacionView'
import { formatFecha } from '@/lib/format'
import { PuntoLado, type Lado } from './ladoComparacion'
import SelectorSimulacion, { type Grupo } from './SelectorSimulacion'

export default function CabeceraSimulacion({
  lado,
  view,
  idSimulacion,
  onChange,
  grupos,
}: {
  lado: Lado
  view: ResultadosSimulacionView
  idSimulacion: number | null
  onChange: (id: number | null) => void
  grupos: Grupo[]
}) {
  return (
    <div className="flex flex-col gap-2">
      <SelectorSimulacion lado={lado} idSimulacion={idSimulacion} onChange={onChange} grupos={grupos} />
      {view.isLoading ? (
        <Skeleton className="h-6 w-40" />
      ) : !view.sim || !view.detalle ? (
        <p className="text-[13px] text-ink-soft">Elegí una simulación para ver el detalle.</p>
      ) : (
        <div className="flex flex-wrap items-center gap-2">
          <PuntoLado lado={lado} />
          <span className="font-semibold text-navy-950">{view.detalle.nombre}</span>
          <PerfilBadge nombre={view.detalle.nombrePerfilRiesgo} />
          <span className="text-[11.5px] text-ink-soft">
            {formatFecha(view.sim.fechaEjecucion)} · {view.sim.horizonteMeses} meses
          </span>
        </div>
      )}
    </div>
  )
}
