import EscenarioChart from '@/components/charts/EscenarioChart'
import InfoTooltip from '@/components/portfolios/InfoTooltip'
import GuiaResultadosTrigger from '@/components/simulaciones/GuiaResultadosTrigger'
import PillButton from '@/components/ui/pill-button'
import { usePanelGraficoState } from '@/hooks/usePanelGraficoState'
import { ESCENARIOS_COLOR } from '@/lib/escenarios'
import { formatMoneda } from '@/lib/format'
import { RESULTADOS_TOOLTIPS } from '@/lib/tooltips'
import type {
  InstrumentoSimulacion,
  MetricaResultado,
  PortfolioDetalle,
  ResultadoSimulacionRow,
} from '@/types'

const METRICAS: { key: MetricaResultado; label: string; tooltip: { term: string; definition: string } }[] = [
  { key: 'patrimonio', label: 'Patrimonio', tooltip: RESULTADOS_TOOLTIPS.patrimonio },
  { key: 'ganancias_nominales', label: 'Ganancias nominales', tooltip: RESULTADOS_TOOLTIPS.gananciasNominales },
  { key: 'ganancias_reales', label: 'Ganancias reales', tooltip: RESULTADOS_TOOLTIPS.gananciasReales },
]

interface PanelGraficoResultadosProps {
  titulo: string
  ambitosDisponibles: string[]
  seleccionUnica: boolean
  moneda: 'ARS' | 'USD'
  filas: ResultadoSimulacionRow[]
  detalle: PortfolioDetalle | undefined
  instrumentos: InstrumentoSimulacion[] | undefined
  montoInvertidoDe: (ambito: string) => number | undefined
  guiaAnchors?: boolean
  dataGuiaPanel?: string
  onAbrirGuia?: () => void
}

export default function PanelGraficoResultados({
  titulo,
  ambitosDisponibles,
  seleccionUnica,
  moneda,
  filas,
  detalle,
  instrumentos,
  montoInvertidoDe,
  guiaAnchors,
  dataGuiaPanel,
  onAbrirGuia,
}: PanelGraficoResultadosProps) {
  const {
    ambitosSeleccionados,
    metrica,
    setMetrica,
    escenario,
    setEscenario,
    modoA,
    setModoA,
    compararNominalReal,
    setCompararNominalReal,
    elegirAmbito,
    labelDe,
    monedaActual,
    mostrarBanda,
    puedeCompararNominalReal,
    breakeven,
    vencimientos,
    series,
  } = usePanelGraficoState({ ambitosDisponibles, seleccionUnica, moneda, filas, detalle, instrumentos, montoInvertidoDe })

  if (ambitosDisponibles.length === 0) return null

  return (
    <div className="card flex h-full flex-col gap-4" data-guia={dataGuiaPanel}>
      <p className="card-section-label flex items-center gap-1">
        {titulo}
        {onAbrirGuia && <GuiaResultadosTrigger onClick={onAbrirGuia} />}
      </p>

      <div className="flex flex-wrap gap-1.5">
        {ambitosDisponibles.map((a) => (
          <PillButton key={a} active={ambitosSeleccionados.includes(a)} onClick={() => elegirAmbito(a)}>
            {labelDe(a)}
          </PillButton>
        ))}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-1.5" data-guia={guiaAnchors ? 'panel-metricas' : undefined}>
          {METRICAS.map((m) => {
            const activa = compararNominalReal && puedeCompararNominalReal && m.key !== 'patrimonio'
              ? true
              : metrica === m.key
            return (
              <span key={m.key} className="inline-flex items-center gap-0.5">
                <PillButton active={activa} onClick={() => setMetrica(m.key)}>
                  {m.label}
                </PillButton>
                {metrica === m.key && <InfoTooltip term={m.tooltip.term} definition={m.tooltip.definition} />}
              </span>
            )
          })}
        </div>

        <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
          {puedeCompararNominalReal && (
            <label
              className="flex items-center gap-1.5 text-[12px] whitespace-nowrap text-ink-muted"
              data-guia={guiaAnchors ? 'panel-nominal-real' : undefined}
            >
              <input
                type="checkbox"
                checked={compararNominalReal}
                onChange={(e) => setCompararNominalReal(e.target.checked)}
              />
              Comparar nominal vs. real
            </label>
          )}
          {ambitosSeleccionados.length === 1 && (
            <label className="flex items-center gap-1.5 text-[12px] whitespace-nowrap text-ink-muted">
              <input type="checkbox" checked={modoA} onChange={(e) => setModoA(e.target.checked)} />
              Comparar los 3 escenarios
            </label>
          )}
          {!modoA && (
            <div className="flex flex-wrap items-center gap-1" data-guia={guiaAnchors ? 'panel-escenarios' : undefined}>
              <PillButton active={escenario === 'global'} onClick={() => setEscenario('global')} size="sm">
                Global
              </PillButton>
              {ESCENARIOS_COLOR.map((e) => (
                <button
                  key={e.key}
                  onClick={() => setEscenario(e.key)}
                  className={
                    escenario === e.key
                      ? 'rounded-full px-2.5 py-1 text-[11px] font-semibold text-white'
                      : 'rounded-full border px-2.5 py-1 text-[11px] font-semibold'
                  }
                  style={
                    escenario === e.key
                      ? { backgroundColor: e.color }
                      : { borderColor: e.color, color: e.color }
                  }
                >
                  {e.label}
                </button>
              ))}
              <InfoTooltip term={RESULTADOS_TOOLTIPS.escenarios.term} definition={RESULTADOS_TOOLTIPS.escenarios.definition} />
            </div>
          )}
        </div>
      </div>

      <div className="h-[320px]" data-guia={guiaAnchors ? 'panel-grafico' : undefined}>
        <EscenarioChart
          series={series}
          mostrarBanda={mostrarBanda}
          mostrarMinMax={mostrarBanda && !compararNominalReal}
          formatY={(v) => formatMoneda(v, monedaActual)}
          vencimientos={vencimientos}
          breakeven={breakeven}
          height="100%"
        />
      </div>

      {vencimientos.length > 0 && metrica === 'ganancias_reales' && (
        <p className="rounded-lg bg-line-soft px-3 py-2 text-[11.5px] leading-relaxed text-ink-muted">
          <strong className="text-ink-soft">{RESULTADOS_TOOLTIPS.zonaVencida.term}: </strong>
          {RESULTADOS_TOOLTIPS.zonaVencida.definition} Acá afecta a{' '}
          {vencimientos.map((v) => v.label).join(', ')}.
        </p>
      )}
    </div>
  )
}
