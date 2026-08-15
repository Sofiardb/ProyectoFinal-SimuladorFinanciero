import type { SimulacionConPortfolio } from '@/api/hooks'
import { formatFecha } from '@/lib/format'
import { EtiquetaLado, type Lado } from './ladoComparacion'

export interface Grupo {
  idPortfolio:     number
  nombrePortfolio: string
  items:           SimulacionConPortfolio[]
}

/** Selector de simulación para un lado (A o B) — arriba de todo, fija qué se compara en cada fila. */
export default function SelectorSimulacion({
  lado,
  idSimulacion,
  onChange,
  grupos,
}: {
  lado:         Lado
  idSimulacion: number | null
  onChange:     (id: number | null) => void
  grupos:       Grupo[]
}) {
  return (
    <div>
      <EtiquetaLado lado={lado} className="mb-1.5" />
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
    </div>
  )
}
