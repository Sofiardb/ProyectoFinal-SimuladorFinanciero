import { useQueries, useQuery } from '@tanstack/react-query'
import { api } from '@/api/client'
import { usePortfolios } from '@/api/hooks/usePortfolios'
import type { InstrumentoSimulacion, PortfolioResumen, ResultadoSimulacionRow, SimulacionDetalle, SimulacionResumen } from '@/types'

export function useSimulacionesPortfolio(idPortfolio: number) {
  return useQuery({
    queryKey: ['simulaciones', 'portfolio', idPortfolio],
    queryFn: () => api.get<SimulacionResumen[]>(`/portfolios/${idPortfolio}/simulaciones`),
    enabled: Number.isFinite(idPortfolio),
  })
}

export function useSimulacionDetalle(idSimulacion: number) {
  return useQuery({
    queryKey: ['simulacion', idSimulacion],
    queryFn: () => api.get<SimulacionDetalle>(`/simulaciones/${idSimulacion}`),
    enabled: Number.isFinite(idSimulacion),
  })
}

export function useResultadosSimulacion(idSimulacion: number, ambito?: string) {
  return useQuery({
    queryKey: ['simulacion-resultados', idSimulacion, ambito ?? null],
    queryFn: () =>
      api.get<ResultadoSimulacionRow[]>(
        `/simulaciones/${idSimulacion}/resultados${ambito ? `?ambito=${encodeURIComponent(ambito)}` : ''}`,
      ),
    enabled: Number.isFinite(idSimulacion),
  })
}

export function useInstrumentosSimulacion(idSimulacion: number) {
  return useQuery({
    queryKey: ['simulacion-instrumentos', idSimulacion],
    queryFn: () => api.get<InstrumentoSimulacion[]>(`/simulaciones/${idSimulacion}/instrumentos`),
    enabled: Number.isFinite(idSimulacion),
  })
}

export interface SimulacionConPortfolio extends SimulacionResumen {
  nombrePortfolio:    string
  nombrePerfilRiesgo: string
  idPerfilRiesgo:     number
  /** Moneda base del portfolio — valorEsperado/valorMinimo/valorMaximo suman ARS+USD sin convertir
   * (ver SimulacionService.ExtraerAgregados), así que se muestra en la moneda base como aproximación. */
  codigoMonedaBase:   string
}

/**
 * Historial de simulaciones de todos los portfolios del usuario, aplanado en una sola lista.
 * No existe un endpoint agregado en el backend (solo GET /portfolios/{id}/simulaciones por portfolio),
 * así que se trae en paralelo uno por portfolio — mismo patrón N+1 ya aceptado para PortfolioCard.
 */
export function useTodasLasSimulaciones() {
  const { data: portfolios, isLoading: loadingPortfolios } = usePortfolios()

  const resultados = useQueries({
    queries: (portfolios ?? []).map((p: PortfolioResumen) => ({
      queryKey: ['simulaciones', 'portfolio', p.idPortfolio],
      queryFn: () => api.get<SimulacionResumen[]>(`/portfolios/${p.idPortfolio}/simulaciones`),
    })),
  })

  const isLoading = loadingPortfolios || resultados.some((r) => r.isLoading)

  const simulaciones: SimulacionConPortfolio[] = (portfolios ?? []).flatMap((p, i) => {
    const runs = resultados[i]?.data ?? []
    return runs.map((s) => ({
      ...s,
      nombrePortfolio: p.nombre,
      nombrePerfilRiesgo: p.nombrePerfilRiesgo,
      idPerfilRiesgo: p.idPerfilRiesgo,
      codigoMonedaBase: p.codigoMonedaBase,
    }))
  })

  simulaciones.sort((a, b) => new Date(b.fechaEjecucion).getTime() - new Date(a.fechaEjecucion).getTime())

  return { data: simulaciones, isLoading }
}
