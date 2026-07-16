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
        className={canSave ? 'btn-save-sm' : 'btn-save-sm-disabled'}
      >
        {saveLabel}
      </button>
    </div>
  )
}
