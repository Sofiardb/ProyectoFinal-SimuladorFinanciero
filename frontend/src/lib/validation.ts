import { z } from 'zod'

export const passwordFieldSchema = z.string().min(8, 'Debe tener al menos 8 caracteres.')
export const confirmPasswordFieldSchema = z.string().min(1, 'Repetí tu contraseña.')

export function refinePasswordsMatch<S extends z.ZodType<{ password: string; confirmPassword: string }>>(
  schema: S,
) {
  return schema.refine((data) => data.password === data.confirmPassword, {
    message: 'Las contraseñas no coinciden.',
    path: ['confirmPassword'],
  })
}
