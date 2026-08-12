import { z } from 'zod'

export const plazoFijoSchema = z.object({
  idTipoPlazoFijo: z.string().min(1, 'Elegí un tipo válido.'),
  entidadFinanciera: z.string().min(1, 'Ingresá un alias válido.'),
  montoInvertido: z
    .string()
    .refine((v) => v.trim() !== '' && !Number.isNaN(Number(v)) && Number(v) > 0, 'Ingresá un monto válido.'),
  tnaPactada: z
    .string()
    .refine(
      (v) => v.trim() !== '' && !Number.isNaN(Number(v)) && Number(v) > 0 && Number(v) <= 100,
      'Ingresá una tasa válida (mayor a 0 y hasta 100%).',
    ),
  fechaInicio: z.string().min(1, 'Elegí una fecha válida.'),
  duracionDias: z
    .string()
    .refine((v) => v.trim() !== '' && Number.isInteger(Number(v)) && Number(v) >= 1, 'Ingresá un plazo válido.'),
  reinvertirAlVencimiento: z.boolean(),
})
export type PlazoFijoValues = z.infer<typeof plazoFijoSchema>

export interface NuevoPlazoFijo {
  idTipoPlazoFijo:          number
  entidadFinanciera:        string
  montoInvertido:           number
  tnaPactada:               number
  fechaInicio:              string
  duracionDias:             number
  reinvertirAlVencimiento:  boolean
}

export interface EditarPlazoFijo {
  entidadFinanciera:        string
  montoInvertido:           number
  tnaPactada:               number
  fechaInicio:              string
  duracionDias:             number
  reinvertirAlVencimiento:  boolean
}
