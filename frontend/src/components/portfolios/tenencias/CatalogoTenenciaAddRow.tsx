import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'
import CronogramaFlujos from '@/components/portfolios/tenencias/CronogramaFlujos'
import DisponibleParaInvertir from '@/components/portfolios/tenencias/DisponibleParaInvertir'
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
  disponible: number | null
  monedaBase: string
  moneda: 'ARS' | 'USD'
  tipoCambio?: number
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
  disponible,
  monedaBase,
  moneda,
  tipoCambio,
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
        <DisponibleParaInvertir disponible={disponible} monedaBase={monedaBase} />
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
              moneda={moneda}
              monedaBase={monedaBase}
              tipoCambio={tipoCambio}
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
