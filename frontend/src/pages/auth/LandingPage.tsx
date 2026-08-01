
import { Navigate, useNavigate } from 'react-router-dom'
import { Wallet, Layers, Dices, LineChart, ChevronDown } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import AuthSplitLayout from '@/components/auth/AuthSplitLayout'
import { useAuth } from '@/contexts/AuthContext'

const PASOS = [
  {
    icon: Wallet,
    titulo: 'Armá un portfolio',
    descripcion:
      'Creá una cartera y elegí un perfil de riesgo: conservador, moderado o agresivo.',
  },
  {
    icon: Layers,
    titulo: 'Sumá instrumentos',
    descripcion:
      'Agregá acciones, bonos, letras del Tesoro o plazos fijos según el perfil elegido.',
  },
  {
    icon: Dices,
    titulo: 'Corré una simulación',
    descripcion:
      'El motor proyecta 1.000 trayectorias posibles con Monte Carlo, por escenario económico: favorable, moderado y desfavorable.',
  },
  {
    icon: LineChart,
    titulo: 'Analizá los resultados',
    descripcion:
      'Mirá cómo evolucionaría tu patrimonio en cada escenario y comparalo contra la inflación proyectada.',
  },
]

export default function LandingPage() {
  const { isAuthenticated } = useAuth()
  const navigate = useNavigate()

  if (isAuthenticated) return <Navigate to="/bienvenida" replace />

  return (
    <div>
      <AuthSplitLayout
        headline="Practicá tus decisiones antes de invertir un peso"
        body="Un laboratorio para entender tu plata: simulá portfolios sobre escenarios reales de inflación y mercado. Es una herramienta educativa — no es asesoramiento financiero ni recomendación de inversión."
      >
        <h2 className="mb-1.5 font-display text-xl font-semibold text-navy-950 sm:text-2xl">
          Bienvenido a InvestLab
        </h2>
        <p className="mb-8 text-sm text-muted-foreground">
          Accedé para armar y simular tus propios portfolios.
        </p>

        

        <div className="space-y-3">
          <Button
            size="lg"
            className="h-[52px] w-full bg-navy-950 text-base text-white hover:bg-navy-900"
            onClick={() => navigate('/login')}
          >
            Iniciar sesión
          </Button>
          <Button
            size="lg"
            variant="outline"
            className="h-[52px] w-full border-[1.5px] border-navy-950 text-base text-navy-950 hover:bg-navy-950/5"
            onClick={() => navigate('/login?tab=register')}
          >
            Crear cuenta
          </Button>
        </div>

        <p className="mt-6 text-center text-xs text-muted-foreground">
          Herramienta educativa. No constituye asesoramiento financiero.
        </p>

        <a
          href="#como-funciona"
          className="mt-8 flex flex-col items-center gap-1 text-s font-semibold text-muted-foreground transition-colors hover:text-navy-950"
        >
          Descubrí cómo funciona
          <ChevronDown size={16} />
        </a>
      </AuthSplitLayout>

      <section id="como-funciona" className="bg-white px-6 py-14 sm:px-10 sm:py-16 lg:px-14">
        <div className="mx-auto max-w-5xl">
          <h2 className="text-center font-display text-2xl font-semibold text-navy-950 sm:text-3xl">
            Cómo funciona
          </h2>
          <p className="mx-auto mt-2 max-w-xl text-center text-sm text-muted-foreground">
            Cuatro pasos para crear tus carteras de inversión y simular su evolución sin arriesgar un peso.
          </p>

          <div className="mt-10 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {PASOS.map(({ icon: Icon, titulo, descripcion }, index) => (
              <Card key={titulo} className="p-5 ring-sand-200">
                <div className="flex size-9 items-center justify-center rounded-full bg-navy-950/5">
                  <Icon size={18} className="text-blue-brand" />
                </div>
                <p className="mt-4 text-xs font-semibold text-green-brand">
                  Paso {index + 1}
                </p>
                <p className="mt-1 font-display text-base font-semibold text-navy-950">
                  {titulo}
                </p>
                <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
                  {descripcion}
                </p>
              </Card>
            ))}
          </div>

          <p className="mt-10 text-center text-xs text-muted-foreground">
            Herramienta educativa. No constituye asesoramiento financiero ni recomendación de
            inversión.
          </p>
        </div>
      </section>
    </div>
  )
}
