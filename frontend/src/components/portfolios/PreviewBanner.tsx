import { useState } from 'react'
import { formatMoneda, formatFecha } from '@/lib/format'
import { usePortfolioPreview } from '@/api/hooks'

export default function PreviewBanner({
  idPortfolio,
  fechaModificacion,
}: {
  idPortfolio: number
  fechaModificacion: string
}) {
  const [isCompareMode, setIsCompareMode] = useState(false)
  const [dismissed, setDismissed] = useState(false)
  const { data: preview } = usePortfolioPreview(idPortfolio)

  if (!preview || dismissed) return null

  const conCambios = preview.instrumentos.filter((i) => i.estado !== 'IGUAL' && i.estado !== 'ACTIVO')
  if (conCambios.length === 0) return null

  const cerrarComparacion = () => {
    setIsCompareMode(false)
    setDismissed(true)
  }

  return (
    <>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4 rounded-[10px] border border-warning-border bg-warning-bg p-4 sm:px-5">
        <div className="flex items-start gap-3">
          <span className="text-base">⚠</span>
          <div>
            <div className="text-[13.5px] leading-tight font-semibold text-warning-title">
              Algunos instrumentos de este portfolio tuvieron actualizaciones de mercado
            </div>
            <div className="mt-1 text-[12.5px] leading-tight text-warning-text">
              Podés comparar la versión anterior con la actualizada antes de modificar o simular.
            </div>
          </div>
        </div>
        <button
          onClick={() => setIsCompareMode(true)}
          className="h-[38px] shrink-0 whitespace-nowrap rounded-lg border-[1.5px] border-warning-accent bg-white px-4 text-[13px] font-semibold text-warning-title"
        >
          Ver comparación
        </button>
      </div>

      {isCompareMode && (
        <div className="mb-6 rounded-xl border border-line bg-white p-7">
          <p className="mb-1.5 font-display text-[17px] font-semibold text-navy-950">Comparar versiones</p>
          <p className="mb-[22px] text-[13px] text-ink-muted">
            Elegí si continuar con los datos de mercado actualizados o mantener el portfolio como snapshot
            del momento en que fue simulado.
          </p>

          <div className="mb-6 grid grid-cols-1 gap-5 md:grid-cols-2">
            <div className="rounded-[10px] border border-line p-[18px]">
              <p className="mb-3 text-[11px] font-bold tracking-[0.4px] text-ink-soft">
                SNAPSHOT · {formatFecha(fechaModificacion)}
              </p>
              <div className="flex flex-col gap-2">
                {conCambios.map((i) => (
                  <div
                    key={i.id}
                    className="flex items-center justify-between rounded-lg bg-chip px-3.5 py-3 text-[12.5px]"
                  >
                    <span className="font-semibold text-navy-950">
                      {i.ticker ?? i.entidadFinanciera ?? i.id}
                    </span>
                    <span className="text-ink-muted">
                      {formatMoneda(i.montoOriginal, i.codigoMoneda ?? 'ARS')}
                    </span>
                  </div>
                ))}
              </div>
            </div>
            <div className="rounded-[10px] border border-compare-border bg-compare-bg p-[18px]">
              <p className="mb-3 text-[11px] font-bold tracking-[0.4px] text-accent-blue-strong">
                ACTUALIZADO · HOY
              </p>
              <div className="flex flex-col gap-2">
                {conCambios.map((i) => (
                  <div
                    key={i.id}
                    className="flex items-center justify-between rounded-lg bg-riesgo-moderado-bg px-3.5 py-3 text-[12.5px]"
                  >
                    <span className="font-semibold text-navy-950">
                      {i.ticker ?? i.entidadFinanciera ?? i.id}
                    </span>
                    <span
                      className={
                        i.estado === 'VENCIDO' ? 'font-semibold text-danger' : 'font-semibold text-accent-blue-strong'
                      }
                    >
                      {i.montoMercado != null ? formatMoneda(i.montoMercado, i.codigoMoneda ?? 'ARS') : '—'}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="flex flex-wrap justify-end gap-3">
            <button
              onClick={cerrarComparacion}
              className="h-[42px] rounded-lg border-[1.5px] border-navy-950 bg-transparent px-[18px] text-[13.5px] font-semibold whitespace-nowrap text-navy-950"
            >
              Mantener como snapshot
            </button>
            <button
              onClick={cerrarComparacion}
              className="h-[42px] rounded-lg bg-navy-950 px-[18px] text-[13.5px] font-semibold whitespace-nowrap text-white"
            >
              Continuar con datos actualizados
            </button>
          </div>
        </div>
      )}
    </>
  )
}
