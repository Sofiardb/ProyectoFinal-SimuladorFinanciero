import InfoTooltip from '@/components/portfolios/InfoTooltip'

export default function KpiCard({
  label,
  value,
  tooltip,
}: {
  label:    string
  value:    string
  tooltip?: { term: string; definition: string }
}) {
  return (
    <div className="card">
      <p className="card-section-label mb-4 flex items-center gap-1">
        {label}
        {tooltip && <InfoTooltip term={tooltip.term} definition={tooltip.definition} />}
      </p>
      <p className="font-display text-xl font-bold text-navy-950">{value}</p>
    </div>
  )
}
