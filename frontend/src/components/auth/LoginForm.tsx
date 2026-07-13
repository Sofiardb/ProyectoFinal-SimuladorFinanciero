import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { Link, useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Alert, AlertDescription } from '@/components/ui/alert'
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import { useLogin } from '@/api/hooks'
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

  const form = useForm<LoginValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { identificador: '', password: '' },
  })

  const onSubmit = (values: LoginValues) => {
    loginMutation.mutate(values, {
      onSuccess: (auth) => {
        login(auth)
        navigate('/bienvenida')
      },
    })
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-3">
        <FormField
          control={form.control}
          name="identificador"
          render={({ field }) => (
            <FormItem className="space-y-1.5">
              <FormLabel className="text-navy-950">Email o usuario</FormLabel>
              <FormControl>
                <Input
                  className="h-11 rounded-[9px]"
                  placeholder="vos@ejemplo.com"
                  autoComplete="username"
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
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
                <Input
                  className="h-11 rounded-[9px]"
                  type="password"
                  placeholder="••••••••"
                  autoComplete="current-password"
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        {loginMutation.isError && (
          <Alert variant="destructive">
            <AlertDescription>{loginMutation.error.message}</AlertDescription>
          </Alert>
        )}

        <Button
          type="submit"
          size="lg"
          className="h-[50px] w-full bg-navy-950 text-base text-white hover:bg-navy-900"
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
