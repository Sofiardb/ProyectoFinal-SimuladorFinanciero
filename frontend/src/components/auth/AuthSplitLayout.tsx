import type { ReactNode } from 'react'
import Logo from '@/components/brand/Logo'
import TrendSparkline from '@/components/brand/TrendSparkline'
import { cn } from '@/lib/utils'

interface AuthSplitLayoutProps {
  headline: string
  body: string
  children: ReactNode
  /** Deja un margen visible debajo (no ocupa el 100% del viewport), para que el usuario note que hay contenido para scrollear. */
  compact?: boolean
}

export default function AuthSplitLayout({ headline, body, children, compact = false }: AuthSplitLayoutProps) {
  return (
    <div className={cn('flex flex-col lg:flex-row', compact ? 'min-h-[80vh]' : 'min-h-screen')}>
      <div className="flex flex-col justify-between gap-8 bg-navy-950 px-6 py-10 sm:px-10 lg:w-[46%] lg:gap-0 lg:px-14 lg:py-14">
        <Logo variant="light" />

        <div>
          <h1 className="max-w-md font-display text-3xl font-bold leading-tight text-white sm:text-4xl lg:text-[40px]">
            {headline}
          </h1>
          <p className="mt-4 max-w-sm text-sm leading-relaxed text-blue-100/70 lg:text-[15px]">
            {body}
          </p>
        </div>

        <TrendSparkline className="hidden h-[130px] lg:block" />
      </div>

      <div className="flex flex-1 items-center justify-center bg-[#fbfaf8] px-6 py-10 sm:px-10 lg:p-14">
        <div className="w-full max-w-[360px]">{children}</div>
      </div>
    </div>
  )
}
