import { Navigate, useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import AuthSplitLayout from '@/components/auth/AuthSplitLayout'
import { useAuth } from '@/contexts/AuthContext'

export default function LandingPage() {
  const { isAuthenticated } = useAuth()
  const navigate = useNavigate()

  if (isAuthenticated) return <Navigate to="/portfolios" replace />

  return (
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
    </AuthSplitLayout>
  )
}
