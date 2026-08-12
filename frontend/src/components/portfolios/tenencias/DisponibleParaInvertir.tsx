import { formatMoneda } from '@/lib/format'

export default function DisponibleParaInvertir({
  disponible,
  monedaBase,
}: {
  disponible: number | null
  monedaBase: string
}) {
  if (disponible == null) {
    return <p className="mb-0.5 text-[11.5px] text-ink-soft">Sin límite de presupuesto.</p>
  }

  return (
    <p className="mb-0.5 text-[11.5px] font-semibold text-navy-950">
      Disponible para invertir:{' '}
      <span className={disponible <= 0 ? 'font-semibold text-danger' : 'font-semibold text-navy-950'}>
        {formatMoneda(disponible, monedaBase)}
      </span>
    </p>
  )
}
