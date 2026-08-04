import { Link } from 'react-router-dom'
import PerfilBadge from '@/components/portfolios/PerfilBadge'
import ValorPorMoneda from '@/components/simulaciones/ValorPorMoneda'
import type { SimulacionConPortfolio } from '@/api/hooks'
import { formatFecha, formatMoneda, formatPorcentaje } from '@/lib/format'

interface Props {
  filas: SimulacionConPortfolio[]
  seleccionadas: number[]
  onToggleSeleccion: (idSimulacion: number) => void
  onEliminar: (simulacion: SimulacionConPortfolio) => void
}

export default function HistorialTabla({ filas, seleccionadas, onToggleSeleccion, onEliminar }: Props) {
  return (
    <div className="fade-in-content card overflow-x-auto p-0">
      <table className="w-full text-[12.5px]">
        <thead>
          <tr className="border-b border-line text-left text-ink-soft">
            <th className="px-4 py-3 font-semibold"></th>
            <th className="px-2 py-3 font-semibold">Portfolio</th>
            <th className="px-2 py-3 font-semibold">Perfil</th>
            <th className="px-2 py-3 font-semibold">Fecha</th>
            <th className="px-2 py-3 font-semibold">Horizonte</th>
            <th className="px-2 py-3 font-semibold">Valor final</th>
            <th className="px-2 py-3 font-semibold">Retorno esperado</th>
            <th className="px-4 py-3 font-semibold">Resultados</th>
            <th className="px-4 py-3 font-semibold"></th>
          </tr>
        </thead>
        <tbody>
          {filas.map((s) => {
            const marcada = seleccionadas.includes(s.idSimulacion)
            const deshabilitada = !marcada && seleccionadas.length >= 2
            return (
              <tr key={s.idSimulacion} className="border-b border-line last:border-b-0">
                <td className="px-4 py-3">
                  <input
                    type="checkbox"
                    checked={marcada}
                    disabled={deshabilitada}
                    onChange={() => onToggleSeleccion(s.idSimulacion)}
                    aria-label={`Seleccionar simulación de ${s.nombrePortfolio} del ${formatFecha(s.fechaEjecucion)} para comparar`}
                  />
                </td>
                <td className="px-2 py-3 font-semibold text-navy-950">{s.nombrePortfolio}</td>
                <td className="px-2 py-3"><PerfilBadge nombre={s.nombrePerfilRiesgo} /></td>
                <td className="px-2 py-3 text-ink-muted">{formatFecha(s.fechaEjecucion)}</td>
                <td className="px-2 py-3 text-ink-muted">{s.horizonteMeses} meses</td>
                <td className="px-2 py-3 text-navy-950">
                  <ValorPorMoneda
                    combinado={s.valorEsperado}
                    ars={s.valorEsperadoArs}
                    usd={s.valorEsperadoUsd}
                    formatCombinado={(v) => formatMoneda(v, s.codigoMonedaBase)}
                    formatArs={(v) => formatMoneda(v, 'ARS')}
                    formatUsd={(v) => formatMoneda(v, 'USD')}
                  />
                </td>
                <td className="px-2 py-3 text-navy-950">
                  <ValorPorMoneda
                    combinado={s.retornoEsperadoPct != null ? s.retornoEsperadoPct * 100 : null}
                    ars={s.retornoEsperadoPctArs != null ? s.retornoEsperadoPctArs * 100 : null}
                    usd={s.retornoEsperadoPctUsd != null ? s.retornoEsperadoPctUsd * 100 : null}
                    formatCombinado={formatPorcentaje}
                    formatArs={formatPorcentaje}
                    formatUsd={formatPorcentaje}
                  />
                </td>
                <td className="px-4 py-3">
                  <Link to={`/simulaciones/${s.idSimulacion}`} className="font-semibold text-navy-950 hover:underline">
                    Ver →
                  </Link>
                </td>
                <td className="px-4 py-3">
                  <button onClick={() => onEliminar(s)} className="font-semibold text-danger hover:underline">
                    Eliminar
                  </button>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
