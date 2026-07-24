import { useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/api/client'
import type { SimularRequest, SimulacionResumen } from '@/types'

export function useRefrescarMercado(idPortfolio: number) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: () => api.post<void>(`/portfolios/${idPortfolio}/refrescar-mercado`, {}),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['portfolio-preview', idPortfolio] })
      queryClient.invalidateQueries({ queryKey: ['portfolio', idPortfolio] })
    },
  })
}

export function useLanzarSimulacion(idPortfolio: number) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (payload: SimularRequest) =>
      api.post<SimulacionResumen>(`/portfolios/${idPortfolio}/simular`, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['portfolio', idPortfolio] })
      // Historial (por portfolio y global) y la card de "Historial de simulaciones" del detalle
      // leen esta misma query key — sin esto, la corrida recién lanzada no aparecía hasta refrescar.
      queryClient.invalidateQueries({ queryKey: ['simulaciones', 'portfolio', idPortfolio] })
    },
  })
}
