import { NavLink } from 'react-router-dom'
import { cn } from '@/lib/utils'

/** /simulaciones/nueva no debe marcar el tab "Historial" — se llega ahí desde el botón aparte, no navegando el historial. */
function isNavItemActive(pathname: string, to: string): boolean {
  if (to === '/simulaciones') {
    return pathname === '/simulaciones' || (pathname.startsWith('/simulaciones/') && pathname !== '/simulaciones/nueva')
  }
  return pathname === to || pathname.startsWith(`${to}/`)
}

interface Props {
  items: { to: string; label: string }[]
  pathname: string
  variant: 'desktop' | 'mobile'
  onNavigate?: () => void
}

export default function NavLinks({ items, pathname, variant, onNavigate }: Props) {
  return (
    <>
      {items.map(({ to, label }) => {
        const activo = isNavItemActive(pathname, to)
        return (
          <NavLink
            key={to}
            to={to}
            data-tour={to === '/simulaciones' ? 'tour-historial-nav' : undefined}
            onClick={onNavigate}
            className={cn(
              variant === 'desktop'
                ? 'flex h-full items-center border-b-2 text-sm font-medium transition-colors'
                : 'rounded-md px-3 py-2 text-sm font-medium transition-colors',
              variant === 'desktop'
                ? activo
                  ? 'border-navy-950 font-semibold text-navy-950'
                  : 'border-transparent text-muted-foreground hover:text-navy-950'
                : activo
                  ? 'bg-navy-950 text-white'
                  : 'text-muted-foreground hover:bg-sand-100 hover:text-navy-950',
            )}
          >
            {label}
          </NavLink>
        )
      })}
    </>
  )
}
