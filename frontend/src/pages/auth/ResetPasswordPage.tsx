import { useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Form } from '@/components/ui/form'
import TextFormField from '@/components/forms/TextFormField'
import AuthSplitLayout from '@/components/auth/AuthSplitLayout'
import { useResetPassword } from '@/api/hooks'

const schema = z
  .object({
    password: z.string().min(8, 'Debe tener al menos 8 caracteres.'),
    confirmPassword: z.string().min(1, 'Repetí tu contraseña.'),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'Las contraseñas no coinciden.',
    path: ['confirmPassword'],
  })

type Values = z.infer<typeof schema>

export default function ResetPasswordPage() {
  const [searchParams] = useSearchParams()
  const token = searchParams.get('token') ?? ''
  const navigate = useNavigate()
  const [done, setDone] = useState(false)
  const resetPassword = useResetPassword()

  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: { password: '', confirmPassword: '' },
  })

  const onSubmit = (values: Values) => {
    resetPassword.mutate(
      { token, newPassword: values.password },
      { onSuccess: () => setDone(true) },
    )
  }

  return (
    <AuthSplitLayout
      headline="Elegí una nueva contraseña"
      body="Ya casi terminás. Definí una nueva contraseña para volver a entrar a InvestLab."
    >
      <h2 className="mb-6 font-display text-xl font-semibold text-navy-950 sm:text-2xl">
        Restablecer contraseña
      </h2>

      {!token ? (
        <Alert variant="destructive">
          <AlertDescription>
            Este enlace no es válido. Solicitá uno nuevo desde{' '}
            <Link to="/forgot-password" className="font-semibold underline">
              recuperar contraseña
            </Link>
            .
          </AlertDescription>
        </Alert>
      ) : done ? (
        <>
          <Alert className="mb-6 border-green-brand bg-[#eaf7f0] text-[#1c6b45]">
            <AlertDescription className="text-[#1c6b45]">
              Tu contraseña se actualizó correctamente.
            </AlertDescription>
          </Alert>
          <Button
            size="lg"
            className="btn-auth-submit"
            onClick={() => navigate('/login')}
          >
            Iniciar sesión
          </Button>
        </>
      ) : (
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-3">
            <TextFormField
              control={form.control}
              name="password"
              label="Nueva contraseña"
              itemClassName="space-y-1.5"
              labelClassName="text-navy-950"
              inputProps={{
                className: 'h-11 rounded-[9px]',
                type: 'password',
                placeholder: 'Mínimo 8 caracteres',
                autoComplete: 'new-password',
              }}
            />

            <TextFormField
              control={form.control}
              name="confirmPassword"
              label="Confirmar contraseña"
              itemClassName="space-y-1.5"
              labelClassName="text-navy-950"
              inputProps={{
                className: 'h-11 rounded-[9px]',
                type: 'password',
                placeholder: 'Repetí tu contraseña',
                autoComplete: 'new-password',
              }}
            />

            {resetPassword.isError && (
              <Alert variant="destructive">
                <AlertDescription>{resetPassword.error.message}</AlertDescription>
              </Alert>
            )}

            <Button
              type="submit"
              size="lg"
              className="btn-auth-submit"
              disabled={resetPassword.isPending}
            >
              {resetPassword.isPending ? 'Actualizando…' : 'Actualizar contraseña'}
            </Button>
          </form>
        </Form>
      )}
    </AuthSplitLayout>
  )
}
