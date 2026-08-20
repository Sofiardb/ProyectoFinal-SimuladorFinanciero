import { useEffect, useMemo, useState } from 'react'
import { ESCENARIOS_COLOR } from '@/lib/escenarios'
import type { BreakevenMarcador, SerieEscenario, VencimientoMarcador } from '@/lib/escenarioChartData'
import { resolveAmbitoInfo } from '@/lib/tenenciaDisplay'
import type {
  EscenarioNombre,
  InstrumentoSimulacion,
  MetricaResultado,
  PortfolioDetalle,
  ResultadoSimulacionRow,
} from '@/types'

function metricaOpuesta(m: MetricaResultado): MetricaResultado {
  return m === 'ganancias_nominales' ? 'ganancias_reales' : 'ganancias_nominales'
}

function metricaCorta(m: MetricaResultado): string {
  return m === 'ganancias_nominales' ? 'Nominal' : 'Real'
}

const COLOR_NOMINAL = '#2a78d6'
const COLOR_REAL = '#c1740f'

const PALETA_INSTRUMENTOS = ['#2a78d6', '#008300', '#e87ba4', '#eda100', '#1baf7a', '#eb6834', '#4a3aa7', '#e34948']

interface Params {
  ambitosDisponibles: string[]
  seleccionUnica: boolean
  moneda: 'ARS' | 'USD'
  filas: ResultadoSimulacionRow[]
  detalle: PortfolioDetalle | undefined
  instrumentos: InstrumentoSimulacion[] | undefined
  montoInvertidoDe: (ambito: string) => number | undefined
}

/** View-model de un panel de gráfico de resultados: selección de ámbitos/métrica/escenario y las
 * series derivadas para el gráfico. Separado del componente de presentación para poder testearlo
 * sin recharts y para no mezclar cálculo con JSX. */
export function usePanelGraficoState({
  ambitosDisponibles,
  seleccionUnica,
  moneda,
  filas,
  detalle,
  instrumentos,
  montoInvertidoDe,
}: Params) {
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
    return resolveAmbitoInfo(ambito, instrumentos, detalle).label
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

  const esVistaPortfolio = ambitosSeleccionados.includes('portfolio_ars') || ambitosSeleccionados.includes('portfolio_usd')

  const vencimientos: VencimientoMarcador[] = useMemo(() => {
    if (!instrumentos || ambitosSeleccionados.length === 0) return []
    const relevantes = instrumentos.filter((inst) => {
      if (inst.tVencMeses == null) return false
      if (esVistaPortfolio) return true
      return ambitosSeleccionados.includes(inst.ambito)
    })
    const porMes = new Map<number, { labels: string[]; monto: number }>()
    for (const inst of relevantes) {
      const corto = resolveAmbitoInfo(inst.ambito, instrumentos, detalle).corto
      const montoInst = filaFor(inst.ambito, 'global', 'patrimonio')?.media[inst.tVencMeses!]
      const acumulado = porMes.get(inst.tVencMeses!) ?? { labels: [], monto: 0 }
      acumulado.labels.push(corto)
      if (montoInst != null) acumulado.monto += montoInst
      porMes.set(inst.tVencMeses!, acumulado)
    }
    return Array.from(porMes.entries()).map(([mes, { labels, monto }]) => ({
      mes,
      label: labels.join(', '),
      monto: monto > 0 ? monto : undefined,
    }))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [instrumentos, ambitosSeleccionados, detalle, filas])

  const series: SerieEscenario[] = useMemo(() => {
    if (ambitosSeleccionados.length === 0) return []

    if (modoA && ambitosSeleccionados.length === 1) {
      const ambito = ambitosSeleccionados[0]
      const montoInvertido = metrica !== 'patrimonio' ? montoInvertidoDe(ambito) : undefined
      return ESCENARIOS_COLOR.flatMap(({ key, label, color }) => {
        const stats = filaFor(ambito, key, metrica)
        return stats ? [{ key, label, color, media: stats.media, montoInvertido }] : []
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
        montoInvertido: metrica !== 'patrimonio' ? montoInvertidoDe(ambito) : undefined,
        p25: mostrarBanda ? stats.p25 : undefined,
        p75: mostrarBanda ? stats.p75 : undefined,
        minimo: mostrarBanda ? stats.minimo : undefined,
        maximo: mostrarBanda ? stats.maximo : undefined,
      }]
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filas, ambitosSeleccionados, metrica, escenario, modoA, detalle, compararNominalReal, puedeCompararNominalReal])

  return {
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
  }
}
