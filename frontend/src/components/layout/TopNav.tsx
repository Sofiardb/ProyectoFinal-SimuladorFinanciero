import { useState } from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
import { Menu, TrendingUp, UserCog, LogOut, ChevronDown } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import Logo from '@/components/brand/Logo'
import { useAuth } from '@/contexts/AuthContext'

const baseNavItems = [
  { to: '/bienvenida', label: 'Inicio' },
  { to: '/portfolios', label: 'Portfolios' },
  { to: '/simulaciones', label: 'Historial' },
]

function iniciales(nombre?: string, apellido?: string, username?: string): string {
  if (nombre) return (nombre[0] + (apellido?.[0] ?? '')).toUpperCase()
  return (username ?? '?').slice(0, 2).toUpperCase()
}

export default function TopNav() {
  const { usuario, logout } = useAuth()
  const navigate = useNavigate()
  const [mobileOpen, setMobileOpen] = useState(false)

  const navItems = usuario?.esAdmin
    ? [...baseNavItems, { to: '/admin', label: 'Admin' }]
    : baseNavItems

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  const nombreCompleto = usuario?.nombre
    ? `${usuario.nombre} ${usuario.apellido ?? ''}`.trim()
    : usuario?.username

  return (
    <header className="sticky top-0 z-30 h-16 shrink-0 border-b border-sand-200 bg-white">
      <div className="mx-auto flex h-full max-w-6xl items-center justify-between px-4 sm:px-6 lg:px-8">
        <div className="flex h-full items-center gap-8">
          <NavLink to="/bienvenida" className="shrink-0">
            <Logo />
          </NavLink>

          <nav className="hidden h-full items-center gap-6 md:flex">
            {navItems.map(({ to, label }) => (
              <NavLink
                key={to}
                to={to}
                className={({ isActive }) =>
                  cn(
                    'flex h-full items-center border-b-2 text-sm font-medium transition-colors',
                    isActive
                      ? 'border-navy-950 font-semibold text-navy-950'
                      : 'border-transparent text-muted-foreground hover:text-navy-950',
                  )
                }
              >
                {label}
              </NavLink>
            ))}
          </nav>
        </div>

        <div className="hidden items-center gap-3.5 md:flex">
          <Button
            variant="outline"
            onClick={() => navigate('/simulaciones/nueva')}
            className="h-[38px] shrink-0 rounded-lg border-[1.5px] border-navy-950 bg-transparent px-4 text-[13.5px] font-semibold text-navy-950 hover:bg-navy-950/5"
          >
            <TrendingUp size={14} />
            Nueva simulación
          </Button>

          <DropdownMenu>
            <DropdownMenuTrigger className="flex items-center gap-2 rounded-full bg-sand-50 py-1 pr-2.5 pl-1 outline-none">
              <Avatar size="sm">
                <AvatarFallback className="bg-navy-950 text-white">
                  {iniciales(usuario?.nombre, usuario?.apellido, usuario?.username)}
                </AvatarFallback>
              </Avatar>
              <span className="max-w-28 truncate text-sm font-semibold text-navy-950">
                {usuario?.nombre || usuario?.username}
              </span>
              <ChevronDown size={12} className="text-muted-foreground" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <div className="px-2 py-1.5">
                <p className="text-sm font-semibold text-navy-950">{nombreCompleto}</p>
                <p className="mt-0.5 truncate text-xs font-normal text-muted-foreground">
                  {usuario?.email}
                </p>
              </div>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => navigate('/perfil')}>
                <UserCog size={14} />
                Actualizar mis datos
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem variant="destructive" onClick={handleLogout}>
                <LogOut size={14} />
                Cerrar sesión
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        <button
          type="button"
          aria-label="Abrir menú"
          onClick={() => setMobileOpen(true)}
          className="flex items-center justify-center rounded-md p-2 text-navy-950 md:hidden"
        >
          <Menu size={22} />
        </button>
      </div>

      <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
        <SheetContent side="right" className="w-72">
          <SheetHeader>
            <SheetTitle>
              <Logo />
            </SheetTitle>
          </SheetHeader>

          <div className="flex flex-col gap-1 px-4">
            {navItems.map(({ to, label }) => (
              <NavLink
                key={to}
                to={to}
                onClick={() => setMobileOpen(false)}
                className={({ isActive }) =>
                  cn(
                    'rounded-md px-3 py-2 text-sm font-medium transition-colors',
                    isActive
                      ? 'bg-navy-950 text-white'
                      : 'text-muted-foreground hover:bg-sand-100 hover:text-navy-950',
                  )
                }
              >
                {label}
              </NavLink>
            ))}
            <Button
              variant="outline"
              className="mt-2 justify-start"
              onClick={() => {
                setMobileOpen(false)
                navigate('/simulaciones/nueva')
              }}
            >
              <TrendingUp size={14} />
              Nueva simulación
            </Button>
          </div>

          <Separator className="my-1" />

          <div className="flex flex-col gap-1 px-4">
            <p className="px-3 text-xs text-muted-foreground">{usuario?.email}</p>
            <button
              onClick={() => {
                setMobileOpen(false)
                navigate('/perfil')
              }}
              className="flex items-center gap-2.5 rounded-md px-3 py-2 text-left text-sm text-muted-foreground transition-colors hover:bg-sand-100 hover:text-navy-950"
            >
              <UserCog size={14} />
              Actualizar mis datos
            </button>
            <button
              onClick={() => {
                setMobileOpen(false)
                handleLogout()
              }}
              className="flex items-center gap-2.5 rounded-md px-3 py-2 text-left text-sm text-desfavorable transition-colors hover:bg-desfavorable/10"
            >
              <LogOut size={14} />
              Cerrar sesión
            </button>
          </div>
        </SheetContent>
      </Sheet>
    </header>
  )
}
