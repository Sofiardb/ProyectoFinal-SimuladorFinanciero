import { Outlet } from 'react-router-dom'
import { Toaster } from '@/components/ui/sonner'
import TopNav from '@/components/layout/TopNav'

export default function AppLayout() {
  return (
    <div className="flex min-h-screen flex-col bg-sand-50">
      <TopNav />
      <main className="flex-1">
        <Outlet />
      </main>
      <Toaster position="top-right" richColors />
    </div>
  )
}
