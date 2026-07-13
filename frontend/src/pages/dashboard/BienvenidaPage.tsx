import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowRight, LayoutDashboard, TrendingUp, History } from 'lucide-react'
import { Card, CardContent, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import CreateEditPortfolioDialog from '@/components/portfolios/CreateEditPortfolioDialog'
import { usePortfolios } from '@/api/hooks'
import { useAuth } from '@/contexts/AuthContext'
import { cn } from '@/lib/utils'

const ACCIONES = [
  {
    to: '/portfolios',
    icon: LayoutDashboard,
    titulo: 'Mis portfolios',
    descripcion: 'Ver, crear y editar tus carteras por perfil de riesgo.',
    destacada: true,
  },
  {
    to: '/simulaciones/nueva',
    icon: TrendingUp,
    titulo: 'Nueva simulación',
    descripcion: 'Elegí un portfolio y proyectá su evolución.',
    destacada: false,
  },
  {
    to: '/simulaciones',
    icon: History,
    titulo: 'Historial',
    descripcion: 'Consultá simulaciones pasadas sin volver a correrlas.',
    destacada: false,
  },
]

export default function BienvenidaPage() {
  const navigate = useNavigate()
  const { usuario } = useAuth()
  const { data: portfolios } = usePortfolios()
  const [createOpen, setCreateOpen] = useState(false)

  const cantidadPortfolios = portfolios?.length ?? 0
  const tienePortfolios = cantidadPortfolios > 0
  const sinPortfolios = portfolios?.length === 0

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6 sm:py-10 lg:px-8">
      <h1 className="font-display text-2xl font-semibold text-navy-950">
        Hola, {usuario?.nombre || usuario?.username}
      </h1>
      <p className="mt-1 max-w-xl text-sm text-muted-foreground">
        Este es tu espacio para simular decisiones de inversión sin arriesgar capital real.
        Armá portfolios, corré escenarios de Monte Carlo y revisá cómo evolucionarían en el
        tiempo.
      </p>

      <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-3">
        {ACCIONES.map(({ to, icon: Icon, titulo, descripcion, destacada }) => (
          <button
            key={to}
            onClick={() => navigate(to)}
            className={cn(
              'rounded-xl p-5 text-left transition-transform hover:-translate-y-0.5',
              destacada
                ? 'bg-navy-950 text-white'
                : 'bg-white text-navy-950 ring-1 ring-sand-200',
            )}
          >
            <Icon size={20} className={destacada ? 'text-green-brand' : 'text-blue-brand'} />
            <p className="mt-3 font-display text-base font-semibold">{titulo}</p>
            <p
              className={cn(
                'mt-1 text-sm',
                destacada ? 'text-white/70' : 'text-muted-foreground',
              )}
            >
              {descripcion}
            </p>
          </button>
        ))}
      </div>

      {tienePortfolios && (
        <Card className="mt-8">
          <CardContent className="flex flex-col items-center gap-3 py-8 text-center sm:flex-row sm:items-center sm:justify-between sm:text-left">
            <div>
              <CardTitle>
                Ya tenés {cantidadPortfolios} {cantidadPortfolios === 1 ? 'portfolio armado' : 'portfolios armados'}
              </CardTitle>
              <CardDescription className="mt-1">
                Seguí gestionando tus carteras o corré una nueva simulación.
              </CardDescription>
            </div>
            <Button
              className="shrink-0 bg-navy-950 text-white hover:bg-navy-900"
              onClick={() => navigate('/portfolios')}
            >
              Ver mis portfolios
              <ArrowRight size={14} />
            </Button>
          </CardContent>
        </Card>
      )}

      {sinPortfolios && (
        <Card className="mt-8">
          <CardContent className="flex flex-col items-center gap-3 py-8 text-center">
            <CardTitle>Todavía no creaste ningún portfolio</CardTitle>
            <CardDescription>
              Empezá eligiendo un perfil de riesgo — conservador, moderado o agresivo.
            </CardDescription>
            <Button
              className="mt-1 bg-navy-950 text-white hover:bg-navy-900"
              onClick={() => setCreateOpen(true)}
            >
              Crear mi primer portfolio
            </Button>
          </CardContent>
        </Card>
      )}

      <CreateEditPortfolioDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
      />
    </div>
  )
}
