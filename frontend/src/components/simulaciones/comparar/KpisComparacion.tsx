import KpisPortfolioGrid from '@/components/simulaciones/KpisPortfolioGrid'
import type { ResultadosSimulacionView } from '@/hooks/useResultadosSimulacionView'
import type { ResultadoSimulacionRow, SimulacionDetalle } from '@/types'

export default function KpisComparacion({
  view,
}: {
  sim:   SimulacionDetalle
  filas: ResultadoSimulacionRow[]
  view:  ResultadosSimulacionView
}) {
  return (
    <KpisPortfolioGrid
      className="grid grid-cols-2 gap-3"
      kpisPortfolio={view.kpisPortfolio}
      inflacionAcumuladaArs={view.inflacionAcumuladaArs}
      inflacionAcumuladaUsd={view.inflacionAcumuladaUsd}
    />
  )
}
