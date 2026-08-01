import { Fragment } from 'react'
import KpiCard from '@/components/simulaciones/KpiCard'
import type { ResultadosSimulacionView } from '@/hooks/useResultadosSimulacionView'
import { formatMoneda, formatPorcentaje } from '@/lib/format'
import type { ResultadoSimulacionRow, SimulacionDetalle } from '@/types'

export default function KpisComparacion({
  view,
}: {
  sim:   SimulacionDetalle
  filas: ResultadoSimulacionRow[]
  view:  ResultadosSimulacionView
}) {
  return (
    <div className="grid grid-cols-2 gap-3">
      {view.kpisPortfolio.map((k) => (
        <Fragment key={k.ambito}>
          <KpiCard
            label={view.kpisPortfolio.length > 1 ? `Monto invertido (${k.moneda})` : 'Monto invertido'}
            value={k.montoInvertido != null ? formatMoneda(k.montoInvertido, k.moneda) : '—'}
          />
          <KpiCard
            label={view.kpisPortfolio.length > 1 ? `Valor final (mediana) (${k.moneda})` : 'Valor final (mediana)'}
            value={k.valorFinalMediana != null ? formatMoneda(k.valorFinalMediana, k.moneda) : '—'}
          />
        </Fragment>
      ))}
      <KpiCard
        label="Inflación acumulada (ARS)"
        value={view.inflacionAcumuladaArs != null ? formatPorcentaje((view.inflacionAcumuladaArs - 1) * 100) : '—'}
      />
      <KpiCard
        label="Inflación acumulada (USD)"
        value={view.inflacionAcumuladaUsd != null ? formatPorcentaje((view.inflacionAcumuladaUsd - 1) * 100) : '—'}
      />
    </div>
  )
}
