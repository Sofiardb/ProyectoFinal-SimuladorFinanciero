import { useState } from 'react'
import InfoTooltip from '@/components/portfolios/InfoTooltip'
import TruncatedText from '@/components/portfolios/TruncatedText'
import RowIconActions from '@/components/portfolios/tenencias/RowIconActions'
import RowFormFooter from '@/components/portfolios/tenencias/RowFormFooter'
import SectionShell from '@/components/portfolios/tenencias/SectionShell'
import { useEditableSectionState } from '@/hooks/useEditableSectionState'
import type { CampoPreview } from '@/lib/tenenciaDisplay'

export interface CatalogoOpcion {
  id:            number
  etiqueta:      string
  previewFields: CampoPreview[]
  precioActual:  number
}

export interface TenenciaItem {
  idCatalogo:      number
  titulo:          string
  subtitulo:       string
  previewFields:   CampoPreview[]
  /** Cantidad actualmente guardada (unidad "backend", p. ej. lotes de VN100 para bonos/letras). */
  cantidadActual:  number
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
  )
}

function EditExistingRow({
  tenencia,
  isMutating,
  onCancel,
  cantidadLabel,
  cantidadTooltip,
  onSave,
}: {
  tenencia: TenenciaItem
  isMutating: boolean
  onCancel: () => void
  cantidadLabel: string
  cantidadTooltip?: string
  onSave: (cantidad: number) => void
}) {
  const [cantidad, setCantidad] = useState(() => String(tenencia.cantidadActual))
  const cantidadNum = Number(cantidad)
  const canSave = cantidadNum > 0 && Number.isInteger(cantidadNum)

  return (
    <div className="flex flex-col gap-2.5 rounded-[9px] border border-compare-border bg-compare-bg p-3.5">
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
        <div>
          <span className="field-label inline-flex items-center gap-1">
            {cantidadLabel}
            {cantidadTooltip && <InfoTooltip term={cantidadLabel} definition={cantidadTooltip} />}
          </span>
          <input
            type="number"
            step="1"
            className="field-input"
            value={cantidad}
            placeholder="0"
            onChange={(e) => setCantidad(e.target.value)}
          />
          {cantidadNum > 0 && !Number.isInteger(cantidadNum) && (
            <p className="mt-1 text-[11px] text-danger">Tiene que ser un número entero.</p>
          )}
        </div>
      </div>
      <RowFormFooter onCancel={onCancel} isMutating={isMutating} canSave={canSave} onSave={() => onSave(cantidadNum)} />
    </div>
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
  onSave,
}: {
  pickLabel: string
  emptyMessage: string
  catalogo: CatalogoOpcion[]
  isMutating: boolean
  onCancel: () => void
  cantidadLabel: string
  cantidadTooltip?: string
  onSave: (idCatalogo: number, cantidad: number, precioCompra: number) => void
}) {
  const [selectedId, setSelectedId] = useState('')
  const [cantidad, setCantidad] = useState('')
  const selected = catalogo.find((c) => String(c.id) === selectedId)
  const cantidadNum = Number(cantidad)
  const canSave = !!selected && cantidadNum > 0 && Number.isInteger(cantidadNum)

  return (
    <div className="flex flex-col gap-2.5 rounded-[9px] border border-compare-border bg-compare-bg p-3.5">
      {catalogo.length === 0 ? (
        <div className="banner-warning">
          {emptyMessage}
        </div>
      ) : (
        <div>
          <span className="field-label">{pickLabel}</span>
          <select
            className="field-input"
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
              <span className="field-label inline-flex items-center gap-1">
                {f.label}
                {f.tooltip && <InfoTooltip term={f.label} definition={f.tooltip} />}
              </span>
              <div className="readonly-chip">{f.value}</div>
            </div>
          ))}
          <div>
            <span className="field-label inline-flex items-center gap-1">
              {cantidadLabel}
              {cantidadTooltip && <InfoTooltip term={cantidadLabel} definition={cantidadTooltip} />}
            </span>
            <input
              type="number"
              step="1"
              className="field-input"
              value={cantidad}
              placeholder="0"
              onChange={(e) => setCantidad(e.target.value)}
            />
            {cantidadNum > 0 && !Number.isInteger(cantidadNum) && (
              <p className="mt-1 text-[11px] text-danger">Tiene que ser un número entero.</p>
            )}
          </div>
        </div>
      )}

      <RowFormFooter
        onCancel={onCancel}
        isMutating={isMutating}
        canSave={canSave}
        onSave={() => selected && onSave(selected.id, cantidadNum, selected.precioActual)}
      />
    </div>
  )
}
