import { z } from 'zod'
import type { CampoPreview } from '@/lib/tenenciaDisplay'
import type { FlujoCaja } from '@/types'

export const cantidadSchema = z
  .string()
  .refine((v) => v.trim() !== '' && Number.isInteger(Number(v)) && Number(v) > 0, 'Ingresá una cantidad válida.')

export const addSchema = z.object({
  idCatalogo: z.string().min(1, 'Elegí una opción válida.'),
  cantidad: cantidadSchema,
})
export type AddValues = z.infer<typeof addSchema>

export const editSchema = z.object({ cantidad: cantidadSchema })
export type EditValues = z.infer<typeof editSchema>

export interface CatalogoOpcion {
  id:            number
  etiqueta:      string
  previewFields: CampoPreview[]
  precioActual:  number
  flujos?:       FlujoCaja[]
  esCer?:        boolean
}

export interface TenenciaItem {
  idCatalogo:      number
  titulo:          string
  subtitulo:       string
  previewFields:   CampoPreview[]
  cantidadActual:  number
  precioActual?:   number
  flujos?:         FlujoCaja[]
  esCer?:          boolean
}
