import { useQuery } from '@tanstack/react-query'
import { api } from '@/api/client'
import type { SimulacionPreview } from '@/types'

export function usePortfolioPreview(idPortfolio: number) {
  return useQuery({
    queryKey: ['portfolio-preview', idPortfolio],
    queryFn: () => api.get<SimulacionPreview>(`/portfolios/${idPortfolio}/simular/preview`),
    enabled: Number.isFinite(idPortfolio),
  })
}
