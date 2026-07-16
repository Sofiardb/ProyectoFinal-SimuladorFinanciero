import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form'
import TextFormField from '@/components/forms/TextFormField'
import { useRegister } from '@/api/hooks'
import { useAuth } from '@/contexts/AuthContext'

const registerSchema = z
  .object({
    email: z.string().min(1, 'Ingresá tu email.').email('Email inválido.'),
    username: z.string().min(1, 'Ingresá un nombre de usuario.'),
    nombre: z.string().optional(),
    apellido: z.string().optional(),
    password: z.string().min(8, 'Debe tener al menos 8 caracteres.'),
    confirmPassword: z.string().min(1, 'Repetí tu contraseña.'),
    terms: z.boolean(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'Las contraseñas no coinciden.',
    path: ['confirmPassword'],
  })
  .refine((data) => data.terms, {
    message: 'Tenés que aceptar para continuar.',
    path: ['terms'],
  })

type RegisterValues = z.infer<typeof registerSchema>

const fieldClass = 'h-11 rounded-[9px]'
const itemClass = 'space-y-1.5'
const labelClass = 'text-navy-950'

export default function RegisterForm({ onSwitchToLogin }: { onSwitchToLogin: () => void }) {
  const { login } = useAuth()
  const navigate = useNavigate()
  const registerMutation = useRegister()

  const form = useForm<RegisterValues>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      email: '',
      username: '',
      nombre: '',
      apellido: '',
      password: '',
      confirmPassword: '',
      terms: false,
    },
  })

  const onSubmit = (values: RegisterValues) => {
    registerMutation.mutate(
      {
        email: values.email,
        username: values.username,
        password: values.password,
        nombre: values.nombre || undefined,
        apellido: values.apellido || undefined,
      },
      {
        onSuccess: (auth) => {
          login(auth)
          navigate('/bienvenida')
        },
      },
    )
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-3">
        <TextFormField
          control={form.control}
          name="email"
          label="Email"
          itemClassName={itemClass}
          labelClassName={labelClass}
          inputProps={{ className: fieldClass, placeholder: 'vos@ejemplo.com', autoComplete: 'email' }}
        />

        <TextFormField
          control={form.control}
          name="username"
          label="Nombre de usuario"
          itemClassName={itemClass}
          labelClassName={labelClass}
          inputProps={{ className: fieldClass, placeholder: 'Elegí un usuario', autoComplete: 'username' }}
        />

        <div className="grid grid-cols-2 gap-3">
          <TextFormField
            control={form.control}
            name="nombre"
            label="Nombre"
            itemClassName={itemClass}
            labelClassName={labelClass}
            inputProps={{ className: fieldClass, placeholder: 'Opcional' }}
          />
          <TextFormField
            control={form.control}
            name="apellido"
            label="Apellido"
            itemClassName={itemClass}
            labelClassName={labelClass}
            inputProps={{ className: fieldClass, placeholder: 'Opcional' }}
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <TextFormField
            control={form.control}
            name="password"
            label="Contraseña"
            itemClassName={itemClass}
            labelClassName={labelClass}
            inputProps={{
              className: fieldClass,
              type: 'password',
              placeholder: 'Mín. 8 caracteres',
              autoComplete: 'new-password',
            }}
          />
          <TextFormField
            control={form.control}
            name="confirmPassword"
            label="Confirmar"
            itemClassName={itemClass}
            labelClassName={labelClass}
            inputProps={{
              className: fieldClass,
              type: 'password',
              placeholder: 'Repetir',
              autoComplete: 'new-password',
            }}
          />
        </div>

        <FormField
          control={form.control}
          name="terms"
          render={({ field }) => (
            <FormItem className="space-y-1.5">
              <div className="flex items-start gap-2.5">
                <FormControl>
                  <Checkbox
                    checked={field.value}
                    onCheckedChange={field.onChange}
                    className="mt-0.5"
                  />
                </FormControl>
                <FormLabel className="text-xs font-normal leading-relaxed text-muted-foreground">
                  Acepto que InvestLab es una herramienta educativa de simulación y no
                  constituye asesoramiento financiero.
                </FormLabel>
              </div>
              <FormMessage />
            </FormItem>
          )}
        />

        {registerMutation.isError && (
          <Alert variant="destructive">
            <AlertDescription>{registerMutation.error.message}</AlertDescription>
          </Alert>
        )}

        <Button
          type="submit"
          size="lg"
          className="btn-auth-submit"
          disabled={registerMutation.isPending}
        >
          {registerMutation.isPending ? 'Creando cuenta…' : 'Crear cuenta'}
        </Button>

        <p className="text-center text-sm text-muted-foreground">
          ¿Ya tenés cuenta?{' '}
          <button
            type="button"
            onClick={onSwitchToLogin}
            className="font-semibold text-navy-950 hover:underline"
          >
            Iniciá sesión
          </button>
        </p>
      </form>
    </Form>
  )
}
