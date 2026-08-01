import type { SimulacionConPortfolio } from '@/api/hooks'
import { formatFecha } from '@/lib/format'

export interface Grupo {
  idPortfolio:     number
  nombrePortfolio: string
  items:           SimulacionConPortfolio[]
}

/** Selector de simulación para un lado (A o B) — arriba de todo, fija qué se compara en cada fila. */
export default function SelectorSimulacion({
  idSimulacion,
  onChange,
  grupos,
}: {
  idSimulacion: number | null
  onChange:     (id: number | null) => void
  grupos:       Grupo[]
}) {
  return (
    <select
      value={idSimulacion ?? ''}
      onChange={(e) => onChange(e.target.value ? Number(e.target.value) : null)}
      className="field-input"
    >
      <option value="">Elegí una simulación…</option>
      {grupos.map((g) => (
        <optgroup key={g.idPortfolio} label={g.nombrePortfolio}>
          {g.items.map((s) => (
            <option key={s.idSimulacion} value={s.idSimulacion}>
              {formatFecha(s.fechaEjecucion)} · {s.horizonteMeses} meses
            </option>
          ))}
        </optgroup>
      ))}
    </select>
  )
}
