import { Link } from 'react-router-dom'
import ValorPorMoneda from '@/components/simulaciones/ValorPorMoneda'
import { formatFecha, formatMoneda } from '@/lib/format'
import type { SimulacionResumen } from '@/types'

export default function HistorialSimulacionesCard({
  simulaciones,
  codigoMonedaBase,
  onEliminar,
}: {
  simulaciones: SimulacionResumen[] | undefined
  codigoMonedaBase: string
  onEliminar: (simulacion: SimulacionResumen) => void
}) {
  return (
    <div className="mt-5 rounded-xl border border-line bg-white p-6">
      <div className="mb-4 flex items-center justify-between">
        <p className="font-display text-[15px] font-semibold text-navy-950">Historial de simulaciones</p>
        <Link
          to="/simulaciones"
          className="text-[12.5px] font-semibold whitespace-nowrap text-navy-950 hover:underline"
        >
          Ver todo el historial
        </Link>
      </div>
      {!simulaciones || simulaciones.length === 0 ? (
        <p className="text-[13px] text-ink-soft">Todavía no corriste simulaciones para este portfolio.</p>
      ) : (
        <div className="flex flex-col gap-2">
          {simulaciones.slice(0, 5).map((s) => (
            <div key={s.idSimulacion} className="tenencia-row">
              <div className="min-w-0 flex-1 basis-32">
                <p className="tenencia-row-title">{formatFecha(s.fechaEjecucion)}</p>
                <p className="tenencia-row-subtitle">{s.horizonteMeses} meses</p>
              </div>
              <div className="tenencia-row-stats">
                <div className="text-right">
                  <p className="stat-label">Valor esperado</p>
                  <p className="mt-0.5 stat-value">
                    <ValorPorMoneda
                      combinado={s.valorEsperado}
                      ars={s.valorEsperadoArs}
                      usd={s.valorEsperadoUsd}
                      formatCombinado={(v) => formatMoneda(v, codigoMonedaBase)}
                      formatArs={(v) => formatMoneda(v, 'ARS')}
                      formatUsd={(v) => formatMoneda(v, 'USD')}
                    />
                  </p>
                </div>
              </div>
              <Link to={`/simulaciones/${s.idSimulacion}`} className="tenencia-row-action">
                Ver →
              </Link>
              <button onClick={() => onEliminar(s)} className="tenencia-row-action-danger">
                Eliminar
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
