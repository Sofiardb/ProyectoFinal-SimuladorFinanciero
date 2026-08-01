import { Skeleton } from '@/components/ui/skeleton'
import PerfilBadge from '@/components/portfolios/PerfilBadge'
import type { ResultadosSimulacionView } from '@/hooks/useResultadosSimulacionView'
import { formatFecha } from '@/lib/format'

/** Encabezado con nombre de portfolio, perfil y fecha — arriba de cada columna. */
export default function CabeceraSimulacion({ view }: { view: ResultadosSimulacionView }) {
  if (view.isLoading) return <Skeleton className="h-6 w-40" />
  if (!view.sim || !view.detalle) {
    return <p className="text-[13px] text-ink-soft">Elegí una simulación para ver el detalle.</p>
  }
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="font-semibold text-navy-950">{view.detalle.nombre}</span>
      <PerfilBadge nombre={view.detalle.nombrePerfilRiesgo} />
      <span className="text-[11.5px] text-ink-soft">
        {formatFecha(view.sim.fechaEjecucion)} · {view.sim.horizonteMeses} meses
      </span>
    </div>
  )
}
