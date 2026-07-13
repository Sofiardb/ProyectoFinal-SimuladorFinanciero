import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import PublicLayout from '@/layouts/PublicLayout'
import AppLayout from '@/layouts/AppLayout'
import ProtectedRoute from '@/components/ProtectedRoute'
import LandingPage from '@/pages/auth/LandingPage'
import LoginPage from '@/pages/auth/LoginPage'
import ForgotPasswordPage from '@/pages/auth/ForgotPasswordPage'
import ResetPasswordPage from '@/pages/auth/ResetPasswordPage'
import BienvenidaPage from '@/pages/dashboard/BienvenidaPage'
import PortfoliosPage from '@/pages/portfolios/PortfoliosPage'
import PortfolioDetallePage from '@/pages/portfolios/PortfolioDetallePage'
import NuevaSimulacionPage from '@/pages/simulaciones/NuevaSimulacionPage'
import ResultadosPage from '@/pages/simulaciones/ResultadosPage'
import HistorialPage from '@/pages/simulaciones/HistorialPage'
import CompararPage from '@/pages/simulaciones/CompararPage'
import PerfilPage from '@/pages/perfil/PerfilPage'

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Public routes */}
        <Route element={<PublicLayout />}>
          <Route path="/" element={<LandingPage />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/forgot-password" element={<ForgotPasswordPage />} />
          <Route path="/reset-password" element={<ResetPasswordPage />} />
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
            <Route path="/simulaciones" element={<HistorialPage />} />
            <Route path="/simulaciones/nueva" element={<NuevaSimulacionPage />} />
            <Route path="/simulaciones/:id" element={<ResultadosPage />} />
            <Route path="/simulaciones/comparar" element={<CompararPage />} />
            <Route path="/perfil" element={<PerfilPage />} />
          </Route>
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}
