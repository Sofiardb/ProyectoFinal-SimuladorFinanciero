import { ChevronLeft, ChevronRight, X } from 'lucide-react'
import type { GuiaResultados } from '@/hooks/useGuiaResultados'


export default function GuiaResultadosSlot({ guia, slot }: { guia: GuiaResultados; slot: string }) {
  const { pasoActual, rango, pasoActualItem, ir, cerrar } = guia

  if (pasoActual === null || !pasoActualItem || pasoActualItem.slot !== slot) return null

  return (
    <div
      id="guia-banner-activo"
      className="mb-5 flex flex-col gap-3 rounded-xl border-2 border-blue-brand bg-white p-4 shadow-[0_4px_16px_rgba(15,39,64,0.12)] last:mb-0"
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[11px] font-bold tracking-[0.4px] text-ink-soft uppercase">
            {pasoActual - rango.min + 1} de {rango.max - rango.min + 1}
          </p>
          <p className="font-display text-base font-bold text-navy-950">{pasoActualItem.term}</p>
        </div>
        <button onClick={cerrar} className="shrink-0 text-ink-muted hover:text-navy-950" aria-label="Cerrar guía">
          <X className="size-5" />
        </button>
      </div>

      <p className="text-[13px] leading-relaxed whitespace-pre-line text-ink-muted">{pasoActualItem.texto}</p>

      <div className="flex items-center justify-between gap-3 pt-1">
        <button
          onClick={() => ir(pasoActual - 1)}
          disabled={pasoActual === rango.min}
          className="btn-secondary inline-flex items-center gap-1 disabled:opacity-40"
        >
          <ChevronLeft className="size-4" />
          Anterior
        </button>
        {pasoActual === rango.max ? (
          <button onClick={cerrar} className="btn-primary">
            Cerrar
          </button>
        ) : (
          <button onClick={() => ir(pasoActual + 1)} className="btn-primary inline-flex items-center gap-1">
            Siguiente
            <ChevronRight className="size-4" />
          </button>
        )}
      </div>
    </div>
  )
}
