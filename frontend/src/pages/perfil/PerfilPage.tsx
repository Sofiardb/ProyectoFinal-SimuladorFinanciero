import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import { useUpdatePerfil } from '@/api/hooks'
import { useAuth } from '@/contexts/AuthContext'

const schema = z.object({
  email: z.string().min(1, 'Ingresá tu email.').email('Email inválido.'),
  username: z.string().min(1, 'Ingresá un nombre de usuario.'),
  nombre: z.string().optional(),
  apellido: z.string().optional(),
})

type Values = z.infer<typeof schema>

export default function PerfilPage() {
  const { usuario, updateUsuario } = useAuth()
  const updatePerfil = useUpdatePerfil()

  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: {
      email: usuario?.email ?? '',
      username: usuario?.username ?? '',
      nombre: usuario?.nombre ?? '',
      apellido: usuario?.apellido ?? '',
    },
  })

  const onSubmit = (values: Values) => {
    updatePerfil.mutate(
      {
        email: values.email,
        username: values.username,
        nombre: values.nombre || undefined,
        apellido: values.apellido || undefined,
      },
      {
        onSuccess: (perfil) => {
          updateUsuario(perfil)
          toast.success('Perfil actualizado correctamente.')
        },
      },
    )
  }

  return (
    <div className="mx-auto max-w-xl px-6 py-10">
      <h1 className="mb-1 font-display text-2xl font-semibold text-navy-950">Mi perfil</h1>
      <p className="mb-6 text-sm text-muted-foreground">
        Actualizá tus datos personales. Para cambiar tu contraseña usá la opción "¿Olvidaste
        tu contraseña?" desde la pantalla de inicio de sesión.
      </p>

      <Card>
        <CardHeader>
          <CardTitle>Datos personales</CardTitle>
          <CardDescription>Estos datos son visibles solo para vos.</CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email</FormLabel>
                    <FormControl>
                      <Input className="h-11 rounded-[9px]" autoComplete="email" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="username"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nombre de usuario</FormLabel>
                    <FormControl>
                      <Input className="h-11 rounded-[9px]" autoComplete="username" {...field} />
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
                    <FormItem>
                      <FormLabel>Nombre</FormLabel>
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
                    <FormItem>
                      <FormLabel>Apellido</FormLabel>
                      <FormControl>
                        <Input className="h-11 rounded-[9px]" placeholder="Opcional" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              {updatePerfil.isError && (
                <Alert variant="destructive">
                  <AlertDescription>{updatePerfil.error.message}</AlertDescription>
                </Alert>
              )}

              <div className="flex justify-end">
                <Button
                  type="submit"
                  className="bg-navy-950 text-white hover:bg-navy-900"
                  disabled={updatePerfil.isPending}
                >
                  {updatePerfil.isPending ? 'Guardando…' : 'Guardar cambios'}
                </Button>
              </div>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  )
}
