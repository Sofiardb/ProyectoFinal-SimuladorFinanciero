import { useState, type ReactNode } from 'react'
import { cn } from '@/lib/utils'


export default function DisabledButtonTooltip({
  title,
  className,
  children,
}: {
  title?: string
  className?: string
  children: ReactNode
}) {
  const [open, setOpen] = useState(false)

  if (!title) return <>{children}</>

  return (
    <span
      className={cn('relative inline-flex cursor-not-allowed', className)}
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
    >
      {children}
      {open && (
        <span className="pointer-events-none absolute top-[calc(100%+8px)] right-0 z-40 w-max max-w-60 rounded-[9px] bg-navy-950 px-3 py-2 text-left text-xs leading-[1.5] text-white shadow-[0_8px_20px_rgba(15,39,64,0.25)]">
          {title}
        </span>
      )}
    </span>
  )
}
