import { Navigate, Outlet } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'

export default function AdminRoute() {
  const { usuario } = useAuth()

  if (!usuario?.esAdmin) {
    return <Navigate to="/portfolios" replace />
  }

  return <Outlet />
}
