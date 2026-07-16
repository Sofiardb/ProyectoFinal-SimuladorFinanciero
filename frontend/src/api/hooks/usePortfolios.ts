import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '@/api/client'
import type { PortfolioDetalle, PortfolioResumen } from '@/types'

export function usePortfolios() {
  return useQuery({
    queryKey: ['portfolios'],
    queryFn: () => api.get<PortfolioResumen[]>('/portfolios'),
  })
}

export function usePortfolio(idPortfolio: number) {
  return useQuery({
    queryKey: ['portfolio', idPortfolio],
    queryFn: () => api.get<PortfolioDetalle>(`/portfolios/${idPortfolio}`),
    enabled: Number.isFinite(idPortfolio),
  })
}

export interface CrearPortfolioPayload {
  nombre:          string
  descripcion?:    string
  idPerfilRiesgo:  number
  idMonedaBase:    number
  capitalInicial?: number
}

export function useCreatePortfolio() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (payload: CrearPortfolioPayload) =>
      api.post<PortfolioResumen>('/portfolios', payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['portfolios'] })
    },
  })
}

export interface ActualizarPortfolioPayload {
  nombre?:          string
  descripcion?:     string
  idPerfilRiesgo?:  number
  idMonedaBase?:    number
  capitalInicial?:  number
  estado?:          'ACTIVO' | 'ARCHIVADO'
}

export function useUpdatePortfolio(idPortfolio: number) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (payload: ActualizarPortfolioPayload) =>
      api.put<PortfolioResumen>(`/portfolios/${idPortfolio}`, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['portfolios'] })
      queryClient.invalidateQueries({ queryKey: ['portfolio', idPortfolio] })
    },
  })
}

export function useDeletePortfolio() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (idPortfolio: number) => api.delete<void>(`/portfolios/${idPortfolio}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['portfolios'] })
    },
  })
}
