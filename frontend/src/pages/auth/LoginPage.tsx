import { useState } from 'react'
import { Navigate, useSearchParams } from 'react-router-dom'
import { cn } from '@/lib/utils'
import AuthSplitLayout from '@/components/auth/AuthSplitLayout'
import LoginForm from '@/components/auth/LoginForm'
import RegisterForm from '@/components/auth/RegisterForm'
import { useAuth } from '@/contexts/AuthContext'

type Mode = 'login' | 'register'

const COPY: Record<Mode, { headline: string; body: string }> = {
  login: {
    headline: 'Volvé a simular tu futuro financiero',
    body: 'Entrá para ver tus portfolios, corridas anteriores y seguir explorando escenarios.',
  },
  register: {
    headline: 'Empezá a practicar sin riesgo real',
    body: 'Creá tu cuenta gratis y armá tu primer portfolio educativo en minutos.',
  },
}

export default function LoginPage() {
  const { isAuthenticated } = useAuth()
  const [searchParams] = useSearchParams()
  const initialMode: Mode = searchParams.get('tab') === 'register' ? 'register' : 'login'
  const [mode, setMode] = useState<Mode>(initialMode)

  if (isAuthenticated) return <Navigate to="/portfolios" replace />

  return (
    <AuthSplitLayout headline={COPY[mode].headline} body={COPY[mode].body}>
      <div className="mb-5 flex gap-7 border-b-[1.5px] border-sand-200">
        <button
          type="button"
          onClick={() => setMode('login')}
          className={cn(
            'border-b-[2.5px] pb-3 font-display text-[15px] font-semibold transition-colors',
            mode === 'login'
              ? 'border-navy-950 text-navy-950'
              : 'border-transparent text-muted-foreground',
          )}
        >
          Iniciar sesión
        </button>
        <button
          type="button"
          onClick={() => setMode('register')}
          className={cn(
            'border-b-[2.5px] pb-3 font-display text-[15px] font-semibold transition-colors',
            mode === 'register'
              ? 'border-navy-950 text-navy-950'
              : 'border-transparent text-muted-foreground',
          )}
        >
          Crear cuenta
        </button>
      </div>

      {mode === 'login' ? (
        <LoginForm onSwitchToRegister={() => setMode('register')} />
      ) : (
        <RegisterForm onSwitchToLogin={() => setMode('login')} />
      )}

      <p className="mt-4 text-center text-xs text-muted-foreground">
        Herramienta educativa. No constituye asesoramiento financiero.
      </p>
    </AuthSplitLayout>
  )
}
