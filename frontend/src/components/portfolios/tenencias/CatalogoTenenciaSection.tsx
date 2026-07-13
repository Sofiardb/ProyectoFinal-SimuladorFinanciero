import { useState } from 'react'
import InfoTooltip from '@/components/portfolios/InfoTooltip'
import type { CampoPreview } from '@/lib/tenenciaDisplay'

export interface CatalogoOpcion {
  id:            number
  etiqueta:      string
  previewFields: CampoPreview[]
  precioActual:  number
}

export interface TenenciaItem {
  idCatalogo:    number
  titulo:        string
  subtitulo:     string
  previewFields: CampoPreview[]
}

interface Props {
  titulo:        string
  tooltip:       string
  pickLabel:     string
  addLabel:      string
  emptyMessage:  string
  tenencias:     TenenciaItem[]
  catalogo:      CatalogoOpcion[]
  isMutating:    boolean
  onAdd:    (idCatalogo: number, cantidad: number, precioCompra: number) => void
  onUpdate: (idCatalogo: number, cantidad: number) => void
  onDelete: (idCatalogo: number) => void
}

const fieldLabel = 'mb-1 block text-[11px] text-ink-muted'
const fieldInput =
  'h-9 w-full rounded-[7px] border-[1.5px] border-field-border bg-white px-2.5 text-[12.5px] text-navy-950 outline-none focus:border-blue-brand'
const readonlyChip = 'flex h-9 items-center rounded-[7px] bg-line-soft px-2.5 text-[12.5px] text-ink-muted'
const cancelBtn =
  'h-8 rounded-md border border-field-border bg-transparent px-3 text-xs font-semibold text-ink-muted'

export default function CatalogoTenenciaSection({
  titulo,
  tooltip,
  pickLabel,
  addLabel,
  emptyMessage,
  tenencias,
  catalogo,
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
          editingId === t.idCatalogo ? (
            <EditExistingRow
              key={t.idCatalogo}
              tenencia={t}
              isMutating={isMutating}
              onCancel={() => setEditingId(null)}
              onSave={(cantidad) => {
                onUpdate(t.idCatalogo, cantidad)
                setEditingId(null)
              }}
            />
          ) : (
            <ViewRow
              key={t.idCatalogo}
              tenencia={t}
              onEdit={() => setEditingId(t.idCatalogo)}
              onDelete={() => onDelete(t.idCatalogo)}
            />
          ),
        )}

        {isAdding ? (
          <AddRow
            pickLabel={pickLabel}
            emptyMessage={emptyMessage}
            catalogo={catalogo}
            isMutating={isMutating}
            onCancel={() => setIsAdding(false)}
            onSave={(idCatalogo, cantidad, precioCompra) => {
              onAdd(idCatalogo, cantidad, precioCompra)
              setIsAdding(false)
            }}
          />
        ) : (
          <button
            type="button"
            onClick={() => setIsAdding(true)}
            className="mt-1 rounded-[9px] border-[1.5px] border-dashed border-line-dashed p-2.5 text-center text-xs font-semibold text-ink-soft transition-colors hover:border-navy-950 hover:text-navy-950"
          >
            {addLabel}
          </button>
        )}
      </div>
    </div>
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
    <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2 rounded-[9px] bg-chip px-3.5 py-3">
      <div className="min-w-0 flex-1 basis-32">
        <p className="truncate text-[13.5px] leading-tight font-semibold text-navy-950">{tenencia.titulo}</p>
        <p className="mt-[3px] truncate text-[11.5px] leading-tight text-ink-soft">{tenencia.subtitulo}</p>
      </div>
      <div className="flex shrink-0 gap-[18px]">
        {tenencia.previewFields.map((f) => (
          <div key={f.label} className="text-right">
            <p className="text-[9.5px] tracking-[0.3px] text-ink-soft uppercase">{f.label}</p>
            <p className="mt-0.5 text-[12.5px] font-semibold text-navy-950">{f.value}</p>
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

function EditExistingRow({
  tenencia,
  isMutating,
  onCancel,
  onSave,
}: {
  tenencia: TenenciaItem
  isMutating: boolean
  onCancel: () => void
  onSave: (cantidad: number) => void
}) {
  const [cantidad, setCantidad] = useState('')
  const cantidadNum = Number(cantidad)
  const canSave = cantidadNum > 0

  return (
    <div className="flex flex-col gap-2.5 rounded-[9px] border border-compare-border bg-compare-bg p-3.5">
      <div className="grid grid-cols-2 gap-2">
        {tenencia.previewFields.map((f) => (
          <div key={f.label}>
            <span className={fieldLabel}>{f.label}</span>
            <div className={readonlyChip}>{f.value}</div>
          </div>
        ))}
        <div>
          <span className={fieldLabel}>Cantidad</span>
          <input
            type="number"
            className={fieldInput}
            value={cantidad}
            placeholder="0"
            onChange={(e) => setCantidad(e.target.value)}
          />
        </div>
      </div>
      <div className="flex justify-end gap-2">
        <button type="button" className={cancelBtn} onClick={onCancel}>
          Cancelar
        </button>
        <button
          type="button"
          disabled={!canSave || isMutating}
          onClick={() => onSave(cantidadNum)}
          className={
            canSave
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
  pickLabel,
  emptyMessage,
  catalogo,
  isMutating,
  onCancel,
  onSave,
}: {
  pickLabel: string
  emptyMessage: string
  catalogo: CatalogoOpcion[]
  isMutating: boolean
  onCancel: () => void
  onSave: (idCatalogo: number, cantidad: number, precioCompra: number) => void
}) {
  const [selectedId, setSelectedId] = useState('')
  const [cantidad, setCantidad] = useState('')
  const selected = catalogo.find((c) => String(c.id) === selectedId)
  const cantidadNum = Number(cantidad)
  const canSave = !!selected && cantidadNum > 0

  return (
    <div className="flex flex-col gap-2.5 rounded-[9px] border border-compare-border bg-compare-bg p-3.5">
      {catalogo.length === 0 ? (
        <div className="rounded-lg border border-warning-border bg-warning-bg px-3 py-2.5 text-[12.5px] leading-normal text-warning-title">
          {emptyMessage}
        </div>
      ) : (
        <div>
          <span className={fieldLabel}>{pickLabel}</span>
          <select
            className={fieldInput}
            value={selectedId}
            onChange={(e) => {
              setSelectedId(e.target.value)
              setCantidad('')
            }}
          >
            <option value="">Seleccionar…</option>
            {catalogo.map((c) => (
              <option key={c.id} value={c.id}>
                {c.etiqueta}
              </option>
            ))}
          </select>
        </div>
      )}

      {selected && (
        <div className="grid grid-cols-2 gap-2">
          {selected.previewFields.map((f) => (
            <div key={f.label}>
              <span className={fieldLabel}>{f.label}</span>
              <div className={readonlyChip}>{f.value}</div>
            </div>
          ))}
          <div>
            <span className={fieldLabel}>Cantidad</span>
            <input
              type="number"
              className={fieldInput}
              value={cantidad}
              placeholder="0"
              onChange={(e) => setCantidad(e.target.value)}
            />
          </div>
        </div>
      )}

      <div className="flex justify-end gap-2">
        <button type="button" className={cancelBtn} onClick={onCancel}>
          Cancelar
        </button>
        <button
          type="button"
          disabled={!canSave || isMutating}
          onClick={() => selected && onSave(selected.id, cantidadNum, selected.precioActual)}
          className={
            canSave
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
