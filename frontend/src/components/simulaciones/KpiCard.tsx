import InfoTooltip from '@/components/portfolios/InfoTooltip'
import GuiaResultadosTrigger from '@/components/simulaciones/GuiaResultadosTrigger'

export default function KpiCard({
  label,
  value,
  tooltip,
  dataGuia,
  onAbrirGuia,
}: {
  label:        string
  value:        string
  tooltip?:     { term: string; definition: string }
  dataGuia?:    string
  onAbrirGuia?: () => void
}) {
  return (
    <div className="card" data-guia={dataGuia}>
      <p className="card-section-label mb-4 flex items-center gap-1">
        {label}
        {tooltip && <InfoTooltip term={tooltip.term} definition={tooltip.definition} />}
        {onAbrirGuia && <GuiaResultadosTrigger onClick={onAbrirGuia} />}
      </p>
      <p className="font-display text-xl font-bold text-navy-950">{value}</p>
    </div>
  )
}
