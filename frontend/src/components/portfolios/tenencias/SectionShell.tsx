import type { ReactNode } from 'react'
import InfoTooltip from '@/components/portfolios/InfoTooltip'
import { FormattedErrorMessage } from '@/lib/formatErrorMessage'

interface Props {
  titulo:     string
  tooltip:    string
  addLabel:   string
  isAdding:   boolean
  onStartAdd: () => void
  error?:     string | null
  addRow:     ReactNode
  children:   ReactNode
}

/** Estructura común (título+tooltip, lista, botón de alta, banner de error) de las secciones de tenencias del detalle de portfolio. */
export default function SectionShell({ titulo, tooltip, addLabel, isAdding, onStartAdd, error, addRow, children }: Props) {
  return (
    <div>
      <div className="mb-3 flex items-center gap-1.5">
        <h3 className="font-display text-sm font-semibold text-navy-950">{titulo}</h3>
        <InfoTooltip term={titulo} definition={tooltip} />
      </div>

      <div className="flex flex-col gap-2">
        {children}

        {isAdding ? (
          addRow
        ) : (
          <button
            type="button"
            onClick={onStartAdd}
            className="mt-1 rounded-[9px] border-[1.5px] border-dashed border-line-dashed p-2.5 text-center text-xs font-semibold text-ink-soft transition-colors hover:border-navy-950 hover:text-navy-950"
          >
            {addLabel}
          </button>
        )}

        {error && (
          <div className="banner-danger">
            <FormattedErrorMessage text={error} />
          </div>
        )}
      </div>
    </div>
  )
}
