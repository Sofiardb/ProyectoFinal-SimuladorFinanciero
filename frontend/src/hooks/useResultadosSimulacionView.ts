import { useMemo } from 'react'
import type { SerieInflacionPorEscenario } from '@/components/charts/InflacionChart'
import { useInstrumentosSimulacion, usePortfolio, useResultadosSimulacion, useSimulacionDetalle } from '@/api/hooks'
import { resolveAmbitoInfo } from '@/lib/tenenciaDisplay'
import type { EscenarioNombre, MetricaResultado, StatsVector } from '@/types'

function ultimo(v: number[] | undefined): number | undefined {
  return v && v.length > 0 ? v[v.length - 1] : undefined
}

export interface KpiPortfolioMoneda {
  ambito:            'portfolio_ars' | 'portfolio_usd'
  moneda:             'ARS' | 'USD'
  montoInvertido:     number | undefined
  valorFinalMediana:  number | undefined
  patrimonio:         StatsVector | undefined
  gananciasReales:    StatsVector | undefined
}

/**
 * Toda la data + derivaciones que necesita una vista de resultados de una simulación (KPIs,
 * ámbitos disponibles por moneda, series de inflación).
 */
export function useResultadosSimulacionView(idSimulacion: number) {
  const { data: sim, isLoading: loadingSim } = useSimulacionDetalle(idSimulacion)
  const { data: filas, isLoading: loadingFilas } = useResultadosSimulacion(idSimulacion)
  const { data: detalle } = usePortfolio(sim?.idPortfolio ?? NaN)
  const { data: instrumentos } = useInstrumentosSimulacion(idSimulacion)

  function monedaDe(ambito: string): 'ARS' | 'USD' {
    if (ambito === 'portfolio_ars') return 'ARS'
    if (ambito === 'portfolio_usd') return 'USD'
    return resolveAmbitoInfo(ambito, instrumentos, detalle).moneda
  }

  function labelDe(ambito: string): string {
    if (ambito === 'portfolio_ars') return 'Portfolio (ARS)'
    if (ambito === 'portfolio_usd') return 'Portfolio (USD)'
    return resolveAmbitoInfo(ambito, instrumentos, detalle).label
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
    if (!filas || !sim) return []
    return (['portfolio_ars', 'portfolio_usd'] as const).filter((a) => {
      if (!filas.some((f) => f.ambito === a)) return false
      const montoInicial = a === 'portfolio_ars' ? sim.valorInicialArs : sim.valorInicialUsd
      return montoInicial == null || montoInicial > 0
    })
  }, [filas, sim])

  const ambitosArs = useMemo(() => {
    if (!filas) return []
    return Array.from(new Set(filas.filter((f) => f.ambito !== 'global' && !f.ambito.startsWith('portfolio_')).map((f) => f.ambito)))
      .filter((a) => monedaDe(a) === 'ARS')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filas, detalle, instrumentos])

  const ambitosUsd = useMemo(() => {
    if (!filas) return []
    return Array.from(new Set(filas.filter((f) => f.ambito !== 'global' && !f.ambito.startsWith('portfolio_')).map((f) => f.ambito)))
      .filter((a) => monedaDe(a) === 'USD')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filas, detalle, instrumentos])

  const kpisPortfolio: KpiPortfolioMoneda[] = ambitosPortfolio.map((ambito) => {
    const patrimonio = filaFor(ambito, 'global', 'patrimonio')
    return {
      ambito,
      moneda: monedaDe(ambito),
      montoInvertido: ambito === 'portfolio_ars' ? sim?.valorInicialArs : sim?.valorInicialUsd,
      valorFinalMediana: ultimo(patrimonio?.mediana),
      patrimonio,
      gananciasReales: filaFor(ambito, 'global', 'ganancias_reales'),
    }
  })
  const inflacionArsKpi = filaFor('global', 'global', 'inflacion_acumulada')
  const inflacionUsdKpi = filaFor('global', 'global', 'inflacion_acumulada_usd')

  const inflacionAcumuladaArs = ultimo(inflacionArsKpi?.mediana)
  const inflacionAcumuladaUsd = ultimo(inflacionUsdKpi?.mediana)

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
    kpisPortfolio,
    inflacionAcumuladaArs,
    inflacionAcumuladaUsd,
    mensualArs,
    mensualUsd,
    acumuladaArs,
    acumuladaUsd,
  }
}

export type ResultadosSimulacionView = ReturnType<typeof useResultadosSimulacionView>
