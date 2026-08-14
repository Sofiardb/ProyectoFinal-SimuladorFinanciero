import { toast } from 'sonner'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/api/client'
import { onErrorToast } from '@/lib/toast'
import type { EscenarioEconomico } from '@/types'

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
    onSuccess: (data) =>
      toast.success(
        data.byma.ok && data.docta.ok
          ? 'Ambas APIs externas responden correctamente.'
          : 'Verificación completa: alguna API externa no responde.',
      ),
    onError: onErrorToast,
  })
}

export function useRefreshLetras() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: () => api.post<MensajeResponse>('/admin/catalogo/refresh/letras', {}),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['catalogo', 'letras'] })
      toast.success(data.mensaje)
    },
    onError: onErrorToast,
  })
}

export function useRefreshBonosYields() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: () => api.post<MensajeResponse>('/admin/catalogo/refresh/bonos/yields', {}),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['catalogo', 'bonos'] })
      toast.success(data.mensaje)
    },
    onError: onErrorToast,
  })
}

export function useRefreshBonosFlujos() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: () => api.post<MensajeResponse>('/admin/catalogo/refresh/bonos/flujos', {}),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['catalogo', 'bonos'] })
      toast.success(data.mensaje)
    },
    onError: onErrorToast,
  })
}

export function useRefreshAcciones() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: () => api.post<RefreshAccionesResponse>('/admin/catalogo/refresh/acciones', {}),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['catalogo', 'acciones'] })
      toast.success(`Se recalcularon ${data.actualizadas} acciones.`)
    },
    onError: onErrorToast,
  })
}

export function useRefreshAccion() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (ticker: string) =>
      api.post<GbmRefreshResult>(`/admin/catalogo/refresh/acciones/${encodeURIComponent(ticker)}`, {}),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['catalogo', 'acciones'] })
      toast.success(`${data.ticker} actualizado.`)
    },
  })
}

export function useRefreshTipoCambio() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: () => api.post<RefreshTipoCambioResponse>('/admin/catalogo/refresh/tipo-cambio', {}),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['referencia', 'tipo-cambio'] })
      toast.success(data.mensaje)
    },
    onError: onErrorToast,
  })
}

export interface ActualizarEscenarioEconomicoItem {
  idTipoEscenario:        number
  inflacionMensualMin:    number
  inflacionMensualMax:    number
  inflacionMensualMinUsd: number
  inflacionMensualMaxUsd: number
}

export function useActualizarEscenariosEconomicos() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (escenarios: ActualizarEscenarioEconomicoItem[]) =>
      api.put<EscenarioEconomico[]>('/admin/escenarios-economicos', { escenarios }),
    onSuccess: (data) => {
      queryClient.setQueryData(['referencia', 'escenarios-economicos'], data)
      toast.success('Rangos de inflación actualizados.')
    },
    onError: onErrorToast,
  })
}
