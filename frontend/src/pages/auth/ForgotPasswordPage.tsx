import { useState } from 'react'
import { Link } from 'react-router-dom'
import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Form } from '@/components/ui/form'
import TextFormField from '@/components/forms/TextFormField'
import MutationErrorAlert from '@/components/forms/MutationErrorAlert'
import AuthSplitLayout from '@/components/auth/AuthSplitLayout'
import { ApiError } from '@/api/client'
import { useForgotPassword } from '@/api/hooks'

const schema = z.object({
  identificador: z.string().min(1, 'Ingresá tu email o usuario.'),
})

type Values = z.infer<typeof schema>

export default function ForgotPasswordPage() {
  const [maskedEmail, setMaskedEmail] = useState<string | null>(null)
  const [reenviado, setReenviado] = useState(false)
  const forgotPassword = useForgotPassword()

  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: { identificador: '' },
  })

  const onSubmit = (values: Values) => {
    setReenviado(false)
    forgotPassword.mutate(values, {
      onSuccess: (data) => setMaskedEmail(data.maskedEmail),
      onError: (error) => {
        if (error instanceof ApiError && error.status === 404) {
          form.setError('identificador', { message: error.message })
        }
      },
    })
  }

  const onReenviar = () => {
    forgotPassword.mutate(form.getValues(), { onSuccess: () => setReenviado(true) })
  }

  const errorEsNoEncontrado =
    forgotPassword.error instanceof ApiError && forgotPassword.error.status === 404

  return (
    <AuthSplitLayout
      headline="¿Olvidaste tu contraseña?"
      body="No pasa nada. Ingresá tu email o usuario y te mandamos un enlace para elegir una nueva."
    >
      <h2 className="mb-1.5 font-display text-xl font-semibold text-navy-950 sm:text-2xl">
        Recuperar contraseña
      </h2>

      {maskedEmail ? (
        <>
          <Alert className="mb-6 border-green-brand bg-[#eaf7f0] text-[#1c6b45]">
            <AlertDescription className="space-y-2 text-[#1c6b45]">
              <p>
                Te enviamos un enlace para restablecer tu contraseña a{' '}
                <span className="font-semibold">{maskedEmail}</span>.
              </p>
              <p className="font-semibold">
                <span className="text-base">⚠</span> Si no lo ves, revisá tu carpeta de spam o
                correo no deseado.
              </p>
              {reenviado ? (
                <p>Te lo volvimos a enviar.</p>
              ) : (
                <button
                  type="button"
                  onClick={onReenviar}
                  disabled={forgotPassword.isPending}
                  className="font-semibold underline underline-offset-2"
                >
                  {forgotPassword.isPending ? 'Reenviando…' : 'Reenviar enlace'}
                </button>
              )}
            </AlertDescription>
          </Alert>
          <Link
            to="/login"
            className="block text-center text-sm font-semibold text-navy-950 hover:underline"
          >
            Volver a iniciar sesión
          </Link>
        </>
      ) : (
        <>
          <p className="mb-6 text-sm text-muted-foreground">
            Te mandamos un enlace de un solo uso, válido por 30 minutos.
          </p>

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

              <MutationErrorAlert error={errorEsNoEncontrado ? null : forgotPassword.error} />

              <Button
                type="submit"
                size="lg"
                className="btn-auth-submit"
                disabled={forgotPassword.isPending}
              >
                {forgotPassword.isPending ? 'Enviando…' : 'Enviar enlace'}
              </Button>

              <Link
                to="/login"
                className="block text-center text-sm font-semibold text-navy-950 hover:underline"
              >
                Volver a iniciar sesión
              </Link>
            </form>
          </Form>
        </>
      )}
    </AuthSplitLayout>
  )
}
