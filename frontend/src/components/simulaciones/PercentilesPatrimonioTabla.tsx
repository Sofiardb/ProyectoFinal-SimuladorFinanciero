import { formatMoneda } from '@/lib/format'
import type { StatsVector } from '@/types'

function ultimo(v: number[] | undefined): number | undefined {
  return v && v.length > 0 ? v[v.length - 1] : undefined
}

export default function PercentilesPatrimonioTabla({
  titulo,
  moneda,
  patrimonio,
  gananciasReales,
}: {
  titulo:          string
  moneda:          'ARS' | 'USD'
  patrimonio:      StatsVector
  gananciasReales: StatsVector
}) {
  return (
    <div className="card overflow-x-auto">
      <p className="card-section-label mb-3">{titulo}</p>
      <table className="w-full text-[12.5px]">
        <thead>
          <tr className="text-left text-ink-soft">
            <th className="pb-2 font-semibold">Percentil</th>
            <th className="pb-2 font-semibold">Patrimonio</th>
            <th className="pb-2 font-semibold">Ganancia real</th>
          </tr>
        </thead>
        <tbody>
          {(['p25', 'mediana', 'p75'] as const).map((p) => (
            <tr key={p} className="border-t border-line">
              <td className="py-2 font-semibold text-navy-950">{p === 'mediana' ? 'Mediana' : p.toUpperCase()}</td>
              <td className="py-2">{formatMoneda(ultimo(patrimonio[p]) ?? 0, moneda)}</td>
              <td className="py-2">{formatMoneda(ultimo(gananciasReales[p]) ?? 0, moneda)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
