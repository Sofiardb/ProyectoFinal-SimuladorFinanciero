
export default function ValorPorMoneda({
  combinado,
  ars,
  usd,
  formatCombinado,
  formatArs,
  formatUsd,
}: {
  combinado:       number | null | undefined
  ars:             number | null | undefined
  usd:             number | null | undefined
  formatCombinado: (v: number) => string
  formatArs:       (v: number) => string
  formatUsd:       (v: number) => string
}) {
  if (combinado != null) return <>{formatCombinado(combinado)}</>
  if (ars == null && usd == null) return <>—</>
  return (
    <div className="flex flex-col leading-tight">
      <span>{ars != null ? formatArs(ars) : '—'}</span>
      <span className="text-ink-soft">{usd != null ? formatUsd(usd) : '—'}</span>
    </div>
  )
}
