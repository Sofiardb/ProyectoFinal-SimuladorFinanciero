import { zodResolver } from '@hookform/resolvers/zod'
import { useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
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
import TextFormField from '@/components/forms/TextFormField'
import SelectFormField from '@/components/forms/SelectFormField'
import MutationErrorAlert from '@/components/forms/MutationErrorAlert'
import TipoCambioIndicator from '@/components/portfolios/TipoCambioIndicator'
import { useCreatePortfolio, useUpdatePortfolio, useMonedas, usePerfilesRiesgo } from '@/api/hooks'
import type { PortfolioResumen } from '@/types'

const schema = z.object({
  nombre: z.string().min(1, 'Ingresá un nombre.').max(100, 'Máximo 100 caracteres.'),
  descripcion: z.string().max(500, 'Máximo 500 caracteres.').optional(),
  idPerfilRiesgo: z.number().int().positive('Elegí un perfil de riesgo.'),
  idMonedaBase: z.string().min(1, 'Elegí una moneda.'),
  capitalInicial: z
    .string()
    .optional()
    .refine(
      (v) => !v || (!Number.isNaN(Number(v)) && Number(v) > 0),
      'Debe ser un valor positivo.',
    ),
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
  const navigate = useNavigate()
  const { data: monedas } = useMonedas()
  const { data: perfiles } = usePerfilesRiesgo()
  const createPortfolio = useCreatePortfolio()
  const updatePortfolio = useUpdatePortfolio(portfolio?.idPortfolio ?? -1)
  const mutation = isEdit ? updatePortfolio : createPortfolio

  const form = useForm<Values>({
    resolver: zodResolver(schema),
    mode: 'onChange',
    defaultValues: {
      nombre: portfolio?.nombre ?? '',
      descripcion: portfolio?.descripcion ?? '',
      idPerfilRiesgo: portfolio?.idPerfilRiesgo ?? defaultPerfilId ?? 0,
      idMonedaBase: portfolio?.idMonedaBase ? String(portfolio.idMonedaBase) : '',
      capitalInicial: portfolio?.capitalInicial ? String(portfolio.capitalInicial) : '',
    },
  })

  const onSubmit = (values: Values) => {
    const payload = {
      nombre: values.nombre,
      descripcion: values.descripcion || undefined,
      idPerfilRiesgo: values.idPerfilRiesgo,
      idMonedaBase: Number(values.idMonedaBase),
      capitalInicial: values.capitalInicial ? Number(values.capitalInicial) : undefined,
    }
    mutation.mutate(payload, {
      onSuccess: (creado) => {
        toast.success(isEdit ? 'Portfolio actualizado.' : 'Portfolio creado.')
        onDone()
        // Al crear (no al editar) vamos directo al detalle para agregar instrumentos.
        if (!isEdit) navigate(`/portfolios/${creado.idPortfolio}`)
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
          <TextFormField
            control={form.control}
            name="nombre"
            label="Nombre"
            inputProps={{ placeholder: 'Ej: Mi portfolio moderado' }}
          />

          <TextFormField
            control={form.control}
            name="descripcion"
            label="Descripción (opcional)"
            inputProps={{ placeholder: 'Notas sobre esta estrategia' }}
          />

          <div className="grid grid-cols-2 gap-3">
            <FormField
              control={form.control}
              name="idPerfilRiesgo"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Perfil de riesgo</FormLabel>
                  {isEdit || defaultPerfilId == null ? (
                    <Select
                      items={Object.fromEntries((perfiles ?? []).map((p) => [String(p.idPerfilRiesgo), p.nombre]))}
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

            <SelectFormField
              control={form.control}
              name="idMonedaBase"
              label="Moneda base"
              placeholder="Elegir"
              options={(monedas ?? []).map((m) => ({ value: String(m.idMoneda), label: m.codigoIso }))}
            />
          </div>

          <TextFormField
            control={form.control}
            name="capitalInicial"
            label="Presupuesto (opcional)"
            inputProps={{ type: 'number', step: '0.01', placeholder: 'Sin límite' }}
          />
          <TipoCambioIndicator />

          <MutationErrorAlert error={mutation.error} />

          <DialogFooter>
            <Button
              type="submit"
              className="bg-navy-950 text-white hover:bg-navy-900"
              disabled={mutation.isPending || Object.keys(form.formState.errors).length > 0}
            >
              {mutation.isPending ? 'Guardando…' : isEdit ? 'Guardar cambios' : 'Crear portfolio'}
            </Button>
          </DialogFooter>
        </form>
      </Form>
    </>
  )
}
