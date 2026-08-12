import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'
import InfoTooltip from '@/components/portfolios/InfoTooltip'
import TruncatedText from '@/components/portfolios/TruncatedText'
import CronogramaFlujos from '@/components/portfolios/tenencias/CronogramaFlujos'
import DisponibleParaInvertir from '@/components/portfolios/tenencias/DisponibleParaInvertir'
import RowIconActions from '@/components/portfolios/tenencias/RowIconActions'
import RowFormFooter from '@/components/portfolios/tenencias/RowFormFooter'
import SectionShell from '@/components/portfolios/tenencias/SectionShell'
import CamposCantidadYPreview from '@/components/portfolios/tenencias/CamposCantidadYPreview'
import CatalogoTenenciaAddRow from '@/components/portfolios/tenencias/CatalogoTenenciaAddRow'
import { Form } from '@/components/ui/form'
import { useEditableSectionState } from '@/hooks/useEditableSectionState'
import {
  editSchema,
  type CatalogoOpcion,
  type EditValues,
  type TenenciaItem,
} from '@/components/portfolios/tenencias/catalogoTenenciaForm'

export type { CatalogoOpcion, TenenciaItem }

interface Props {
  titulo:           string
  tooltip:          string
  pickLabel:        string
  addLabel:         string
  emptyMessage:     string
  tenencias:        TenenciaItem[]
  catalogo:         CatalogoOpcion[]
  isMutating:       boolean
  disponible:       number | null
  monedaBase:       string
  moneda:           'ARS' | 'USD'
  tipoCambio?:      number
  error?:           string | null
  onDescartarError?: () => void
  cantidadLabel?:   string
  cantidadTooltip?: string
  montoInvertidoTooltip?: string
  onAdd:    (idCatalogo: number, cantidad: number, precioCompra: number) => Promise<void>
  onUpdate: (idCatalogo: number, cantidad: number) => Promise<void>
  onDelete: (idCatalogo: number) => void
}

export default function CatalogoTenenciaSection({
  titulo,
  tooltip,
  pickLabel,
  addLabel,
  emptyMessage,
  tenencias,
  catalogo,
  isMutating,
  disponible,
  monedaBase,
  moneda,
  tipoCambio,
  error,
  onDescartarError,
  cantidadLabel = 'Cantidad',
  cantidadTooltip,
  montoInvertidoTooltip,
  onAdd,
  onUpdate,
  onDelete,
}: Props) {
  const {
    editingId,
    isAdding,
    editar,
    cancelarEdicion,
    empezarAgregar,
    cancelarAgregar,
    guardarEdicionYCerrar,
    guardarAltaYCerrar,
  } = useEditableSectionState(onDescartarError)

  return (
    <SectionShell
      titulo={titulo}
      tooltip={tooltip}
      addLabel={addLabel}
      isAdding={isAdding}
      onStartAdd={empezarAgregar}
      error={error}
      addRow={
        <CatalogoTenenciaAddRow
          pickLabel={pickLabel}
          emptyMessage={emptyMessage}
          catalogo={catalogo}
          isMutating={isMutating}
          disponible={disponible}
          monedaBase={monedaBase}
          moneda={moneda}
          tipoCambio={tipoCambio}
          onCancel={cancelarAgregar}
          cantidadLabel={cantidadLabel}
          cantidadTooltip={cantidadTooltip}
          montoInvertidoTooltip={montoInvertidoTooltip}
          onSave={(idCatalogo, cantidad, precioCompra) =>
            guardarAltaYCerrar(() => onAdd(idCatalogo, cantidad, precioCompra))
          }
        />
      }
    >
      {tenencias.map((t) =>
        editingId === t.idCatalogo ? (
          <EditExistingRow
            key={t.idCatalogo}
            tenencia={t}
            isMutating={isMutating}
            disponible={disponible}
            monedaBase={monedaBase}
            moneda={moneda}
            tipoCambio={tipoCambio}
            onCancel={cancelarEdicion}
            cantidadLabel={cantidadLabel}
            cantidadTooltip={cantidadTooltip}
            montoInvertidoTooltip={montoInvertidoTooltip}
            onSave={(cantidad) => guardarEdicionYCerrar(() => onUpdate(t.idCatalogo, cantidad))}
          />
        ) : (
          <ViewRow
            key={t.idCatalogo}
            tenencia={t}
            onEdit={() => editar(t.idCatalogo)}
            onDelete={() => onDelete(t.idCatalogo)}
          />
        ),
      )}
    </SectionShell>
  )
}

function ViewRow({
  tenencia,
  onEdit,
  onDelete,
}: {
  tenencia: TenenciaItem
  onEdit: () => void
  onDelete: () => void
}) {
  return (
    <div className="flex flex-col">
      <div className="tenencia-row">
        <div className="min-w-0 flex-1 basis-32">
          <TruncatedText text={tenencia.titulo} className="tenencia-row-title" />
          <p className="tenencia-row-subtitle">{tenencia.subtitulo}</p>
        </div>
        <div className="tenencia-row-stats">
          {tenencia.previewFields.map((f) => (
            <div key={f.label} className="text-right">
              <p className="stat-label flex items-center justify-end gap-1">
                {f.label}
                {f.tooltip && <InfoTooltip term={f.label} definition={f.tooltip} />}
              </p>
              <p className="mt-0.5 stat-value">{f.value}</p>
            </div>
          ))}
        </div>
        <RowIconActions onEdit={onEdit} onDelete={onDelete} />
      </div>
      <CronogramaFlujos flujos={tenencia.flujos} cantidadLotes={tenencia.cantidadActual} esCer={tenencia.esCer} />
    </div>
  )
}

function EditExistingRow({
  tenencia,
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
}: {
  tenencia: TenenciaItem
  isMutating: boolean
  disponible: number | null
  monedaBase: string
  moneda: 'ARS' | 'USD'
  tipoCambio?: number
  onCancel: () => void
  cantidadLabel: string
  cantidadTooltip?: string
  montoInvertidoTooltip?: string
  onSave: (cantidad: number) => void
}) {
  const form = useForm<EditValues>({
    resolver: zodResolver(editSchema),
    mode: 'onChange',
    defaultValues: { cantidad: String(tenencia.cantidadActual) },
  })
  const cantidadNum = Number(form.watch('cantidad')) || 0

  const onSubmit = (values: EditValues) => onSave(Number(values.cantidad))

  return (
    <Form {...form}>
      <div className="compare-card gap-2.5">
        <DisponibleParaInvertir disponible={disponible} monedaBase={monedaBase} />
        <CamposCantidadYPreview
          control={form.control}
          previewFields={tenencia.previewFields}
          precioActual={tenencia.precioActual}
          cantidadNum={cantidadNum}
          cantidadLabel={cantidadLabel}
          cantidadTooltip={cantidadTooltip}
          montoInvertidoTooltip={montoInvertidoTooltip}
          moneda={moneda}
          monedaBase={monedaBase}
          tipoCambio={tipoCambio}
        />
        <CronogramaFlujos flujos={tenencia.flujos} cantidadLotes={cantidadNum} esCer={tenencia.esCer} />
        <RowFormFooter
          onCancel={onCancel}
          isMutating={isMutating}
          canSave={Object.keys(form.formState.errors).length === 0}
          onSave={form.handleSubmit(onSubmit)}
        />
      </div>
    </Form>
  )
}
