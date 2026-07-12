import { cn } from '@/lib/utils'

interface LogoProps {
  variant?: 'light' | 'dark'
  className?: string
}

export default function Logo({ variant = 'dark', className }: LogoProps) {
  const textColor = variant === 'light' ? 'text-white' : 'text-navy-950'

  return (
    <div className={cn('flex items-center gap-2.5', className)}>
      <svg viewBox="0 0 80 56" className="h-5 w-7 shrink-0" aria-hidden="true">
        <path
          d="M40 10 L64 22 L40 34 L16 22 Z"
          fill="none"
          stroke="var(--color-green-brand)"
          strokeWidth="4"
          strokeLinejoin="round"
        />
        <path
          d="M25 26 L25 38 Q25 44 40 44 Q55 44 55 38 L55 26"
          fill="none"
          stroke="var(--color-blue-brand)"
          strokeWidth="3.5"
        />
        <line
          x1="64" y1="22" x2="64" y2="34"
          stroke="var(--color-green-brand)"
          strokeWidth="3.5"
          strokeLinecap="round"
        />
      </svg>
      <span className={cn('font-display text-lg font-semibold tracking-tight', textColor)}>
        InvestLab
      </span>
    </div>
  )
}
