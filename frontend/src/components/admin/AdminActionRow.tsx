import type { ReactNode } from 'react'

export const resultText = 'text-[12.5px] leading-normal text-ink-muted'

export default function AdminActionRow({
  onClick,
  isPending,
  label,
  pendingLabel,
  helperText,
  result,
}: {
  onClick: () => void
  isPending: boolean
  label: string
  pendingLabel: string
  helperText?: string
  result?: ReactNode
}) {
  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-3">
        <button type="button" onClick={onClick} disabled={isPending} className="btn-primary w-fit">
          {isPending ? pendingLabel : label}
        </button>
        {helperText && <span className="text-[11.5px] text-ink-soft">{helperText}</span>}
      </div>
      {result}
    </div>
  )
}
