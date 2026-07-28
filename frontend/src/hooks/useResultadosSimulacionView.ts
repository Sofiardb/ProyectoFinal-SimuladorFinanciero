import { useMemo } from 'react'
import type { SerieInflacionPorEscenario } from '@/components/charts/InflacionChart'
import { useInstrumentosSimulacion, usePortfolio, useResultadosSimulacion, useSimulacionDetalle } from '@/api/hooks'
import { resolveAmbitoInfo } from '@/lib/tenenciaDisplay'
import type { EscenarioNombre, MetricaResultado, StatsVector } from '@/types'

function ultimo(v: number[] | undefined): number | undefined {
  return v && v.length > 0 ? v[v.length - 1] : undefined
}

/**
 * Toda la data + derivaciones que necesita una vista de resultados de una simulación (KPIs,
 * ámbitos disponibles por moneda, series de inflación) — extraído de ResultadosPage para poder
 * reusarlo dos veces en CompararPage (una por simulación elegida) sin duplicar la lógica.
 */
export function useResultadosSimulacionView(idSimulacion: number) {
  const { data: sim, isLoading: loadingSim } = useSimulacionDetalle(idSimulacion)
  const { data: filas, isLoading: loadingFilas } = useResultadosSimulacion(idSimulacion)
  const { data: detalle } = usePortfolio(sim?.idPortfolio ?? NaN)
  const { data: instrumentos } = useInstrumentosSimulacion(idSimulacion)

  function monedaDe(ambito: string): 'ARS' | 'USD' {
    if (ambito === 'portfolio_ars') return 'ARS'
    if (ambito === 'portfolio_usd') return 'USD'
    return detalle ? resolveAmbitoInfo(ambito, detalle).moneda : 'ARS'
  }

  function labelDe(ambito: string): string {
    if (ambito === 'portfolio_ars') return 'Portfolio (ARS)'
    if (ambito === 'portfolio_usd') return 'Portfolio (USD)'
    return detalle ? resolveAmbitoInfo(ambito, detalle).label : ambito
  }

  /** Monto invertido para cualquier ámbito (no solo el "KPI" fijo de más abajo) — usado por la
   * línea de equilibrio del gráfico, que tiene que funcionar sea cual sea el ámbito elegido. */
  function montoInvertidoDe(ambito: string): number | undefined {
    if (ambito === 'portfolio_ars') return sim?.valorInicialArs ?? sim?.valorInicial
    if (ambito === 'portfolio_usd') return sim?.valorInicialUsd
    return instrumentos?.find((i) => i.ambito === ambito)?.monto
  }

  function filaFor(ambito: string, esc: EscenarioNombre, met: MetricaResultado): StatsVector | undefined {
    return filas?.find((f) => f.ambito === ambito && f.escenario === esc && f.metrica === met)?.stats
  }

  const ambitosPortfolio = useMemo(() => {
    if (!filas) return []
    return (['portfolio_ars', 'portfolio_usd'] as const).filter((a) => filas.some((f) => f.ambito === a))
  }, [filas])

  const ambitosArs = useMemo(() => {
    if (!filas) return []
    return Array.from(new Set(filas.filter((f) => f.ambito !== 'global' && !f.ambito.startsWith('portfolio_')).map((f) => f.ambito)))
      .filter((a) => monedaDe(a) === 'ARS')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filas, detalle])

  const ambitosUsd = useMemo(() => {
    if (!filas) return []
    return Array.from(new Set(filas.filter((f) => f.ambito !== 'global' && !f.ambito.startsWith('portfolio_')).map((f) => f.ambito)))
      .filter((a) => monedaDe(a) === 'USD')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filas, detalle])

  // KPIs de cabecera: snapshot fijo (portfolio en ARS si existe, si no USD; escenario global).
  const ambitoKpi = ambitosPortfolio.includes('portfolio_ars') ? 'portfolio_ars' : ambitosPortfolio[0]
  const monedaKpi = ambitoKpi ? monedaDe(ambitoKpi) : 'ARS'
  const patrimonioKpi = ambitoKpi ? filaFor(ambitoKpi, 'global', 'patrimonio') : undefined
  const inflacionArsKpi = filaFor('global', 'global', 'inflacion_acumulada')
  const inflacionUsdKpi = filaFor('global', 'global', 'inflacion_acumulada_usd')
  const gananciasRealesKpi = ambitoKpi ? filaFor(ambitoKpi, 'global', 'ganancias_reales') : undefined

  const valorFinalMediana = ultimo(patrimonioKpi?.mediana)
  const inflacionAcumuladaArs = ultimo(inflacionArsKpi?.mediana)
  const inflacionAcumuladaUsd = ultimo(inflacionUsdKpi?.mediana)
  const montoInvertido = sim
    ? (monedaKpi === 'ARS' ? sim.valorInicialArs : sim.valorInicialUsd) ?? sim.valorInicial
    : undefined

  function serieInflacion(metrica: MetricaResultado, transform: (v: number) => number): SerieInflacionPorEscenario {
    const leer = (esc: EscenarioNombre) => {
      const stats = filaFor('global', esc, metrica)
      return stats ? stats.mediana.map(transform) : []
    }
    return { favorable: leer('favorable'), moderado: leer('moderado'), desfavorable: leer('desfavorable') }
  }

  const mensualArs = serieInflacion('inflacion_mensual', (v) => v * 100)
  const mensualUsd = serieInflacion('inflacion_mensual_usd', (v) => v * 100)
  const acumuladaArs = serieInflacion('inflacion_acumulada', (v) => (v - 1) * 100)
  const acumuladaUsd = serieInflacion('inflacion_acumulada_usd', (v) => (v - 1) * 100)

  return {
    isLoading: loadingSim || loadingFilas,
    sim,
    filas,
    detalle,
    instrumentos,
    monedaDe,
    labelDe,
    montoInvertidoDe,
    ambitosPortfolio,
    ambitosArs,
    ambitosUsd,
    ambitoKpi,
    monedaKpi,
    valorFinalMediana,
    montoInvertido,
    inflacionAcumuladaArs,
    inflacionAcumuladaUsd,
    mensualArs,
    mensualUsd,
    acumuladaArs,
    acumuladaUsd,
    patrimonioKpi,
    gananciasRealesKpi,
  }
}

export type ResultadosSimulacionView = ReturnType<typeof useResultadosSimulacionView>
