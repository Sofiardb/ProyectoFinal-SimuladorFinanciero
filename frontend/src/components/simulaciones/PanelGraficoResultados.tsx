import { useEffect, useMemo, useState } from 'react'
import EscenarioChart, { type SerieEscenario, type VencimientoMarcador } from '@/components/charts/EscenarioChart'
import { resolveAmbitoInfo } from '@/lib/tenenciaDisplay'
import { formatMoneda } from '@/lib/format'
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

const METRICAS: { key: MetricaResultado; label: string }[] = [
  { key: 'patrimonio', label: 'Patrimonio' },
  { key: 'ganancias_nominales', label: 'Ganancias nominales' },
  { key: 'ganancias_reales', label: 'Ganancias reales' },
]

// Paleta categórica validada (dataviz skill) para comparar N instrumentos/ámbitos a la vez —
// los colores de escenario (favorable/moderado/desfavorable) están reservados semánticamente.
const PALETA_INSTRUMENTOS = ['#2a78d6', '#008300', '#e87ba4', '#eda100', '#1baf7a', '#eb6834', '#4a3aa7', '#e34948']

interface PanelGraficoResultadosProps {
  titulo: string
  ambitosDisponibles: string[]
  /** true = elegís un solo ámbito a la vez (radio) — se usa para portfolio, donde ARS y USD no
   * pueden convivir en el mismo gráfico por escala/unidad. false = selección múltiple (chips),
   * para comparar varios instrumentos de la misma moneda. */
  seleccionUnica: boolean
  moneda: 'ARS' | 'USD'
  filas: ResultadoSimulacionRow[]
  detalle: PortfolioDetalle | undefined
  instrumentos: InstrumentoSimulacion[] | undefined
}

export default function PanelGraficoResultados({
  titulo,
  ambitosDisponibles,
  seleccionUnica,
  moneda,
  filas,
  detalle,
  instrumentos,
}: PanelGraficoResultadosProps) {
  const [ambitosSeleccionados, setAmbitosSeleccionados] = useState<string[]>(
    ambitosDisponibles.length > 0 ? [ambitosDisponibles[0]] : [],
  )
  const [metrica, setMetrica] = useState<MetricaResultado>('patrimonio')
  const [escenario, setEscenario] = useState<EscenarioNombre>('global')
  const [modoA, setModoA] = useState(false)

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

  function elegirAmbito(ambito: string) {
    if (seleccionUnica) {
      setAmbitosSeleccionados([ambito])
      return
    }
    setAmbitosSeleccionados((prev) => (prev.includes(ambito) ? prev.filter((a) => a !== ambito) : [...prev, ambito]))
  }

  const mostrarBanda = !modoA && ambitosSeleccionados.length === 1

  // "Comparar los 3 escenarios" (modoA) solo tiene sentido con un único ámbito (una serie por
  // escenario); si se agrega un segundo ámbito mientras estaba activo, se desactiva solo — sin
  // esto, quedaba "prendido" en segundo plano y podía reaparecer solo al volver a 1 seleccionado.
  useEffect(() => {
    if (modoA && ambitosSeleccionados.length !== 1) setModoA(false)
  }, [modoA, ambitosSeleccionados.length])

  // Marca en el gráfico el mes en que cada instrumento vencido dejó de crecer — a partir de ahí el
  // capital queda parado (Decisión 7); a nivel de un instrumento individual su "ganancia real" ya
  // no sigue después de eso (queda congelada), a nivel portfolio el efecto se sigue notando porque
  // el total no congela. Ver [[project_ganancias_reales_negativas_investigacion]].
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
      return [{
        key: ambito,
        label,
        color,
        media: stats.media,
        p25: mostrarBanda ? stats.p25 : undefined,
        p75: mostrarBanda ? stats.p75 : undefined,
        minimo: mostrarBanda ? stats.minimo : undefined,
        maximo: mostrarBanda ? stats.maximo : undefined,
      }]
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filas, ambitosSeleccionados, metrica, escenario, modoA, detalle])

  if (ambitosDisponibles.length === 0) return null

  return (
    <div className="card flex h-full flex-col gap-4">
      <p className="card-section-label">{titulo}</p>

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
        <div className="flex flex-wrap gap-1.5">
          {METRICAS.map((m) => (
            <button
              key={m.key}
              onClick={() => setMetrica(m.key)}
              className={
                metrica === m.key
                  ? 'rounded-full bg-navy-950 px-3 py-1 text-[11.5px] font-semibold text-white'
                  : 'rounded-full border border-line bg-white px-3 py-1 text-[11.5px] font-semibold text-ink-muted'
              }
            >
              {m.label}
            </button>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
          {ambitosSeleccionados.length === 1 && (
            <label className="flex items-center gap-1.5 text-[12px] whitespace-nowrap text-ink-muted">
              <input type="checkbox" checked={modoA} onChange={(e) => setModoA(e.target.checked)} />
              Comparar los 3 escenarios
            </label>
          )}
          {!modoA && (
            <div className="flex flex-wrap gap-1">
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
            </div>
          )}
        </div>
      </div>

      <div className="min-h-[200px] flex-1">
        <EscenarioChart
          series={series}
          mostrarBanda={mostrarBanda}
          formatY={(v) => formatMoneda(v, moneda)}
          vencimientos={vencimientos}
          height="100%"
        />
      </div>
    </div>
  )
}
