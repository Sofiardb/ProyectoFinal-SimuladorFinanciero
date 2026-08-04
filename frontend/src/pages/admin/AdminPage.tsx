import AccionesCard from '@/components/admin/AccionesCard'
import BonosCard from '@/components/admin/BonosCard'
import ConectividadCard from '@/components/admin/ConectividadCard'
import LetrasCard from '@/components/admin/LetrasCard'
import TipoCambioCard from '@/components/admin/TipoCambioCard'

export default function AdminPage() {
  return (
    <div className="page-shell-lg max-w-[1080px]">
      <div className="mb-7">
        <h1 className="page-title mb-1.5">
          Administración
        </h1>
        <p className="text-sm text-ink-muted">
          Disparo manual de los refrescos automáticos de catálogo y verificación de las APIs externas.
        </p>
      </div>

      <div className="flex flex-col gap-5">
        <ConectividadCard />
        <LetrasCard />
        <BonosCard />
        <AccionesCard />
        <TipoCambioCard />
      </div>
    </div>
  )
}
