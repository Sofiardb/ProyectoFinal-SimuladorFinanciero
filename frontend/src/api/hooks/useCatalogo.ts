import { useQuery } from '@tanstack/react-query'
import { api } from '@/api/client'
import type { AccionCatalogo, BonoCatalogo, LetraCatalogo, TipoPlazoFijo } from '@/types'

export function useAccionesCatalogo() {
  return useQuery({
    queryKey: ['catalogo', 'acciones'],
    queryFn: () => api.get<AccionCatalogo[]>('/instrumentos/acciones'),
  })
}

export function useBonosCatalogo() {
  return useQuery({
    queryKey: ['catalogo', 'bonos'],
    queryFn: () => api.get<BonoCatalogo[]>('/instrumentos/bonos'),
  })
}

export function useLetrasCatalogo() {
  return useQuery({
    queryKey: ['catalogo', 'letras'],
    queryFn: () => api.get<LetraCatalogo[]>('/instrumentos/letras'),
  })
}

export function useTiposPlazoFijo() {
  return useQuery({
    queryKey: ['catalogo', 'tipos-plazo-fijo'],
    queryFn: () => api.get<TipoPlazoFijo[]>('/instrumentos/tipos-plazo-fijo'),
    staleTime: Infinity,
  })
}
