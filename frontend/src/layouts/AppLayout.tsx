import { Outlet } from 'react-router-dom'
import { Toaster } from '@/components/ui/sonner'
import Sidebar from '@/components/layout/Sidebar'

export default function AppLayout() {
  return (
    <div className="flex min-h-screen bg-sand-50">
      <Sidebar />
      <main className="flex-1 overflow-y-auto">
        <Outlet />
      </main>
      <Toaster position="top-right" richColors />
    </div>
  )
}
