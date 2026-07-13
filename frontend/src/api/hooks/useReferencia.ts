import { useQuery } from '@tanstack/react-query'
import { api } from '@/api/client'
import type { Moneda, PerfilRiesgo } from '@/types'

export function useMonedas() {
  return useQuery({
    queryKey: ['referencia', 'monedas'],
    queryFn: () => api.get<Moneda[]>('/referencia/monedas'),
    staleTime: Infinity,
  })
}

export function usePerfilesRiesgo() {
  return useQuery({
    queryKey: ['referencia', 'perfiles-riesgo'],
    queryFn: () => api.get<PerfilRiesgo[]>('/referencia/perfiles-riesgo'),
    staleTime: Infinity,
  })
}
