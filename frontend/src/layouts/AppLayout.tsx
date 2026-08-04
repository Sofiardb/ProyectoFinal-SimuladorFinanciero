import { Outlet } from 'react-router-dom'
import { Toaster } from '@/components/ui/sonner'
import TopNav from '@/components/layout/TopNav'

export default function AppLayout() {
  return (
    <div className="flex min-h-screen flex-col bg-sand-50">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-50 focus:rounded-lg focus:bg-navy-950 focus:px-4 focus:py-2 focus:text-sm focus:font-semibold focus:text-white"
      >
        Saltar al contenido principal
      </a>
      <TopNav />
      <main id="main-content" tabIndex={-1} className="flex-1 outline-none">
        <Outlet />
      </main>
      <Toaster position="top-right" richColors />
    </div>
  )
}
