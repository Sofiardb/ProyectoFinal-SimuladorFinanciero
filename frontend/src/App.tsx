import { lazy, Suspense } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { TourProvider } from '@/contexts/TourContext'
import PublicLayout from '@/layouts/PublicLayout'
import AppLayout from '@/layouts/AppLayout'
import ProtectedRoute from '@/components/ProtectedRoute'
import AdminRoute from '@/components/AdminRoute'
import { Skeleton } from '@/components/ui/skeleton'

const LandingPage = lazy(() => import('@/pages/auth/LandingPage'))
const LoginPage = lazy(() => import('@/pages/auth/LoginPage'))
const ForgotPasswordPage = lazy(() => import('@/pages/auth/ForgotPasswordPage'))
const ResetPasswordPage = lazy(() => import('@/pages/auth/ResetPasswordPage'))
const VerifyEmailPage = lazy(() => import('@/pages/auth/VerifyEmailPage'))
const BienvenidaPage = lazy(() => import('@/pages/dashboard/BienvenidaPage'))
const PortfoliosPage = lazy(() => import('@/pages/portfolios/PortfoliosPage'))
const PortfolioDetallePage = lazy(() => import('@/pages/portfolios/PortfolioDetallePage'))
const NuevaSimulacionPage = lazy(() => import('@/pages/simulaciones/NuevaSimulacionPage'))
const ComparacionMercadoPage = lazy(() => import('@/pages/simulaciones/ComparacionMercadoPage'))
const ResultadosPage = lazy(() => import('@/pages/simulaciones/ResultadosPage'))
const HistorialPage = lazy(() => import('@/pages/simulaciones/HistorialPage'))
const CompararPage = lazy(() => import('@/pages/simulaciones/CompararPage'))
const PerfilPage = lazy(() => import('@/pages/perfil/PerfilPage'))
const AdminPage = lazy(() => import('@/pages/admin/AdminPage'))

function PageFallback() {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-3 p-8">
      <Skeleton className="h-8 w-48" />
      <Skeleton className="h-4 w-72" />
    </div>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <TourProvider>
        <Suspense fallback={<PageFallback />}>
          <Routes>
            <Route element={<PublicLayout />}>
              <Route path="/" element={<LandingPage />} />
              <Route path="/login" element={<LoginPage />} />
              <Route path="/forgot-password" element={<ForgotPasswordPage />} />
              <Route path="/reset-password" element={<ResetPasswordPage />} />
              <Route path="/verify-email" element={<VerifyEmailPage />} />
            </Route>

            <Route element={<ProtectedRoute />}>
              <Route element={<AppLayout />}>
                <Route path="/bienvenida" element={<BienvenidaPage />} />
                <Route path="/portfolios" element={<PortfoliosPage />} />
                <Route path="/portfolios/:id" element={<PortfolioDetallePage />} />
                <Route
                  path="/portfolios/:id/simular"
                  element={<NuevaSimulacionPage />}
                />
                <Route path="/portfolios/:id/comparar-mercado" element={<ComparacionMercadoPage />} />
                <Route path="/simulaciones" element={<HistorialPage />} />
                <Route path="/simulaciones/nueva" element={<NuevaSimulacionPage />} />
                <Route path="/simulaciones/:id" element={<ResultadosPage />} />
                <Route path="/simulaciones/comparar" element={<CompararPage />} />
                <Route path="/perfil" element={<PerfilPage />} />
                <Route element={<AdminRoute />}>
                  <Route path="/admin" element={<AdminPage />} />
                </Route>
              </Route>
            </Route>

            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Suspense>
      </TourProvider>
    </BrowserRouter>
  )
}
