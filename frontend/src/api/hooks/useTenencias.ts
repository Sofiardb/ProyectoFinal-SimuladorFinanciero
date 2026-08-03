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

/**
 * Fábrica de los hooks add/update/delete de un tipo de tenencia del portfolio (acciones, bonos,
 * letras, plazos fijos). Los cuatro tipos comparten la misma forma de endpoint REST anidado
 * (`/portfolios/:id/{resource}[/:id]`) y de invalidación de cache; solo cambian los tipos.
 */
function createTenenciaCrudHooks<TEntity, TAddPayload, TUpdatePayload extends object>(resource: string) {
  function useAdd(idPortfolio: number) {
    const invalidate = useInvalidatePortfolio(idPortfolio)
    return useMutation({
      mutationFn: (payload: TAddPayload) => api.post<TEntity>(`/portfolios/${idPortfolio}/${resource}`, payload),
      onSuccess: invalidate,
    })
  }

  function useUpdate(idPortfolio: number) {
    const invalidate = useInvalidatePortfolio(idPortfolio)
    return useMutation({
      mutationFn: ({ id, ...payload }: { id: number } & TUpdatePayload) =>
        api.put<TEntity>(`/portfolios/${idPortfolio}/${resource}/${id}`, payload),
      onSuccess: invalidate,
    })
  }

  function useDelete(idPortfolio: number) {
    const invalidate = useInvalidatePortfolio(idPortfolio)
    return useMutation({
      mutationFn: (id: number) => api.delete<void>(`/portfolios/${idPortfolio}/${resource}/${id}`),
      onSuccess: invalidate,
    })
  }

  return { useAdd, useUpdate, useDelete }
}

export interface AccionPayload {
  idAccion:     number
  cantidad:     number
  precioCompra: number
}
type AccionUpdatePayload = { cantidad: number; precioCompra: number }

const accionCrud = createTenenciaCrudHooks<PortfolioAccion, AccionPayload, AccionUpdatePayload>('acciones')
export const useAddAccion = accionCrud.useAdd
export const useUpdateAccion = accionCrud.useUpdate
export const useDeleteAccion = accionCrud.useDelete

export interface BonoPayload {
  idBono:       number
  cantidad:     number
  precioCompra: number
}
type BonoUpdatePayload = { cantidad: number; precioCompra: number }

const bonoCrud = createTenenciaCrudHooks<PortfolioBono, BonoPayload, BonoUpdatePayload>('bonos')
export const useAddBono = bonoCrud.useAdd
export const useUpdateBono = bonoCrud.useUpdate
export const useDeleteBono = bonoCrud.useDelete

export interface LetraPayload {
  idLetra:      number
  cantidad:     number
  precioCompra: number
}
type LetraUpdatePayload = { cantidad: number; precioCompra: number }

const letraCrud = createTenenciaCrudHooks<PortfolioLetra, LetraPayload, LetraUpdatePayload>('letras')
export const useAddLetra = letraCrud.useAdd
export const useUpdateLetra = letraCrud.useUpdate
export const useDeleteLetra = letraCrud.useDelete

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

const plazoFijoCrud = createTenenciaCrudHooks<PortfolioPlazoFijo, PlazoFijoPayload, Partial<PlazoFijoPayload>>(
  'plazos-fijos',
)
export const useAddPlazoFijo = plazoFijoCrud.useAdd
export const useUpdatePlazoFijo = plazoFijoCrud.useUpdate
export const useDeletePlazoFijo = plazoFijoCrud.useDelete
