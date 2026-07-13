import { useState } from 'react'
import InfoTooltip from '@/components/portfolios/InfoTooltip'
import { formatPorcentaje } from '@/lib/format'
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
  titulo:       string
  tooltip:      string
  moneda:       string
  tenencias:    PortfolioPlazoFijo[]
  tipos:        TipoPlazoFijo[]
  isMutating:   boolean
  onAdd:    (payload: NuevoPlazoFijo) => void
  onUpdate: (idPortfolioPlazoFijo: number, payload: EditarPlazoFijo) => void
  onDelete: (idPortfolioPlazoFijo: number) => void
}

const fieldLabel = 'mb-1 block text-[11px] text-ink-muted'
const fieldInput =
  'h-9 w-full rounded-[7px] border-[1.5px] border-field-border bg-white px-2.5 text-[12.5px] text-navy-950 outline-none focus:border-blue-brand'
const readonlyChip = 'flex h-9 items-center rounded-[7px] bg-line-soft px-2.5 text-[12.5px] text-ink-muted'
const cancelBtn =
  'h-8 rounded-md border border-field-border bg-transparent px-3 text-xs font-semibold text-ink-muted'

function tasaLabelPara(codigoTipo: string | undefined): string {
  return codigoTipo === 'UVA' ? 'Tasa real' : 'TNA'
}

export default function PlazoFijoSection({
  titulo,
  tooltip,
  moneda,
  tenencias,
  tipos,
  isMutating,
  onAdd,
  onUpdate,
  onDelete,
}: Props) {
  const [editingId, setEditingId] = useState<number | null>(null)
  const [isAdding, setIsAdding] = useState(false)

  return (
    <div>
      <div className="mb-3 flex items-center gap-1.5">
        <h3 className="font-display text-sm font-semibold text-navy-950">{titulo}</h3>
        <InfoTooltip term={titulo} definition={tooltip} />
      </div>

      <div className="flex flex-col gap-2">
        {tenencias.map((t) =>
          editingId === t.idPortfolioPlazoFijo ? (
            <EditRow
              key={t.idPortfolioPlazoFijo}
              tenencia={t}
              moneda={moneda}
              tipos={tipos}
              isMutating={isMutating}
              onCancel={() => setEditingId(null)}
              onSave={(payload) => {
                onUpdate(t.idPortfolioPlazoFijo, payload)
                setEditingId(null)
              }}
            />
          ) : (
            <ViewRow
              key={t.idPortfolioPlazoFijo}
              tenencia={t}
              moneda={moneda}
              onEdit={() => setEditingId(t.idPortfolioPlazoFijo)}
              onDelete={() => onDelete(t.idPortfolioPlazoFijo)}
            />
          ),
        )}

        {isAdding ? (
          <AddRow
            moneda={moneda}
            tipos={tipos}
            isMutating={isMutating}
            onCancel={() => setIsAdding(false)}
            onSave={(payload) => {
              onAdd(payload)
              setIsAdding(false)
            }}
          />
        ) : (
          <button
            type="button"
            onClick={() => setIsAdding(true)}
            className="mt-1 rounded-[9px] border-[1.5px] border-dashed border-line-dashed p-2.5 text-center text-xs font-semibold text-ink-soft transition-colors hover:border-navy-950 hover:text-navy-950"
          >
            + Agregar plazo fijo
          </button>
        )}
      </div>
    </div>
  )
}

function ViewRow({
  tenencia,
  moneda,
  onEdit,
  onDelete,
}: {
  tenencia: PortfolioPlazoFijo
  moneda: string
  onEdit: () => void
  onDelete: () => void
}) {
  const tasaLabel = tasaLabelPara(tenencia.nombreTipoPlazoFijo === 'Plazo fijo UVA' ? 'UVA' : undefined)
  const stats = [
    { label: 'Monto', value: `${moneda} ${tenencia.montoInvertido}` },
    { label: tasaLabel, value: `${formatPorcentaje(tenencia.tnaPactada * 100)}` },
    { label: 'Plazo', value: `${tenencia.duracionDias} días` },
  ]

  return (
    <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2 rounded-[9px] bg-chip px-3.5 py-3">
      <div className="min-w-0 flex-1 basis-32">
        <p className="truncate text-[13.5px] leading-tight font-semibold text-navy-950">
          {tenencia.entidadFinanciera}
        </p>
        <p className="mt-[3px] truncate text-[11.5px] leading-tight text-ink-soft">
          {tenencia.nombreTipoPlazoFijo}
        </p>
      </div>
      <div className="flex shrink-0 gap-[18px]">
        {stats.map((s) => (
          <div key={s.label} className="text-right">
            <p className="text-[9.5px] tracking-[0.3px] text-ink-soft uppercase">{s.label}</p>
            <p className="mt-0.5 text-[12.5px] font-semibold text-navy-950">{s.value}</p>
          </div>
        ))}
      </div>
      <div className="flex shrink-0 gap-0.5">
        <button
          type="button"
          onClick={onEdit}
          aria-label="Modificar"
          className="flex items-center justify-center rounded-md p-[5px] text-ink-muted transition-colors hover:bg-line-soft"
        >
          <svg viewBox="0 0 24 24" className="size-4">
            <path
              d="M4 20l3.5-1L18 8.5a1.8 1.8 0 000-2.5l-.5-.5a1.8 1.8 0 00-2.5 0L4.5 16 4 20z"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.6"
              strokeLinejoin="round"
            />
          </svg>
        </button>
        <button
          type="button"
          onClick={onDelete}
          aria-label="Eliminar"
          className="flex items-center justify-center rounded-md p-[5px] text-danger transition-colors hover:bg-line-soft"
        >
          <svg viewBox="0 0 24 24" className="size-4">
            <path
              d="M5 7h14M9 7V5a1 1 0 011-1h4a1 1 0 011 1v2m2 0l-1 13a1 1 0 01-1 1H8a1 1 0 01-1-1L6 7"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.6"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </button>
      </div>
    </div>
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
    return <div className={readonlyChip}>{tipos[0]?.nombre ?? '—'}</div>
  }
  return (
    <select className={fieldInput} value={idTipoPlazoFijo} onChange={(e) => onChange(e.target.value)}>
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
        <span className={fieldLabel}>Alias</span>
        <input
          type="text"
          className={fieldInput}
          value={fields.entidadFinanciera}
          placeholder="Ej: Banco Galicia"
          onChange={(e) => setFields((f) => ({ ...f, entidadFinanciera: e.target.value }))}
        />
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div>
          <span className={fieldLabel}>Tipo</span>
          <TipoField tipos={tipos} idTipoPlazoFijo={idTipoPlazoFijo} onChange={setIdTipoPlazoFijo} />
        </div>
        <div>
          <span className={fieldLabel}>Monto ({moneda})</span>
          <input
            type="number"
            className={fieldInput}
            value={fields.montoInvertido}
            placeholder="0"
            onChange={(e) => setFields((f) => ({ ...f, montoInvertido: e.target.value }))}
          />
        </div>
        <div>
          <span className={fieldLabel}>{tasaLabel} (ej: 0.42)</span>
          <input
            type="number"
            className={fieldInput}
            value={fields.tnaPactada}
            placeholder="0"
            onChange={(e) => setFields((f) => ({ ...f, tnaPactada: e.target.value }))}
          />
        </div>
        <div>
          <span className={fieldLabel}>Plazo (días)</span>
          <input
            type="number"
            min={1}
            className={fieldInput}
            value={fields.duracionDias}
            placeholder="180"
            onChange={(e) => setFields((f) => ({ ...f, duracionDias: e.target.value }))}
          />
        </div>
        <div>
          <span className={fieldLabel}>Fecha de inicio</span>
          <input
            type="date"
            className={fieldInput}
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
    <div className="flex flex-col gap-2 rounded-[9px] border border-compare-border bg-compare-bg p-3.5">
      <FormGrid
        moneda={moneda}
        tipos={tipos}
        idTipoPlazoFijo={idTipoPlazoFijo}
        setIdTipoPlazoFijo={setIdTipoPlazoFijo}
        fields={fields}
        setFields={setFields}
      />
      <div className="mt-0.5 flex justify-end gap-2">
        <button type="button" className={cancelBtn} onClick={onCancel}>
          Cancelar
        </button>
        <button
          type="button"
          disabled={!isValid || isMutating}
          onClick={() =>
            onSave({
              entidadFinanciera: fields.entidadFinanciera,
              montoInvertido: montoNum,
              tnaPactada: tnaNum,
              fechaInicio: fields.fechaInicio,
              duracionDias: duracionNum,
              reinvertirAlVencimiento: fields.reinvertirAlVencimiento,
            })
          }
          className={
            isValid
              ? 'h-8 rounded-md bg-navy-950 px-3 text-xs font-semibold text-white'
              : 'h-8 cursor-not-allowed rounded-md bg-line px-3 text-xs font-semibold text-ink-soft'
          }
        >
          Guardar
        </button>
      </div>
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
    <div className="flex flex-col gap-2 rounded-[9px] border border-compare-border bg-compare-bg p-3.5">
      <FormGrid
        moneda={moneda}
        tipos={tipos}
        idTipoPlazoFijo={idTipoPlazoFijo}
        setIdTipoPlazoFijo={setIdTipoPlazoFijo}
        fields={fields}
        setFields={setFields}
      />
      <div className="mt-0.5 flex justify-end gap-2">
        <button type="button" className={cancelBtn} onClick={onCancel}>
          Cancelar
        </button>
        <button
          type="button"
          disabled={!isValid || isMutating}
          onClick={() =>
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
          className={
            isValid
              ? 'h-8 rounded-md bg-navy-950 px-3 text-xs font-semibold text-white'
              : 'h-8 cursor-not-allowed rounded-md bg-line px-3 text-xs font-semibold text-ink-soft'
          }
        >
          Guardar
        </button>
      </div>
    </div>
  )
}
