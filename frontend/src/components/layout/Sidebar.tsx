import { NavLink, useNavigate } from 'react-router-dom'
import { LayoutDashboard, TrendingUp, History, LogOut, UserCog } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Separator } from '@/components/ui/separator'
import { useAuth } from '@/contexts/AuthContext'

const navItems = [
  { to: '/portfolios', icon: LayoutDashboard, label: 'Portfolios' },
  { to: '/simulaciones/nueva', icon: TrendingUp, label: 'Nueva simulación' },
  { to: '/simulaciones', icon: History, label: 'Historial' },
]

export default function Sidebar() {
  const { logout } = useAuth()
  const navigate = useNavigate()

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  return (
    <aside className="flex w-60 flex-col border-r border-sand-200 bg-white">
      <div className="flex h-16 items-center gap-2 px-6">
        <span className="text-lg font-semibold text-navy-950">InvestLab</span>
      </div>
      <Separator />
      <nav className="flex-1 space-y-1 p-3">
        {navItems.map(({ to, icon: Icon, label }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              cn(
                'flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors',
                isActive
                  ? 'bg-navy-950 text-white'
                  : 'text-muted-foreground hover:bg-sand-100 hover:text-navy-950',
              )
            }
          >
            <Icon size={16} />
            {label}
          </NavLink>
        ))}
      </nav>
      <Separator />
      <div className="space-y-1 p-3">
        <NavLink
          to="/perfil"
          className={({ isActive }) =>
            cn(
              'flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors',
              isActive
                ? 'bg-navy-950 text-white'
                : 'text-muted-foreground hover:bg-sand-100 hover:text-navy-950',
            )
          }
        >
          <UserCog size={16} />
          Mi perfil
        </NavLink>
        <button
          onClick={handleLogout}
          className="flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-sand-100 hover:text-navy-950"
        >
          <LogOut size={16} />
          Cerrar sesión
        </button>
      </div>
    </aside>
  )
}
