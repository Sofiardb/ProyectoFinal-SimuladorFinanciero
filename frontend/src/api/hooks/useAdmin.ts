import { useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/api/client'

export interface EstadoConexion {
  ok:      boolean
  detalle: string
}

export interface CheckResponse {
  byma:  EstadoConexion
  docta: EstadoConexion
}

export interface MensajeResponse {
  mensaje: string
}

export interface GbmRefreshResult {
  ticker:                string
  muRetornoEsperado:      number
  sigmaVolatilidad:       number
  rhoCorrelacionIndice:   number
  precioActual:           number
  mesesDeDatos:           number
}

export interface RefreshAccionesResponse {
  actualizadas: number
  resultados:   GbmRefreshResult[]
}

export interface RefreshTipoCambioResponse {
  mensaje:          string
  cotizacionUsdArs: number
}

export function useAdminCheck() {
  return useMutation({
    mutationFn: () => api.get<CheckResponse>('/admin/catalogo/check'),
  })
}

export function useRefreshLetras() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: () => api.post<MensajeResponse>('/admin/catalogo/refresh/letras', {}),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['catalogo', 'letras'] })
    },
  })
}

export function useRefreshBonosYields() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: () => api.post<MensajeResponse>('/admin/catalogo/refresh/bonos/yields', {}),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['catalogo', 'bonos'] })
    },
  })
}

export function useRefreshBonosFlujos() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: () => api.post<MensajeResponse>('/admin/catalogo/refresh/bonos/flujos', {}),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['catalogo', 'bonos'] })
    },
  })
}

export function useRefreshAcciones() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: () => api.post<RefreshAccionesResponse>('/admin/catalogo/refresh/acciones', {}),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['catalogo', 'acciones'] })
    },
  })
}

export function useRefreshAccion() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (ticker: string) =>
      api.post<GbmRefreshResult>(`/admin/catalogo/refresh/acciones/${encodeURIComponent(ticker)}`, {}),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['catalogo', 'acciones'] })
    },
  })
}

export function useRefreshTipoCambio() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: () => api.post<RefreshTipoCambioResponse>('/admin/catalogo/refresh/tipo-cambio', {}),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['referencia', 'tipo-cambio'] })
    },
  })
}
