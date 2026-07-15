import { useMutation } from '@tanstack/react-query'
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
  return useMutation({
    mutationFn: () => api.post<MensajeResponse>('/admin/catalogo/refresh/letras', {}),
  })
}

export function useRefreshBonosYields() {
  return useMutation({
    mutationFn: () => api.post<MensajeResponse>('/admin/catalogo/refresh/bonos/yields', {}),
  })
}

export function useRefreshBonosFlujos() {
  return useMutation({
    mutationFn: () => api.post<MensajeResponse>('/admin/catalogo/refresh/bonos/flujos', {}),
  })
}

export function useRefreshAcciones() {
  return useMutation({
    mutationFn: () => api.post<RefreshAccionesResponse>('/admin/catalogo/refresh/acciones', {}),
  })
}

export function useRefreshAccion() {
  return useMutation({
    mutationFn: (ticker: string) =>
      api.post<GbmRefreshResult>(`/admin/catalogo/refresh/acciones/${encodeURIComponent(ticker)}`, {}),
  })
}

export function useRefreshTipoCambio() {
  return useMutation({
    mutationFn: () => api.post<RefreshTipoCambioResponse>('/admin/catalogo/refresh/tipo-cambio', {}),
  })
}
