import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'
import CronogramaFlujos from '@/components/portfolios/tenencias/CronogramaFlujos'
import RowFormFooter from '@/components/portfolios/tenencias/RowFormFooter'
import CamposCantidadYPreview from '@/components/portfolios/tenencias/CamposCantidadYPreview'
import { Form } from '@/components/ui/form'
import SelectFormField from '@/components/forms/SelectFormField'
import { addSchema, type AddValues, type CatalogoOpcion } from '@/components/portfolios/tenencias/catalogoTenenciaForm'

interface Props {
  pickLabel: string
  emptyMessage: string
  catalogo: CatalogoOpcion[]
  isMutating: boolean
  onCancel: () => void
  cantidadLabel: string
  cantidadTooltip?: string
  montoInvertidoTooltip?: string
  onSave: (idCatalogo: number, cantidad: number, precioCompra: number) => void
}

export default function CatalogoTenenciaAddRow({
  pickLabel,
  emptyMessage,
  catalogo,
  isMutating,
  onCancel,
  cantidadLabel,
  cantidadTooltip,
  montoInvertidoTooltip,
  onSave,
}: Props) {
  const form = useForm<AddValues>({
    resolver: zodResolver(addSchema),
    mode: 'onChange',
    defaultValues: { idCatalogo: '', cantidad: '' },
  })
  const idCatalogo = form.watch('idCatalogo')
  const selected = catalogo.find((c) => String(c.id) === idCatalogo)
  const cantidadNum = Number(form.watch('cantidad')) || 0

  const onSubmit = (values: AddValues) => {
    if (!selected) return
    onSave(selected.id, Number(values.cantidad), selected.precioActual)
  }

  return (
    <Form {...form}>
      <div className="compare-card gap-2.5">
        {catalogo.length === 0 ? (
          <div className="banner-warning">
            {emptyMessage}
          </div>
        ) : (
          <SelectFormField
            control={form.control}
            name="idCatalogo"
            label={pickLabel}
            placeholder="Seleccionar…"
            options={catalogo.map((c) => ({ value: String(c.id), label: c.etiqueta }))}
            onValueChange={() => form.setValue('cantidad', '')}
          />
        )}

        {selected && (
          <>
            <CamposCantidadYPreview
              control={form.control}
              previewFields={selected.previewFields}
              precioActual={selected.precioActual}
              cantidadNum={cantidadNum}
              cantidadLabel={cantidadLabel}
              cantidadTooltip={cantidadTooltip}
              montoInvertidoTooltip={montoInvertidoTooltip}
            />
            <CronogramaFlujos flujos={selected.flujos} cantidadLotes={cantidadNum} esCer={selected.esCer} />
          </>
        )}

        <RowFormFooter
          onCancel={onCancel}
          isMutating={isMutating}
          canSave={!!selected && Object.keys(form.formState.errors).length === 0}
          onSave={form.handleSubmit(onSubmit)}
        />
      </div>
    </Form>
  )
}
