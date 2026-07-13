import { useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/api/client'
import type {
  PortfolioAccion,
  PortfolioBono,
  PortfolioLetra,
  PortfolioPlazoFijo,
} from '@/types'

function useInvalidatePortfolio(idPortfolio: number) {
  const queryClient = useQueryClient()
  return () => {
    queryClient.invalidateQueries({ queryKey: ['portfolio', idPortfolio] })
    queryClient.invalidateQueries({ queryKey: ['portfolios'] })
    queryClient.invalidateQueries({ queryKey: ['portfolio-preview', idPortfolio] })
  }
}

// ─── Acciones ──────────────────────────────────────────────────────────────────
export interface AccionPayload {
  idAccion:     number
  cantidad:     number
  precioCompra: number
}

export function useAddAccion(idPortfolio: number) {
  const invalidate = useInvalidatePortfolio(idPortfolio)
  return useMutation({
    mutationFn: (payload: AccionPayload) =>
      api.post<PortfolioAccion>(`/portfolios/${idPortfolio}/acciones`, payload),
    onSuccess: invalidate,
  })
}

export function useUpdateAccion(idPortfolio: number) {
  const invalidate = useInvalidatePortfolio(idPortfolio)
  return useMutation({
    mutationFn: ({ idAccion, ...payload }: { idAccion: number; cantidad: number; precioCompra: number }) =>
      api.put<PortfolioAccion>(`/portfolios/${idPortfolio}/acciones/${idAccion}`, payload),
    onSuccess: invalidate,
  })
}

export function useDeleteAccion(idPortfolio: number) {
  const invalidate = useInvalidatePortfolio(idPortfolio)
  return useMutation({
    mutationFn: (idAccion: number) =>
      api.delete<void>(`/portfolios/${idPortfolio}/acciones/${idAccion}`),
    onSuccess: invalidate,
  })
}

// ─── Bonos ─────────────────────────────────────────────────────────────────────
export interface BonoPayload {
  idBono:       number
  cantidad:     number
  precioCompra: number
}

export function useAddBono(idPortfolio: number) {
  const invalidate = useInvalidatePortfolio(idPortfolio)
  return useMutation({
    mutationFn: (payload: BonoPayload) =>
      api.post<PortfolioBono>(`/portfolios/${idPortfolio}/bonos`, payload),
    onSuccess: invalidate,
  })
}

export function useUpdateBono(idPortfolio: number) {
  const invalidate = useInvalidatePortfolio(idPortfolio)
  return useMutation({
    mutationFn: ({ idBono, ...payload }: { idBono: number; cantidad: number; precioCompra: number }) =>
      api.put<PortfolioBono>(`/portfolios/${idPortfolio}/bonos/${idBono}`, payload),
    onSuccess: invalidate,
  })
}

export function useDeleteBono(idPortfolio: number) {
  const invalidate = useInvalidatePortfolio(idPortfolio)
  return useMutation({
    mutationFn: (idBono: number) =>
      api.delete<void>(`/portfolios/${idPortfolio}/bonos/${idBono}`),
    onSuccess: invalidate,
  })
}

// ─── Letras ────────────────────────────────────────────────────────────────────
export interface LetraPayload {
  idLetra:      number
  cantidad:     number
  precioCompra: number
}

export function useAddLetra(idPortfolio: number) {
  const invalidate = useInvalidatePortfolio(idPortfolio)
  return useMutation({
    mutationFn: (payload: LetraPayload) =>
      api.post<PortfolioLetra>(`/portfolios/${idPortfolio}/letras`, payload),
    onSuccess: invalidate,
  })
}

export function useUpdateLetra(idPortfolio: number) {
  const invalidate = useInvalidatePortfolio(idPortfolio)
  return useMutation({
    mutationFn: ({ idLetra, ...payload }: { idLetra: number; cantidad: number; precioCompra: number }) =>
      api.put<PortfolioLetra>(`/portfolios/${idPortfolio}/letras/${idLetra}`, payload),
    onSuccess: invalidate,
  })
}

export function useDeleteLetra(idPortfolio: number) {
  const invalidate = useInvalidatePortfolio(idPortfolio)
  return useMutation({
    mutationFn: (idLetra: number) =>
      api.delete<void>(`/portfolios/${idPortfolio}/letras/${idLetra}`),
    onSuccess: invalidate,
  })
}

// ─── Plazos fijos ────────────────────────────────────────────────────────────────
export interface PlazoFijoPayload {
  idTipoPlazoFijo:          number
  idMoneda:                 number
  entidadFinanciera:        string
  montoInvertido:           number
  tnaPactada:               number
  fechaInicio:              string
  duracionDias:             number
  reinvertirAlVencimiento:  boolean
}

export function useAddPlazoFijo(idPortfolio: number) {
  const invalidate = useInvalidatePortfolio(idPortfolio)
  return useMutation({
    mutationFn: (payload: PlazoFijoPayload) =>
      api.post<PortfolioPlazoFijo>(`/portfolios/${idPortfolio}/plazos-fijos`, payload),
    onSuccess: invalidate,
  })
}

export function useUpdatePlazoFijo(idPortfolio: number) {
  const invalidate = useInvalidatePortfolio(idPortfolio)
  return useMutation({
    mutationFn: ({ idPortfolioPlazoFijo, ...payload }: { idPortfolioPlazoFijo: number } & Partial<PlazoFijoPayload>) =>
      api.put<PortfolioPlazoFijo>(`/portfolios/${idPortfolio}/plazos-fijos/${idPortfolioPlazoFijo}`, payload),
    onSuccess: invalidate,
  })
}

export function useDeletePlazoFijo(idPortfolio: number) {
  const invalidate = useInvalidatePortfolio(idPortfolio)
  return useMutation({
    mutationFn: (idPortfolioPlazoFijo: number) =>
      api.delete<void>(`/portfolios/${idPortfolio}/plazos-fijos/${idPortfolioPlazoFijo}`),
    onSuccess: invalidate,
  })
}
