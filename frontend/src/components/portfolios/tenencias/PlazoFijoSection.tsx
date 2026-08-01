import { useState } from 'react'
import TruncatedText from '@/components/portfolios/TruncatedText'
import RowIconActions from '@/components/portfolios/tenencias/RowIconActions'
import RowFormFooter from '@/components/portfolios/tenencias/RowFormFooter'
import SectionShell from '@/components/portfolios/tenencias/SectionShell'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import { useEditableSectionState } from '@/hooks/useEditableSectionState'
import { formatFecha, formatMoneda, formatPorcentaje, hoyISO } from '@/lib/format'
import { capitalAlVencimiento, capitalHoy, esVencido, fechaVencimiento, mesesEntre } from '@/lib/plazoFijo'
import type { PortfolioPlazoFijo, TipoPlazoFijo } from '@/types'

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

function plazoFijoFormFields(defaults?: Partial<EditarPlazoFijo>) {
  return {
    entidadFinanciera: defaults?.entidadFinanciera ?? '',
    montoInvertido: defaults?.montoInvertido !== undefined ? String(defaults.montoInvertido) : '',
    tnaPactada: defaults?.tnaPactada !== undefined ? String(defaults.tnaPactada) : '',
    fechaInicio: defaults?.fechaInicio ?? '',
    duracionDias: defaults?.duracionDias !== undefined ? String(defaults.duracionDias) : '',
    reinvertirAlVencimiento: defaults?.reinvertirAlVencimiento ?? false,
  }
}

function TipoField({
  tipos,
  idTipoPlazoFijo,
  onChange,
}: {
  tipos: TipoPlazoFijo[]
  idTipoPlazoFijo: string
  onChange: (id: string) => void
}) {
  if (tipos.length <= 1) {
    return <div className="readonly-chip">{tipos[0]?.nombre ?? '—'}</div>
  }
  return (
    <select className="field-input" value={idTipoPlazoFijo} onChange={(e) => onChange(e.target.value)}>
      {tipos.map((t) => (
        <option key={t.idTipoPlazoFijo} value={t.idTipoPlazoFijo}>
          {t.nombre}
        </option>
      ))}
    </select>
  )
}

function FormGrid({
  moneda,
  tipos,
  idTipoPlazoFijo,
  setIdTipoPlazoFijo,
  fields,
  setFields,
}: {
  moneda: string
  tipos: TipoPlazoFijo[]
  idTipoPlazoFijo: string
  setIdTipoPlazoFijo: (v: string) => void
  fields: ReturnType<typeof plazoFijoFormFields>
  setFields: React.Dispatch<React.SetStateAction<ReturnType<typeof plazoFijoFormFields>>>
}) {
  const tipoSeleccionado = tipos.find((t) => String(t.idTipoPlazoFijo) === idTipoPlazoFijo) ?? tipos[0]
  const tasaLabel = tasaLabelPara(tipoSeleccionado?.codigo)

  return (
    <>
      <div>
        <span className="field-label">Alias</span>
        <input
          type="text"
          className="field-input"
          value={fields.entidadFinanciera}
          placeholder="Ej: Banco Galicia"
          onChange={(e) => setFields((f) => ({ ...f, entidadFinanciera: e.target.value }))}
        />
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div>
          <span className="field-label">Tipo</span>
          <TipoField tipos={tipos} idTipoPlazoFijo={idTipoPlazoFijo} onChange={setIdTipoPlazoFijo} />
        </div>
        <div>
          <span className="field-label">Monto ({moneda})</span>
          <input
            type="number"
            className="field-input"
            value={fields.montoInvertido}
            placeholder="0"
            onChange={(e) => setFields((f) => ({ ...f, montoInvertido: e.target.value }))}
          />
        </div>
        <div>
          <span className="field-label">{tasaLabel} (ej: 0.42)</span>
          <input
            type="number"
            className="field-input"
            value={fields.tnaPactada}
            placeholder="0"
            onChange={(e) => setFields((f) => ({ ...f, tnaPactada: e.target.value }))}
          />
        </div>
        <div>
          <span className="field-label">Plazo (días)</span>
          <input
            type="number"
            min={1}
            className="field-input"
            value={fields.duracionDias}
            placeholder="180"
            onChange={(e) => setFields((f) => ({ ...f, duracionDias: e.target.value }))}
          />
        </div>
        <div>
          <span className="field-label">Fecha de inicio</span>
          <input
            type="date"
            min={hoyISO()}
            className="field-input"
            value={fields.fechaInicio}
            onChange={(e) => setFields((f) => ({ ...f, fechaInicio: e.target.value }))}
          />
        </div>
        <div className="flex items-center gap-1.5 pb-1">
          <input
            type="checkbox"
            id="reinvertir"
            checked={fields.reinvertirAlVencimiento}
            onChange={(e) => setFields((f) => ({ ...f, reinvertirAlVencimiento: e.target.checked }))}
            className="size-4 accent-navy-950"
          />
          <label htmlFor="reinvertir" className="text-[11px] text-ink-muted">
            Reinvertir al vencimiento
          </label>
        </div>
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
  const [idTipoPlazoFijo, setIdTipoPlazoFijo] = useState(String(tenencia.idTipoPlazoFijo))
  const [fields, setFields] = useState(() => plazoFijoFormFields(tenencia))
  const montoNum = Number(fields.montoInvertido)
  const tnaNum = Number(fields.tnaPactada)
  const duracionNum = Number(fields.duracionDias)
  const isValid =
    fields.entidadFinanciera.trim().length > 0 &&
    montoNum > 0 &&
    tnaNum >= 0 &&
    !!fields.fechaInicio &&
    duracionNum >= 1

  return (
    <div className="compare-card gap-2">
      <FormGrid
        moneda={moneda}
        tipos={tipos}
        idTipoPlazoFijo={idTipoPlazoFijo}
        setIdTipoPlazoFijo={setIdTipoPlazoFijo}
        fields={fields}
        setFields={setFields}
      />
      <RowFormFooter
        className="mt-0.5 flex justify-end gap-2"
        onCancel={onCancel}
        isMutating={isMutating}
        canSave={isValid}
        onSave={() =>
          onSave({
            entidadFinanciera: fields.entidadFinanciera,
            montoInvertido: montoNum,
            tnaPactada: tnaNum,
            fechaInicio: fields.fechaInicio,
            duracionDias: duracionNum,
            reinvertirAlVencimiento: fields.reinvertirAlVencimiento,
          })
        }
      />
    </div>
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
  const [idTipoPlazoFijo, setIdTipoPlazoFijo] = useState(String(tipos[0]?.idTipoPlazoFijo ?? ''))
  const [fields, setFields] = useState(() => plazoFijoFormFields())
  const montoNum = Number(fields.montoInvertido)
  const tnaNum = Number(fields.tnaPactada)
  const duracionNum = Number(fields.duracionDias)
  const isValid =
    !!idTipoPlazoFijo &&
    fields.entidadFinanciera.trim().length > 0 &&
    montoNum > 0 &&
    tnaNum >= 0 &&
    !!fields.fechaInicio &&
    duracionNum >= 1

  return (
    <div className="compare-card gap-2">
      <FormGrid
        moneda={moneda}
        tipos={tipos}
        idTipoPlazoFijo={idTipoPlazoFijo}
        setIdTipoPlazoFijo={setIdTipoPlazoFijo}
        fields={fields}
        setFields={setFields}
      />
      <RowFormFooter
        className="mt-0.5 flex justify-end gap-2"
        onCancel={onCancel}
        isMutating={isMutating}
        canSave={isValid}
        onSave={() =>
          onSave({
            idTipoPlazoFijo: Number(idTipoPlazoFijo),
            entidadFinanciera: fields.entidadFinanciera,
            montoInvertido: montoNum,
            tnaPactada: tnaNum,
            fechaInicio: fields.fechaInicio,
            duracionDias: duracionNum,
            reinvertirAlVencimiento: fields.reinvertirAlVencimiento,
          })
        }
      />
    </div>
  )
}
