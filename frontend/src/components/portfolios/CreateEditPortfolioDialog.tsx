import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Alert, AlertDescription } from '@/components/ui/alert'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import { useCreatePortfolio, useUpdatePortfolio, useMonedas, usePerfilesRiesgo } from '@/api/hooks'
import type { PortfolioResumen } from '@/types'

const schema = z.object({
  nombre: z.string().min(1, 'Ingresá un nombre.').max(100, 'Máximo 100 caracteres.'),
  descripcion: z.string().max(500, 'Máximo 500 caracteres.').optional(),
  idPerfilRiesgo: z.number().int().positive('Elegí un perfil de riesgo.'),
  idMonedaBase: z.number().int().positive('Elegí una moneda.'),
  capitalInicial: z
    .string()
    .optional()
    .refine(
      (v) => !v || (!Number.isNaN(Number(v)) && Number(v) > 0),
      'Debe ser un valor positivo.',
    ),
  horizonteMeses: z.number().int().min(1, 'Mínimo 1 mes.').max(360, 'Máximo 360 meses.'),
})

type Values = z.infer<typeof schema>

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  portfolio?: PortfolioResumen
  defaultPerfilId?: number
}

export default function CreateEditPortfolioDialog({
  open,
  onOpenChange,
  portfolio,
  defaultPerfilId,
}: Props) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        {open && (
          <PortfolioForm
            key={portfolio?.idPortfolio ?? 'create'}
            portfolio={portfolio}
            defaultPerfilId={defaultPerfilId}
            onDone={() => onOpenChange(false)}
          />
        )}
      </DialogContent>
    </Dialog>
  )
}

function PortfolioForm({
  portfolio,
  defaultPerfilId,
  onDone,
}: {
  portfolio?: PortfolioResumen
  defaultPerfilId?: number
  onDone: () => void
}) {
  const isEdit = !!portfolio
  const { data: monedas } = useMonedas()
  const { data: perfiles } = usePerfilesRiesgo()
  const createPortfolio = useCreatePortfolio()
  const updatePortfolio = useUpdatePortfolio(portfolio?.idPortfolio ?? -1)
  const mutation = isEdit ? updatePortfolio : createPortfolio

  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: {
      nombre: portfolio?.nombre ?? '',
      descripcion: portfolio?.descripcion ?? '',
      idPerfilRiesgo: portfolio?.idPerfilRiesgo ?? defaultPerfilId ?? 0,
      idMonedaBase: portfolio?.idMonedaBase ?? 0,
      capitalInicial: portfolio?.capitalInicial ? String(portfolio.capitalInicial) : '',
      horizonteMeses: portfolio?.horizonteMeses ?? 12,
    },
  })

  const onSubmit = (values: Values) => {
    const payload = {
      nombre: values.nombre,
      descripcion: values.descripcion || undefined,
      idPerfilRiesgo: values.idPerfilRiesgo,
      idMonedaBase: values.idMonedaBase,
      capitalInicial: values.capitalInicial ? Number(values.capitalInicial) : undefined,
      horizonteMeses: values.horizonteMeses,
    }
    mutation.mutate(payload, {
      onSuccess: () => {
        toast.success(isEdit ? 'Portfolio actualizado.' : 'Portfolio creado.')
        onDone()
      },
    })
  }

  return (
    <>
      <DialogHeader>
        <DialogTitle>{isEdit ? 'Editar portfolio' : 'Crear portfolio'}</DialogTitle>
        <DialogDescription>
          {isEdit
            ? 'Actualizá los datos generales de tu portfolio.'
            : 'Definí los datos generales. Después vas a poder agregar instrumentos.'}
        </DialogDescription>
      </DialogHeader>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-3">
          <FormField
            control={form.control}
            name="nombre"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Nombre</FormLabel>
                <FormControl>
                  <Input placeholder="Ej: Mi portfolio moderado" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="descripcion"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Descripción (opcional)</FormLabel>
                <FormControl>
                  <Input placeholder="Notas sobre esta estrategia" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <div className="grid grid-cols-2 gap-3">
            <FormField
              control={form.control}
              name="idPerfilRiesgo"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Perfil de riesgo</FormLabel>
                  {isEdit ? (
                    <Select
                      value={field.value ? String(field.value) : undefined}
                      onValueChange={(v) => field.onChange(Number(v))}
                    >
                      <FormControl>
                        <SelectTrigger className="w-full">
                          <SelectValue placeholder="Elegir" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {perfiles?.map((p) => (
                          <SelectItem key={p.idPerfilRiesgo} value={String(p.idPerfilRiesgo)}>
                            {p.nombre}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ) : (
                    <FormControl>
                      <Input
                        disabled
                        value={perfiles?.find((p) => p.idPerfilRiesgo === field.value)?.nombre ?? ''}
                      />
                    </FormControl>
                  )}
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="idMonedaBase"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Moneda base</FormLabel>
                  <Select
                    value={field.value ? String(field.value) : undefined}
                    onValueChange={(v) => field.onChange(Number(v))}
                  >
                    <FormControl>
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Elegir" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {monedas?.map((m) => (
                        <SelectItem key={m.idMoneda} value={String(m.idMoneda)}>
                          {m.codigoIso}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <FormField
              control={form.control}
              name="capitalInicial"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Presupuesto (opcional)</FormLabel>
                  <FormControl>
                    <Input type="number" step="0.01" placeholder="Sin límite" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="horizonteMeses"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Horizonte (meses)</FormLabel>
                  <FormControl>
                    <Input type="number" min={1} max={360} {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          {mutation.isError && (
            <Alert variant="destructive">
              <AlertDescription>{mutation.error.message}</AlertDescription>
            </Alert>
          )}

          <DialogFooter>
            <Button
              type="submit"
              className="bg-navy-950 text-white hover:bg-navy-900"
              disabled={mutation.isPending}
            >
              {mutation.isPending ? 'Guardando…' : isEdit ? 'Guardar cambios' : 'Crear portfolio'}
            </Button>
          </DialogFooter>
        </form>
      </Form>
    </>
  )
}
