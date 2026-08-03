import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import InfoTooltip from '@/components/portfolios/InfoTooltip'
import TruncatedText from '@/components/portfolios/TruncatedText'
import CronogramaFlujos from '@/components/portfolios/tenencias/CronogramaFlujos'
import RowIconActions from '@/components/portfolios/tenencias/RowIconActions'
import RowFormFooter from '@/components/portfolios/tenencias/RowFormFooter'
import SectionShell from '@/components/portfolios/tenencias/SectionShell'
import { Form } from '@/components/ui/form'
import TextFormField from '@/components/forms/TextFormField'
import SelectFormField from '@/components/forms/SelectFormField'
import { useEditableSectionState } from '@/hooks/useEditableSectionState'
import { formatMoneda } from '@/lib/format'
import type { CampoPreview } from '@/lib/tenenciaDisplay'
import type { FlujoCaja } from '@/types'

const cantidadSchema = z
  .string()
  .refine((v) => v.trim() !== '' && Number.isInteger(Number(v)) && Number(v) > 0, 'Ingresá una cantidad válida.')

const addSchema = z.object({
  idCatalogo: z.string().min(1, 'Elegí una opción válida.'),
  cantidad: cantidadSchema,
})
type AddValues = z.infer<typeof addSchema>

const editSchema = z.object({ cantidad: cantidadSchema })
type EditValues = z.infer<typeof editSchema>

export interface CatalogoOpcion {
  id:            number
  etiqueta:      string
  previewFields: CampoPreview[]
  precioActual:  number
  flujos?:       FlujoCaja[]
  esCer?:        boolean
}

export interface TenenciaItem {
  idCatalogo:      number
  titulo:          string
  subtitulo:       string
  previewFields:   CampoPreview[]
  cantidadActual:  number
  precioActual?:   number
  flujos?:         FlujoCaja[]
  esCer?:          boolean
}

interface Props {
  titulo:           string
  tooltip:          string
  pickLabel:        string
  addLabel:         string
  emptyMessage:     string
  tenencias:        TenenciaItem[]
  catalogo:         CatalogoOpcion[]
  isMutating:       boolean
  error?:           string | null
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
  error,
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
  } = useEditableSectionState()

  return (
    <SectionShell
      titulo={titulo}
      tooltip={tooltip}
      addLabel={addLabel}
      isAdding={isAdding}
      onStartAdd={empezarAgregar}
      error={error}
      addRow={
        <AddRow
          pickLabel={pickLabel}
          emptyMessage={emptyMessage}
          catalogo={catalogo}
          isMutating={isMutating}
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
  onCancel,
  cantidadLabel,
  cantidadTooltip,
  montoInvertidoTooltip,
  onSave,
}: {
  tenencia: TenenciaItem
  isMutating: boolean
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
        <div className="grid grid-cols-2 gap-2">
          {tenencia.previewFields.map((f) => (
            <div key={f.label}>
              <span className="field-label inline-flex items-center gap-1">
                {f.label}
                {f.tooltip && <InfoTooltip term={f.label} definition={f.tooltip} />}
              </span>
              <div className="readonly-chip">{f.value}</div>
            </div>
          ))}
          <TextFormField
            control={form.control}
            name="cantidad"
            label={
              <span className="inline-flex items-center gap-1">
                {cantidadLabel}
                {cantidadTooltip && <InfoTooltip term={cantidadLabel} definition={cantidadTooltip} />}
              </span>
            }
            inputProps={{ type: 'number', step: '1', placeholder: '0' }}
          />
          {tenencia.precioActual != null && cantidadNum > 0 && (
            <div>
              <span className="field-label inline-flex items-center gap-1">
                Monto invertido
                {montoInvertidoTooltip && <InfoTooltip term="Monto invertido" definition={montoInvertidoTooltip} />}
              </span>
              <div className="readonly-chip">{formatMoneda(cantidadNum * tenencia.precioActual, 'ARS')}</div>
            </div>
          )}
        </div>
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

function AddRow({
  pickLabel,
  emptyMessage,
  catalogo,
  isMutating,
  onCancel,
  cantidadLabel,
  cantidadTooltip,
  montoInvertidoTooltip,
  onSave,
}: {
  pickLabel: string
  emptyMessage: string
  catalogo: CatalogoOpcion[]
  isMutating: boolean
  onCancel: () => void
  cantidadLabel: string
  cantidadTooltip?: string
  montoInvertidoTooltip?: string
  onSave: (idCatalogo: number, cantidad: number, precioCompra: number) => void
}) {
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
            <div className="grid grid-cols-2 gap-2">
              {selected.previewFields.map((f) => (
                <div key={f.label}>
                  <span className="field-label inline-flex items-center gap-1">
                    {f.label}
                    {f.tooltip && <InfoTooltip term={f.label} definition={f.tooltip} />}
                  </span>
                  <div className="readonly-chip">{f.value}</div>
                </div>
              ))}
              <TextFormField
                control={form.control}
                name="cantidad"
                label={
                  <span className="inline-flex items-center gap-1">
                    {cantidadLabel}
                    {cantidadTooltip && <InfoTooltip term={cantidadLabel} definition={cantidadTooltip} />}
                  </span>
                }
                inputProps={{ type: 'number', step: '1', placeholder: '0' }}
              />
              {cantidadNum > 0 && (
                <div>
                  <span className="field-label inline-flex items-center gap-1">
                    Monto invertido
                    {montoInvertidoTooltip && (
                      <InfoTooltip term="Monto invertido" definition={montoInvertidoTooltip} />
                    )}
                  </span>
                  <div className="readonly-chip">{formatMoneda(cantidadNum * selected.precioActual, 'ARS')}</div>
                </div>
              )}
            </div>
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
