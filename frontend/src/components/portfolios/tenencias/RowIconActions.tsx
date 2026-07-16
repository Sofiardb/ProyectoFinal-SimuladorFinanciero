interface Props {
  onEdit:   () => void
  onDelete: () => void
}

/** Botones de editar/eliminar de una fila de tenencia, compartidos entre las secciones de catálogo y plazo fijo. */
export default function RowIconActions({ onEdit, onDelete }: Props) {
  return (
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
  )
}
