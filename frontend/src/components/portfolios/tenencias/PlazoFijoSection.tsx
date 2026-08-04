import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'
import TruncatedText from '@/components/portfolios/TruncatedText'
import RowIconActions from '@/components/portfolios/tenencias/RowIconActions'
import RowFormFooter from '@/components/portfolios/tenencias/RowFormFooter'
import SectionShell from '@/components/portfolios/tenencias/SectionShell'
import PlazoFijoFormGrid from '@/components/portfolios/tenencias/PlazoFijoFormGrid'
import RenovarPlazoFijoDialog from '@/components/portfolios/tenencias/RenovarPlazoFijoDialog'
import { Form } from '@/components/ui/form'
import {
  plazoFijoSchema,
  type EditarPlazoFijo,
  type NuevoPlazoFijo,
  type PlazoFijoValues,
} from '@/components/portfolios/tenencias/plazoFijoForm'
import { useEditableSectionState } from '@/hooks/useEditableSectionState'
import { formatFecha, formatMoneda, formatPorcentaje, hoyISO } from '@/lib/format'
import { capitalHoy, esVencido, mesesEntre, tasaLabelPara } from '@/lib/plazoFijo'
import type { PortfolioPlazoFijo, TipoPlazoFijo } from '@/types'

export type { EditarPlazoFijo, NuevoPlazoFijo }

interface Props {
  titulo:            string
  tooltip:           string
  moneda:            string
  addButtonDataTour?: string
  tenencias:         PortfolioPlazoFijo[]
  tipos:             TipoPlazoFijo[]
  isMutating:        boolean
  error?:            string | null
  onAdd:    (payload: NuevoPlazoFijo) => Promise<void>
  onUpdate: (idPortfolioPlazoFijo: number, payload: EditarPlazoFijo) => Promise<void>
  onDelete: (idPortfolioPlazoFijo: number) => void
}

export default function PlazoFijoSection({
  titulo,
  tooltip,
  moneda,
  addButtonDataTour,
  tenencias,
  tipos,
  isMutating,
  error,
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
      addLabel="+ Agregar plazo fijo"
      addButtonDataTour={addButtonDataTour}
      isAdding={isAdding}
      onStartAdd={empezarAgregar}
      error={error}
      addRow={
        <Row
          moneda={moneda}
          tipos={tipos}
          isMutating={isMutating}
          onCancel={cancelarAgregar}
          onSave={(payload) => guardarAltaYCerrar(() => onAdd(payload))}
        />
      }
    >
      {tenencias.map((t) =>
        editingId === t.idPortfolioPlazoFijo ? (
          <Row
            key={t.idPortfolioPlazoFijo}
            tenencia={t}
            moneda={moneda}
            tipos={tipos}
            isMutating={isMutating}
            onCancel={cancelarEdicion}
            onSave={(payload) => guardarEdicionYCerrar(() => onUpdate(t.idPortfolioPlazoFijo, payload))}
          />
        ) : (
          <ViewRow
            key={t.idPortfolioPlazoFijo}
            tenencia={t}
            moneda={moneda}
            isMutating={isMutating}
            onEdit={() => editar(t.idPortfolioPlazoFijo)}
            onDelete={() => onDelete(t.idPortfolioPlazoFijo)}
            onRenovar={(payload) => onUpdate(t.idPortfolioPlazoFijo, payload)}
          />
        ),
      )}
    </SectionShell>
  )
}

function ViewRow({
  tenencia,
  moneda,
  isMutating,
  onEdit,
  onDelete,
  onRenovar,
}: {
  tenencia: PortfolioPlazoFijo
  moneda: string
  isMutating: boolean
  onEdit: () => void
  onDelete: () => void
  onRenovar: (payload: EditarPlazoFijo) => Promise<void>
}) {
  const tasaLabel = tasaLabelPara(tenencia.nombreTipoPlazoFijo === 'Plazo fijo UVA' ? 'UVA' : undefined)
  const vencido = esVencido(tenencia)
  const mesesTranscurridos = mesesEntre(tenencia.fechaInicio, hoyISO())
  const stats = [
    { label: 'Monto', value: formatMoneda(tenencia.montoInvertido, moneda) },
    { label: tasaLabel, value: `${formatPorcentaje(tenencia.tnaPactada * 100)}` },
    { label: 'Plazo', value: `${tenencia.duracionDias} días` },
    { label: 'Inicio', value: formatFecha(tenencia.fechaInicio) },
    { label: 'Reinversión', value: tenencia.reinvertirAlVencimiento ? 'Sí' : 'No' },
  ]
  if (!vencido && mesesTranscurridos > 0) {
    stats.push({ label: 'Capital hoy', value: formatMoneda(capitalHoy(tenencia), moneda) })
  }

  return (
    <div className="tenencia-row">
      <div className="min-w-0 flex-1 basis-32">
        <div className="flex items-center gap-1.5">
          <TruncatedText text={tenencia.entidadFinanciera} className="tenencia-row-title" />
          {vencido && (
            <span className="inline-flex shrink-0 items-center rounded-full bg-danger-bg px-2 py-0.5 text-[10.5px] font-bold text-danger">
              Vencido
            </span>
          )}
        </div>
        <p className="tenencia-row-subtitle">{tenencia.nombreTipoPlazoFijo}</p>
      </div>
      <div className="tenencia-row-stats">
        {stats.map((s) => (
          <div key={s.label} className="text-right">
            <p className="stat-label">{s.label}</p>
            <p className="mt-0.5 stat-value">{s.value}</p>
          </div>
        ))}
      </div>
      <div className="ml-auto flex shrink-0 items-center gap-1.5">
        {vencido && (
          <RenovarPlazoFijoDialog tenencia={tenencia} moneda={moneda} isMutating={isMutating} onConfirm={onRenovar} />
        )}
        <RowIconActions onEdit={onEdit} onDelete={onDelete} />
      </div>
    </div>
  )
}

function Row({
  tenencia,
  moneda,
  tipos,
  isMutating,
  onCancel,
  onSave,
}: {
  tenencia?: PortfolioPlazoFijo
  moneda: string
  tipos: TipoPlazoFijo[]
  isMutating: boolean
  onCancel: () => void
  onSave: (payload: NuevoPlazoFijo) => void
}) {
  const form = useForm<PlazoFijoValues>({
    resolver: zodResolver(plazoFijoSchema),
    mode: 'onChange',
    defaultValues: tenencia
      ? {
          idTipoPlazoFijo: String(tenencia.idTipoPlazoFijo),
          entidadFinanciera: tenencia.entidadFinanciera,
          montoInvertido: String(tenencia.montoInvertido),
          tnaPactada: String(tenencia.tnaPactada),
          fechaInicio: tenencia.fechaInicio,
          duracionDias: String(tenencia.duracionDias),
          reinvertirAlVencimiento: tenencia.reinvertirAlVencimiento,
        }
      : {
          idTipoPlazoFijo: String(tipos[0]?.idTipoPlazoFijo ?? ''),
          entidadFinanciera: '',
          montoInvertido: '',
          tnaPactada: '',
          fechaInicio: '',
          duracionDias: '',
          reinvertirAlVencimiento: false,
        },
  })

  const onSubmit = (values: PlazoFijoValues) =>
    onSave({
      idTipoPlazoFijo: Number(values.idTipoPlazoFijo),
      entidadFinanciera: values.entidadFinanciera,
      montoInvertido: Number(values.montoInvertido),
      tnaPactada: Number(values.tnaPactada),
      fechaInicio: values.fechaInicio,
      duracionDias: Number(values.duracionDias),
      reinvertirAlVencimiento: values.reinvertirAlVencimiento,
    })

  return (
    <Form {...form}>
      <div className="compare-card gap-2">
        <PlazoFijoFormGrid moneda={moneda} tipos={tipos} control={form.control} />
        <RowFormFooter
          className="mt-0.5 flex justify-end gap-2"
          onCancel={onCancel}
          isMutating={isMutating}
          canSave={Object.keys(form.formState.errors).length === 0}
          onSave={form.handleSubmit(onSubmit)}
        />
      </div>
    </Form>
  )
}
