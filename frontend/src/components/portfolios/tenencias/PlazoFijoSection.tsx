import { useState } from 'react'
import { zodResolver } from '@hookform/resolvers/zod'
import { useForm, useWatch, type Control } from 'react-hook-form'
import { z } from 'zod'
import TruncatedText from '@/components/portfolios/TruncatedText'
import RowIconActions from '@/components/portfolios/tenencias/RowIconActions'
import RowFormFooter from '@/components/portfolios/tenencias/RowFormFooter'
import SectionShell from '@/components/portfolios/tenencias/SectionShell'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import { Form, FormControl, FormField, FormItem, FormLabel } from '@/components/ui/form'
import TextFormField from '@/components/forms/TextFormField'
import SelectFormField from '@/components/forms/SelectFormField'
import { useEditableSectionState } from '@/hooks/useEditableSectionState'
import { formatFecha, formatMoneda, formatPorcentaje, hoyISO } from '@/lib/format'
import { capitalAlVencimiento, capitalHoy, esVencido, fechaVencimiento, mesesEntre } from '@/lib/plazoFijo'
import type { PortfolioPlazoFijo, TipoPlazoFijo } from '@/types'

const plazoFijoSchema = z.object({
  idTipoPlazoFijo: z.string().min(1, 'Elegí un tipo válido.'),
  entidadFinanciera: z.string().min(1, 'Ingresá un alias válido.'),
  montoInvertido: z
    .string()
    .refine((v) => v.trim() !== '' && !Number.isNaN(Number(v)) && Number(v) > 0, 'Ingresá un monto válido.'),
  tnaPactada: z
    .string()
    .refine((v) => v.trim() !== '' && !Number.isNaN(Number(v)) && Number(v) >= 0, 'Ingresá una tasa válida.'),
  fechaInicio: z.string().min(1, 'Elegí una fecha válida.'),
  duracionDias: z
    .string()
    .refine((v) => v.trim() !== '' && Number.isInteger(Number(v)) && Number(v) >= 1, 'Ingresá un plazo válido.'),
  reinvertirAlVencimiento: z.boolean(),
})
type PlazoFijoValues = z.infer<typeof plazoFijoSchema>

export interface NuevoPlazoFijo {
  idTipoPlazoFijo:          number
  entidadFinanciera:        string
  montoInvertido:           number
  tnaPactada:               number
  fechaInicio:              string
  duracionDias:             number
  reinvertirAlVencimiento:  boolean
}

export interface EditarPlazoFijo {
  entidadFinanciera:        string
  montoInvertido:           number
  tnaPactada:               number
  fechaInicio:              string
  duracionDias:             number
  reinvertirAlVencimiento:  boolean
}

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

export function tasaLabelPara(codigoTipo: string | undefined): string {
  return codigoTipo === 'UVA' ? 'Tasa real' : 'TNA'
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
        <AddRow
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
          <EditRow
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
          <RenovarButton tenencia={tenencia} moneda={moneda} isMutating={isMutating} onConfirm={onRenovar} />
        )}
        <RowIconActions onEdit={onEdit} onDelete={onDelete} />
      </div>
    </div>
  )
}

function RenovarButton({
  tenencia,
  moneda,
  isMutating,
  onConfirm,
}: {
  tenencia: PortfolioPlazoFijo
  moneda: string
  isMutating: boolean
  onConfirm: (payload: EditarPlazoFijo) => Promise<void>
}) {
  const [open, setOpen] = useState(false)
  const tasaLabel = tasaLabelPara(tenencia.nombreTipoPlazoFijo === 'Plazo fijo UVA' ? 'UVA' : undefined)
  const fv = fechaVencimiento(tenencia)
  const capitalRenovado = capitalAlVencimiento(tenencia)
  const interesDevengado = capitalRenovado - tenencia.montoInvertido

  async function handleConfirmar() {
    try {
      await onConfirm({
        entidadFinanciera: tenencia.entidadFinanciera,
        montoInvertido: capitalRenovado,
        tnaPactada: tenencia.tnaPactada,
        fechaInicio: hoyISO(),
        duracionDias: tenencia.duracionDias,
        reinvertirAlVencimiento: tenencia.reinvertirAlVencimiento,
      })
      setOpen(false)
    } catch {
      // Mantener el diálogo abierto: el error ya se muestra debajo de la sección.
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="h-7 shrink-0 rounded-md border border-warning-border bg-warning-bg px-2.5 text-[11px] font-semibold whitespace-nowrap text-warning-title"
      >
        Renovar
      </button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Renovar plazo fijo vencido</DialogTitle>
            <DialogDescription>
              Este plazo fijo venció el {formatFecha(fv)}. El capital pactado ({formatMoneda(tenencia.montoInvertido, moneda)})
              {' '}más el interés devengado durante el plazo original a la {tasaLabel.toLowerCase()} pactada (
              {formatPorcentaje(tenencia.tnaPactada * 100)}) asciende a{' '}
              <strong className="text-navy-950">{formatMoneda(capitalRenovado, moneda)}</strong> (
              {formatMoneda(interesDevengado, moneda)} de interés). Al renovar, se abre un nuevo plazo desde hoy por{' '}
              {tenencia.duracionDias} días con ese capital.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleConfirmar} disabled={isMutating}>
              Confirmar renovación
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}

function FormGrid({
  moneda,
  tipos,
  control,
}: {
  moneda: string
  tipos: TipoPlazoFijo[]
  control: Control<PlazoFijoValues>
}) {
  const idTipoPlazoFijo = useWatch({ control, name: 'idTipoPlazoFijo' })
  const tipoSeleccionado = tipos.find((t) => String(t.idTipoPlazoFijo) === idTipoPlazoFijo) ?? tipos[0]
  const tasaLabel = tasaLabelPara(tipoSeleccionado?.codigo)

  return (
    <>
      <TextFormField
        control={control}
        name="entidadFinanciera"
        label="Alias"
        inputProps={{ placeholder: 'Ej: Banco Galicia' }}
      />
      <div className="grid grid-cols-2 gap-2">
        {tipos.length <= 1 ? (
          <div>
            <span className="field-label">Tipo</span>
            <div className="readonly-chip">{tipos[0]?.nombre ?? '—'}</div>
          </div>
        ) : (
          <SelectFormField
            control={control}
            name="idTipoPlazoFijo"
            label="Tipo"
            options={tipos.map((t) => ({ value: String(t.idTipoPlazoFijo), label: t.nombre }))}
          />
        )}
        <TextFormField
          control={control}
          name="montoInvertido"
          label={`Monto (${moneda})`}
          inputProps={{ type: 'number', placeholder: '0' }}
        />
        <TextFormField
          control={control}
          name="tnaPactada"
          label={`${tasaLabel} (ej: 0.42)`}
          inputProps={{ type: 'number', placeholder: '0' }}
        />
        <TextFormField
          control={control}
          name="duracionDias"
          label="Plazo (días)"
          inputProps={{ type: 'number', min: 1, placeholder: '180' }}
        />
        <TextFormField
          control={control}
          name="fechaInicio"
          label="Fecha de inicio"
          inputProps={{ type: 'date', min: hoyISO() }}
        />
        <FormField
          control={control}
          name="reinvertirAlVencimiento"
          render={({ field }) => (
            <FormItem className="flex flex-row items-center gap-1.5 space-y-0 pb-1">
              <FormControl>
                <Checkbox checked={field.value} onCheckedChange={field.onChange} />
              </FormControl>
              <FormLabel className="text-[11px] font-normal text-ink-muted">
                Reinvertir al vencimiento
              </FormLabel>
            </FormItem>
          )}
        />
      </div>
    </>
  )
}

function EditRow({
  tenencia,
  moneda,
  tipos,
  isMutating,
  onCancel,
  onSave,
}: {
  tenencia: PortfolioPlazoFijo
  moneda: string
  tipos: TipoPlazoFijo[]
  isMutating: boolean
  onCancel: () => void
  onSave: (payload: EditarPlazoFijo) => void
}) {
  const form = useForm<PlazoFijoValues>({
    resolver: zodResolver(plazoFijoSchema),
    mode: 'onChange',
    defaultValues: {
      idTipoPlazoFijo: String(tenencia.idTipoPlazoFijo),
      entidadFinanciera: tenencia.entidadFinanciera,
      montoInvertido: String(tenencia.montoInvertido),
      tnaPactada: String(tenencia.tnaPactada),
      fechaInicio: tenencia.fechaInicio,
      duracionDias: String(tenencia.duracionDias),
      reinvertirAlVencimiento: tenencia.reinvertirAlVencimiento,
    },
  })

  const onSubmit = (values: PlazoFijoValues) =>
    onSave({
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
        <FormGrid moneda={moneda} tipos={tipos} control={form.control} />
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

function AddRow({
  moneda,
  tipos,
  isMutating,
  onCancel,
  onSave,
}: {
  moneda: string
  tipos: TipoPlazoFijo[]
  isMutating: boolean
  onCancel: () => void
  onSave: (payload: NuevoPlazoFijo) => void
}) {
  const form = useForm<PlazoFijoValues>({
    resolver: zodResolver(plazoFijoSchema),
    mode: 'onChange',
    defaultValues: {
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
        <FormGrid moneda={moneda} tipos={tipos} control={form.control} />
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
