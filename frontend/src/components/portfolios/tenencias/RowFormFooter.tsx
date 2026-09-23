import { Loader2Icon } from 'lucide-react'

interface Props {
  onCancel:   () => void
  onSave:     () => void
  canSave:    boolean
  isMutating: boolean
  saveLabel?: string
  className?: string
}

/** Par de botones Cancelar/Guardar de las filas de edición y alta de tenencias. */
export default function RowFormFooter({
  onCancel,
  onSave,
  canSave,
  isMutating,
  saveLabel = 'Guardar',
  className = 'flex justify-end gap-2',
}: Props) {
  return (
    <div className={className}>
      <button type="button" className="btn-cancel-sm" onClick={onCancel}>
        Cancelar
      </button>
      <button
        type="button"
        disabled={!canSave || isMutating}
        onClick={onSave}
        className={`inline-flex items-center gap-1.5 ${canSave ? 'btn-save-sm' : 'btn-save-sm-disabled'} ${isMutating ? 'cursor-wait opacity-80' : ''}`}
      >
        {isMutating && <Loader2Icon className="size-3.5 animate-spin" />}
        {isMutating ? 'Guardando…' : saveLabel}
      </button>
    </div>
  )
}
