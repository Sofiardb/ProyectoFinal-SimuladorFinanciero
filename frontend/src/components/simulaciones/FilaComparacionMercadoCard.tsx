import InfoTooltip from '@/components/portfolios/InfoTooltip'
import type { Fila } from '@/lib/comparacionMercado'

export default function FilaComparacionMercadoCard({ fila }: { fila: Fila }) {
  return (
    <div className="card flex flex-col gap-3">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-[160px]">
          <p className="text-[13.5px] font-semibold text-navy-950">{fila.identifier}</p>
          <p className="mt-0.5 text-[11.5px] text-ink-soft">{fila.tipoLabel}</p>
        </div>

        <div className="flex flex-1 flex-wrap justify-end gap-x-8 gap-y-3">
          {fila.metricas.map((m) => (
            <div key={m.label} className="flex items-center gap-3">
              <div className="text-right">
                <p className="mb-0.5 flex items-center justify-end gap-1 text-[10.5px] text-ink-soft uppercase">
                  {m.label}
                  {m.tooltip && <InfoTooltip term={m.tooltip.term} definition={m.tooltip.definition} />}
                </p>
                <p className="text-[13px] font-semibold text-ink-muted">{m.oldDisplay}</p>
              </div>
              <span
                className={m.subida === null ? 'text-ink-soft' : m.subida ? 'text-accent-blue-strong' : 'text-danger'}
              >
                {m.subida === null ? '=' : m.subida ? '↑' : '↓'}
              </span>
              <div className="text-left">
                <p className="mb-0.5 text-[10.5px] text-ink-soft uppercase">Hoy</p>
                <p className={'text-[13px] font-bold ' + (m.subida === false ? 'text-danger' : 'text-accent-blue-strong')}>
                  {m.newDisplay}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {fila.notaMonto && <p className="text-[11.5px] text-warning-text">⚠ {fila.notaMonto}</p>}
    </div>
  )
}
