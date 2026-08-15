import TenenciaResumenRow from '@/components/portfolios/tenencias/TenenciaResumenRow'
import type { FilaTenenciaResumen } from './filasPortfolio'

export default function DetallePortfolioResumenCard({
  usdFilas,
  arsFilas,
  idPortfolio,
  bloqueado,
}: {
  usdFilas:    FilaTenenciaResumen[]
  arsFilas:    FilaTenenciaResumen[]
  idPortfolio: number
  bloqueado:   boolean
}) {
  return (
    <div className="card mb-5 flex flex-col gap-5">
      <p className="card-section-label">Detalle del portfolio</p>
      {usdFilas.length > 0 && (
        <div>
          <p className="mb-2 text-[11px] font-bold tracking-[0.4px] text-currency-usd">
            USD · ACCIONES Y PLAZO FIJO
          </p>
          <div className="flex flex-col gap-2">
            {usdFilas.map((f) => (
              <TenenciaResumenRow
                key={f.id}
                titulo={f.titulo}
                subtitulo={f.subtitulo}
                campos={f.campos}
                idPortfolio={idPortfolio}
                instrumento={f.instrumento}
              />
            ))}
          </div>
        </div>
      )}
      {arsFilas.length > 0 && (
        <div>
          <p className="mb-2 text-[11px] font-bold tracking-[0.4px] text-currency-ars">
            ARS · BONOS, LETRAS Y PLAZO FIJO
          </p>
          <div className="flex flex-col gap-2">
            {arsFilas.map((f) => (
              <TenenciaResumenRow
                key={f.id}
                titulo={f.titulo}
                subtitulo={f.subtitulo}
                campos={f.campos}
                idPortfolio={idPortfolio}
                instrumento={f.instrumento}
              />
            ))}
          </div>
        </div>
      )}
      {usdFilas.length === 0 && arsFilas.length === 0 && (
        <p className="text-[13px] text-ink-muted">Este portfolio todavía no tiene instrumentos.</p>
      )}
      {bloqueado && (
        <p className="text-[12.5px] text-danger">
          Hay instrumentos vencidos que bloquean esta simulación. Eliminalos o reemplazalos desde el detalle del
          portfolio.
        </p>
      )}
    </div>
  )
}
