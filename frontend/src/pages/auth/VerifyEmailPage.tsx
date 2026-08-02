import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription } from '@/components/ui/alert'
import AuthSplitLayout from '@/components/auth/AuthSplitLayout'
import { api, ApiError } from '@/api/client'

type Estado =
  | { fase: 'verificando' }
  | { fase: 'exito'; mensaje: string }
  | { fase: 'error'; mensaje: string }

export default function VerifyEmailPage() {
  const [searchParams] = useSearchParams()
  const token = searchParams.get('token') ?? ''
  const navigate = useNavigate()
  const yaIntentado = useRef(false)
  const [estado, setEstado] = useState<Estado>({ fase: 'verificando' })

  useEffect(() => {
    if (!token || yaIntentado.current) return
    yaIntentado.current = true

    api
      .post<{ message: string }>('/auth/verify-email', { token })
      .then((data) => setEstado({ fase: 'exito', mensaje: data.message }))
      .catch((err) => {
        setEstado({
          fase: 'error',
          mensaje:
            err instanceof ApiError ? err.message : 'Ocurrió un error inesperado. Intentá de nuevo.',
        })
      })
  }, [token])

  useEffect(() => {
    if (estado.fase !== 'exito') return
    const id = setTimeout(() => navigate('/login'), 2500)
    return () => clearTimeout(id)
  }, [estado.fase, navigate])

  return (
    <AuthSplitLayout
      headline="Verificá tu cuenta"
      body="Un último paso antes de empezar a simular tu futuro financiero."
    >
      <h2 className="mb-6 font-display text-xl font-semibold text-navy-950 sm:text-2xl">
        Verificación de email
      </h2>

      {!token ? (
        <Alert variant="destructive">
          <AlertDescription>
            Este enlace no es válido. Volvé a registrarte o pedí que te reenvíen el email de
            verificación desde{' '}
            <Link to="/login" className="font-semibold underline">
              iniciar sesión
            </Link>
            .
          </AlertDescription>
        </Alert>
      ) : estado.fase === 'exito' ? (
        <>
          <Alert className="mb-6 border-green-brand bg-[#eaf7f0] text-[#1c6b45]">
            <AlertDescription className="text-[#1c6b45]">{estado.mensaje}</AlertDescription>
          </Alert>
          <Button size="lg" className="btn-auth-submit" onClick={() => navigate('/login')}>
            Iniciar sesión
          </Button>
        </>
      ) : estado.fase === 'error' ? (
        <Alert variant="destructive">
          <AlertDescription>{estado.mensaje}</AlertDescription>
        </Alert>
      ) : (
        <p className="text-sm text-muted-foreground">Verificando tu cuenta…</p>
      )}
    </AuthSplitLayout>
  )
}
