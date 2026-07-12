import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Checkbox } from '@/components/ui/checkbox'
import { Alert, AlertDescription } from '@/components/ui/alert'
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
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
          navigate('/portfolios')
        },
      },
    )
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-3">
        <FormField
          control={form.control}
          name="email"
          render={({ field }) => (
            <FormItem className="space-y-1.5">
              <FormLabel className="text-navy-950">Email</FormLabel>
              <FormControl>
                <Input className="h-11 rounded-[9px]" placeholder="vos@ejemplo.com" autoComplete="email" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="username"
          render={({ field }) => (
            <FormItem className="space-y-1.5">
              <FormLabel className="text-navy-950">Nombre de usuario</FormLabel>
              <FormControl>
                <Input className="h-11 rounded-[9px]" placeholder="Elegí un usuario" autoComplete="username" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="grid grid-cols-2 gap-3">
          <FormField
            control={form.control}
            name="nombre"
            render={({ field }) => (
              <FormItem className="space-y-1.5">
                <FormLabel className="text-navy-950">Nombre</FormLabel>
                <FormControl>
                  <Input className="h-11 rounded-[9px]" placeholder="Opcional" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="apellido"
            render={({ field }) => (
              <FormItem className="space-y-1.5">
                <FormLabel className="text-navy-950">Apellido</FormLabel>
                <FormControl>
                  <Input className="h-11 rounded-[9px]" placeholder="Opcional" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <FormField
            control={form.control}
            name="password"
            render={({ field }) => (
              <FormItem className="space-y-1.5">
                <FormLabel className="text-navy-950">Contraseña</FormLabel>
                <FormControl>
                  <Input
                    className="h-11 rounded-[9px]"
                    type="password"
                    placeholder="Mín. 8 caracteres"
                    autoComplete="new-password"
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="confirmPassword"
            render={({ field }) => (
              <FormItem className="space-y-1.5">
                <FormLabel className="text-navy-950">Confirmar</FormLabel>
                <FormControl>
                  <Input
                    className="h-11 rounded-[9px]"
                    type="password"
                    placeholder="Repetir"
                    autoComplete="new-password"
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
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
          className="h-[50px] w-full bg-navy-950 text-base text-white hover:bg-navy-900"
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
