import type { SimulacionResumen } from '@/types'

export default function SimulacionFinalizadaCard({
  resumen,
  nombrePortfolio,
  onVolverAlPortfolio,
  onVerResultados,
}: {
  resumen:             SimulacionResumen
  nombrePortfolio:     string
  onVolverAlPortfolio: () => void
  onVerResultados:     () => void
}) {
  return (
    <div className="card p-14 text-center">
      <div className="mx-auto mb-5 flex size-14 items-center justify-center rounded-full bg-riesgo-moderado-bg text-2xl text-accent-blue-strong">
        ✓
      </div>
      <p className="mb-2 font-display text-xl font-semibold text-navy-950">Simulación finalizada</p>
      <p className="mx-auto mb-6 max-w-[420px] text-sm leading-relaxed text-ink-muted">
        Se corrieron {resumen.numTrayectorias.toLocaleString('es-AR')} trayectorias Monte Carlo para{' '}
        {nombrePortfolio} a {resumen.horizonteMeses} meses.
      </p>
      <div className="flex flex-wrap justify-center gap-3">
        <button onClick={onVolverAlPortfolio} className="btn-secondary">
          Volver al portfolio
        </button>
        <button data-tour="tour-ver-resultados" onClick={onVerResultados} className="btn-primary">
          Ver resultados →
        </button>
      </div>
    </div>
  )
}
