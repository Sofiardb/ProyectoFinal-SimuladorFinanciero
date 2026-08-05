import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'
import { useNavigate } from 'react-router-dom'
import { z } from 'zod'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Form } from '@/components/ui/form'
import TextFormField from '@/components/forms/TextFormField'
import MutationErrorAlert from '@/components/forms/MutationErrorAlert'
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
  const navigate = useNavigate()
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
      <button onClick={() => navigate(-1)} className="btn-back">
        ← Volver
      </button>
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
              <TextFormField
                control={form.control}
                name="email"
                label="Email"
                inputProps={{ className: 'h-11 rounded-[9px]', autoComplete: 'email' }}
              />

              <TextFormField
                control={form.control}
                name="username"
                label="Nombre de usuario"
                inputProps={{ className: 'h-11 rounded-[9px]', autoComplete: 'username' }}
              />

              <div className="grid grid-cols-2 gap-3">
                <TextFormField
                  control={form.control}
                  name="nombre"
                  label="Nombre"
                  inputProps={{ className: 'h-11 rounded-[9px]', placeholder: 'Opcional' }}
                />
                <TextFormField
                  control={form.control}
                  name="apellido"
                  label="Apellido"
                  inputProps={{ className: 'h-11 rounded-[9px]', placeholder: 'Opcional' }}
                />
              </div>

              <MutationErrorAlert error={updatePerfil.error} />

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
