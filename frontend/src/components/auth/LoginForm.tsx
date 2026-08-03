import { useState } from 'react'
import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { Link, useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { PasswordInput } from '@/components/ui/password-input'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form'
import TextFormField from '@/components/forms/TextFormField'
import MutationErrorAlert from '@/components/forms/MutationErrorAlert'
import { ApiError } from '@/api/client'
import { useLogin, useResendVerification } from '@/api/hooks'
import { useAuth } from '@/contexts/AuthContext'

const loginSchema = z.object({
  identificador: z.string().min(1, 'Ingresá tu email o usuario.'),
  password: z.string().min(1, 'Ingresá tu contraseña.'),
})

type LoginValues = z.infer<typeof loginSchema>

export default function LoginForm({ onSwitchToRegister }: { onSwitchToRegister: () => void }) {
  const { login } = useAuth()
  const navigate = useNavigate()
  const loginMutation = useLogin()
  const resendVerification = useResendVerification()
  const [reenviado, setReenviado] = useState(false)

  const form = useForm<LoginValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { identificador: '', password: '' },
  })

  const noVerificado =
    loginMutation.error instanceof ApiError && loginMutation.error.status === 403

  const onSubmit = (values: LoginValues) => {
    setReenviado(false)
    loginMutation.mutate(values, {
      onSuccess: (auth) => {
        login(auth)
        navigate('/bienvenida')
      },
    })
  }

  const onReenviar = () => {
    resendVerification.mutate(
      { identificador: form.getValues('identificador') },
      { onSuccess: () => setReenviado(true) },
    )
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-3">
        <TextFormField
          control={form.control}
          name="identificador"
          label="Email o usuario"
          itemClassName="space-y-1.5"
          labelClassName="text-navy-950"
          inputProps={{ className: 'h-11 rounded-[9px]', placeholder: 'vos@ejemplo.com', autoComplete: 'username' }}
        />

        <FormField
          control={form.control}
          name="password"
          render={({ field }) => (
            <FormItem className="space-y-1.5">
              <div className="flex items-baseline justify-between">
                <FormLabel className="text-navy-950">Contraseña</FormLabel>
                <Link to="/forgot-password" className="text-xs font-medium text-blue-brand hover:underline">
                  ¿Olvidaste tu contraseña?
                </Link>
              </div>
              <FormControl>
                <PasswordInput
                  className="h-11 rounded-[9px]"
                  placeholder="••••••••"
                  autoComplete="current-password"
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        {noVerificado ? (
          <Alert variant="destructive">
            <AlertDescription className="space-y-2">
              <p>{loginMutation.error?.message}</p>
              {reenviado ? (
                <p>Te reenviamos el enlace de verificación. Revisá tu bandeja de entrada.</p>
              ) : (
                <button
                  type="button"
                  onClick={onReenviar}
                  disabled={resendVerification.isPending}
                  className="font-semibold underline underline-offset-2"
                >
                  {resendVerification.isPending ? 'Reenviando…' : 'Reenviar email de verificación'}
                </button>
              )}
            </AlertDescription>
          </Alert>
        ) : (
          <MutationErrorAlert error={loginMutation.error} />
        )}

        <Button
          type="submit"
          size="lg"
          className="btn-auth-submit"
          disabled={loginMutation.isPending}
        >
          {loginMutation.isPending ? 'Ingresando…' : 'Iniciar sesión'}
        </Button>

        <p className="text-center text-sm text-muted-foreground">
          ¿No tenés cuenta?{' '}
          <button
            type="button"
            onClick={onSwitchToRegister}
            className="font-semibold text-navy-950 hover:underline"
          >
            Creá una
          </button>
        </p>
      </form>
    </Form>
  )
}
