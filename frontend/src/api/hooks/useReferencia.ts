import { useQuery } from '@tanstack/react-query'
import { api } from '@/api/client'
import type { EscenarioEconomico, Moneda, PerfilRiesgo, TipoCambio, TipoEscenario } from '@/types'

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

export function useTipoCambio() {
  return useQuery({
    queryKey: ['referencia', 'tipo-cambio'],
    queryFn: () => api.get<TipoCambio>('/referencia/tipo-cambio'),
    staleTime: 5 * 60 * 1000,
  })
}

export function useTiposEscenario() {
  return useQuery({
    queryKey: ['referencia', 'tipos-escenario'],
    queryFn: () => api.get<TipoEscenario[]>('/referencia/tipos-escenario'),
    staleTime: Infinity,
  })
}

export function useEscenariosEconomicos() {
  return useQuery({
    queryKey: ['referencia', 'escenarios-economicos'],
    queryFn: () => api.get<EscenarioEconomico[]>('/referencia/escenarios-economicos'),
    staleTime: Infinity,
  })
}
