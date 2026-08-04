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
import { useForgotPassword } from '@/api/hooks'

const schema = z.object({
  email: z.string().min(1, 'Ingresá tu email.').email('Email inválido.'),
})

type Values = z.infer<typeof schema>

export default function ForgotPasswordPage() {
  const [sent, setSent] = useState(false)
  const forgotPassword = useForgotPassword()

  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: { email: '' },
  })

  const onSubmit = (values: Values) => {
    forgotPassword.mutate(values, { onSuccess: () => setSent(true) })
  }

  return (
    <AuthSplitLayout
      headline="¿Olvidaste tu contraseña?"
      body="No pasa nada. Ingresá tu email y te mandamos un enlace para elegir una nueva."
    >
      <h2 className="mb-1.5 font-display text-xl font-semibold text-navy-950 sm:text-2xl">
        Recuperar contraseña
      </h2>

      {sent ? (
        <>
          <Alert className="mb-6 border-green-brand bg-[#eaf7f0] text-[#1c6b45]">
            <AlertDescription className="space-y-1.5 text-[#1c6b45]">
              <p>
                Si el email existe en InvestLab, vas a recibir un enlace para restablecer tu
                contraseña en los próximos minutos.
              </p>
              <p className="font-semibold">
                <span className="text-base">⚠</span> Si no lo ves, revisá tu carpeta de spam o
                correo no deseado.
              </p>
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
                name="email"
                label="Email"
                itemClassName="space-y-1.5"
                labelClassName="text-navy-950"
                inputProps={{ className: 'h-11 rounded-[9px]', placeholder: 'vos@ejemplo.com', autoComplete: 'email' }}
              />

              <MutationErrorAlert error={forgotPassword.error} />

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
