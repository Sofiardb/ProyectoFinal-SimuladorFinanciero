import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

interface Props {
  active: boolean
  onClick: () => void
  children: ReactNode
  size?: 'sm' | 'md'
}

export default function PillButton({ active, onClick, children, size = 'md' }: Props) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'rounded-full font-semibold',
        size === 'sm' ? 'px-2.5 py-1 text-[11px]' : 'px-3 py-1 text-[11.5px]',
        active ? 'bg-navy-950 text-white' : 'border border-line bg-white text-ink-muted',
      )}
    >
      {children}
    </button>
  )
}
