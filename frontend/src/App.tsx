import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { TourProvider } from '@/contexts/TourContext'
import PublicLayout from '@/layouts/PublicLayout'
import AppLayout from '@/layouts/AppLayout'
import ProtectedRoute from '@/components/ProtectedRoute'
import AdminRoute from '@/components/AdminRoute'
import LandingPage from '@/pages/auth/LandingPage'
import LoginPage from '@/pages/auth/LoginPage'
import ForgotPasswordPage from '@/pages/auth/ForgotPasswordPage'
import ResetPasswordPage from '@/pages/auth/ResetPasswordPage'
import VerifyEmailPage from '@/pages/auth/VerifyEmailPage'
import BienvenidaPage from '@/pages/dashboard/BienvenidaPage'
import PortfoliosPage from '@/pages/portfolios/PortfoliosPage'
import PortfolioDetallePage from '@/pages/portfolios/PortfolioDetallePage'
import NuevaSimulacionPage from '@/pages/simulaciones/NuevaSimulacionPage'
import ComparacionMercadoPage from '@/pages/simulaciones/ComparacionMercadoPage'
import ResultadosPage from '@/pages/simulaciones/ResultadosPage'
import HistorialPage from '@/pages/simulaciones/HistorialPage'
import CompararPage from '@/pages/simulaciones/CompararPage'
import PerfilPage from '@/pages/perfil/PerfilPage'
import AdminPage from '@/pages/admin/AdminPage'

export default function App() {
  return (
    <BrowserRouter>
      <TourProvider>
        <Routes>
          {/* Public routes */}
          <Route element={<PublicLayout />}>
            <Route path="/" element={<LandingPage />} />
            <Route path="/login" element={<LoginPage />} />
            <Route path="/forgot-password" element={<ForgotPasswordPage />} />
            <Route path="/reset-password" element={<ResetPasswordPage />} />
            <Route path="/verify-email" element={<VerifyEmailPage />} />
          </Route>

          {/* Authenticated app routes */}
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
      </TourProvider>
    </BrowserRouter>
  )
}
