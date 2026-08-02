import { useEffect, useMemo, useState } from 'react'
import EscenarioChart, { type BreakevenMarcador, type SerieEscenario, type VencimientoMarcador } from '@/components/charts/EscenarioChart'
import InfoTooltip from '@/components/portfolios/InfoTooltip'
import GuiaResultadosTrigger from '@/components/simulaciones/GuiaResultadosTrigger'
import { resolveAmbitoInfo } from '@/lib/tenenciaDisplay'
import { formatMoneda } from '@/lib/format'
import { RESULTADOS_TOOLTIPS } from '@/lib/tooltips'
import type {
  EscenarioNombre,
  InstrumentoSimulacion,
  MetricaResultado,
  PortfolioDetalle,
  ResultadoSimulacionRow,
} from '@/types'

const ESCENARIOS: { key: EscenarioNombre; label: string; color: string }[] = [
  { key: 'favorable', label: 'Favorable', color: 'var(--color-favorable)' },
  { key: 'moderado', label: 'Moderado', color: 'var(--color-moderado)' },
  { key: 'desfavorable', label: 'Desfavorable', color: 'var(--color-desfavorable)' },
]

const METRICAS: { key: MetricaResultado; label: string; tooltip: { term: string; definition: string } }[] = [
  { key: 'patrimonio', label: 'Patrimonio', tooltip: RESULTADOS_TOOLTIPS.patrimonio },
  { key: 'ganancias_nominales', label: 'Ganancias nominales', tooltip: RESULTADOS_TOOLTIPS.gananciasNominales },
  { key: 'ganancias_reales', label: 'Ganancias reales', tooltip: RESULTADOS_TOOLTIPS.gananciasReales },
]

function metricaOpuesta(m: MetricaResultado): MetricaResultado {
  return m === 'ganancias_nominales' ? 'ganancias_reales' : 'ganancias_nominales'
}

function metricaCorta(m: MetricaResultado): string {
  return m === 'ganancias_nominales' ? 'Nominal' : 'Real'
}

const COLOR_NOMINAL = '#2a78d6'
const COLOR_REAL = '#c1740f'

const PALETA_INSTRUMENTOS = ['#2a78d6', '#008300', '#e87ba4', '#eda100', '#1baf7a', '#eb6834', '#4a3aa7', '#e34948']

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
  const [ambitosSeleccionados, setAmbitosSeleccionados] = useState<string[]>(
    ambitosDisponibles.length > 0 ? [ambitosDisponibles[0]] : [],
  )
  const [metrica, setMetrica] = useState<MetricaResultado>('patrimonio')
  const [escenario, setEscenario] = useState<EscenarioNombre>('global')
  const [modoA, setModoA] = useState(false)
  const [compararNominalReal, setCompararNominalReal] = useState(false)

  useEffect(() => {
    if (ambitosSeleccionados.length > 0 || ambitosDisponibles.length === 0) return
    setAmbitosSeleccionados([ambitosDisponibles[0]])
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ambitosDisponibles])

  function filaFor(ambito: string, esc: EscenarioNombre, met: MetricaResultado) {
    return filas.find((f) => f.ambito === ambito && f.escenario === esc && f.metrica === met)?.stats
  }

  function labelDe(ambito: string): string {
    if (ambito === 'portfolio_ars') return 'Portfolio (ARS)'
    if (ambito === 'portfolio_usd') return 'Portfolio (USD)'
    return detalle ? resolveAmbitoInfo(ambito, detalle).label : ambito
  }

  function monedaDe(ambito: string): 'ARS' | 'USD' {
    if (ambito === 'portfolio_ars') return 'ARS'
    if (ambito === 'portfolio_usd') return 'USD'
    return moneda
  }

  const monedaActual = ambitosSeleccionados.length === 1 ? monedaDe(ambitosSeleccionados[0]) : moneda

  function elegirAmbito(ambito: string) {
    if (seleccionUnica) {
      setAmbitosSeleccionados([ambito])
      return
    }
    setAmbitosSeleccionados((prev) => (prev.includes(ambito) ? prev.filter((a) => a !== ambito) : [...prev, ambito]))
  }

  const mostrarBanda = !modoA && ambitosSeleccionados.length === 1

  useEffect(() => {
    if (modoA && ambitosSeleccionados.length !== 1) setModoA(false)
  }, [modoA, ambitosSeleccionados.length])

  const puedeCompararNominalReal = metrica !== 'patrimonio' && !modoA && ambitosSeleccionados.length === 1
  useEffect(() => {
    if (compararNominalReal && !puedeCompararNominalReal) setCompararNominalReal(false)
  }, [compararNominalReal, puedeCompararNominalReal])


  const breakeven: BreakevenMarcador | undefined = useMemo(() => {
    if (ambitosSeleccionados.length !== 1) return undefined
    if (metrica === 'patrimonio') {
      const monto = montoInvertidoDe(ambitosSeleccionados[0])
      return monto != null ? { valor: monto } : undefined
    }
    return { valor: 0 }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ambitosSeleccionados, metrica])

  const vencimientos: VencimientoMarcador[] = useMemo(() => {
    if (!instrumentos || ambitosSeleccionados.length === 0) return []
    const relevantes = instrumentos.filter((inst) => {
      if (inst.tVencMeses == null) return false
      if (ambitosSeleccionados.includes('portfolio_ars') || ambitosSeleccionados.includes('portfolio_usd')) return true
      return ambitosSeleccionados.includes(inst.ambito)
    })
    const porMes = new Map<number, string[]>()
    for (const inst of relevantes) {
      const corto = detalle ? resolveAmbitoInfo(inst.ambito, detalle).corto : inst.ambito
      porMes.set(inst.tVencMeses!, [...(porMes.get(inst.tVencMeses!) ?? []), corto])
    }
    return Array.from(porMes.entries()).map(([mes, labels]) => ({ mes, label: labels.join(', ') }))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [instrumentos, ambitosSeleccionados, detalle])

  const series: SerieEscenario[] = useMemo(() => {
    if (ambitosSeleccionados.length === 0) return []

    if (modoA && ambitosSeleccionados.length === 1) {
      const ambito = ambitosSeleccionados[0]
      return ESCENARIOS.flatMap(({ key, label, color }) => {
        const stats = filaFor(ambito, key, metrica)
        return stats ? [{ key, label, color, media: stats.media }] : []
      })
    }

    return ambitosSeleccionados.flatMap((ambito, i) => {
      const stats = filaFor(ambito, escenario, metrica)
      if (!stats) return []
      const label = labelDe(ambito)
      const color = ambitosSeleccionados.length === 1 ? 'var(--color-accent-blue-strong)' : PALETA_INSTRUMENTOS[i % PALETA_INSTRUMENTOS.length]

      let labelPrincipal = label
      let colorPrincipal = color
      let mediaSecundaria: number[] | undefined
      let labelSecundaria: string | undefined
      let colorSecundaria: string | undefined
      let p25Secundaria: number[] | undefined
      let p75Secundaria: number[] | undefined
      if (compararNominalReal && puedeCompararNominalReal) {
        const statsOpuesta = filaFor(ambito, escenario, metricaOpuesta(metrica))
        if (statsOpuesta) {
          labelPrincipal = metricaCorta(metrica)
          colorPrincipal = metrica === 'ganancias_nominales' ? COLOR_NOMINAL : COLOR_REAL
          mediaSecundaria = statsOpuesta.media
          labelSecundaria = metricaCorta(metricaOpuesta(metrica))
          colorSecundaria = metrica === 'ganancias_nominales' ? COLOR_REAL : COLOR_NOMINAL
          p25Secundaria = mostrarBanda ? statsOpuesta.p25 : undefined
          p75Secundaria = mostrarBanda ? statsOpuesta.p75 : undefined
        }
      }

      return [{
        key: ambito,
        label: labelPrincipal,
        color: colorPrincipal,
        media: stats.media,
        mediaSecundaria,
        labelSecundaria,
        colorSecundaria,
        p25Secundaria,
        p75Secundaria,
        p25: mostrarBanda ? stats.p25 : undefined,
        p75: mostrarBanda ? stats.p75 : undefined,
        minimo: mostrarBanda ? stats.minimo : undefined,
        maximo: mostrarBanda ? stats.maximo : undefined,
      }]
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filas, ambitosSeleccionados, metrica, escenario, modoA, detalle, compararNominalReal, puedeCompararNominalReal])

  if (ambitosDisponibles.length === 0) return null

  return (
    <div className="card flex h-full flex-col gap-4" data-guia={dataGuiaPanel}>
      <p className="card-section-label flex items-center gap-1">
        {titulo}
        {onAbrirGuia && <GuiaResultadosTrigger onClick={onAbrirGuia} />}
      </p>

      <div className="flex flex-wrap gap-1.5">
        {ambitosDisponibles.map((a) => (
          <button
            key={a}
            onClick={() => elegirAmbito(a)}
            className={
              ambitosSeleccionados.includes(a)
                ? 'rounded-full bg-navy-950 px-3 py-1 text-[11.5px] font-semibold text-white'
                : 'rounded-full border border-line bg-white px-3 py-1 text-[11.5px] font-semibold text-ink-muted'
            }
          >
            {labelDe(a)}
          </button>
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
                <button
                  onClick={() => setMetrica(m.key)}
                  className={
                    activa
                      ? 'rounded-full bg-navy-950 px-3 py-1 text-[11.5px] font-semibold text-white'
                      : 'rounded-full border border-line bg-white px-3 py-1 text-[11.5px] font-semibold text-ink-muted'
                  }
                >
                  {m.label}
                </button>
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
              {ESCENARIOS.map((e) => (
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
