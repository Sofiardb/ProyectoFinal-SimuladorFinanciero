import { useAdminCheck } from '@/api/hooks'
import AdminCardHeader from './AdminCardHeader'
import EstadoBadge from './EstadoBadge'

export default function ConectividadCard() {
  const check = useAdminCheck()

  const handleCheck = () => check.mutate()

  return (
    <div className="card">
      <AdminCardHeader
        titulo="Conectividad"
        descripcion="Verifica la conexión con BYMA Open Data y Docta Capital sin consumir cuota significativa."
      />
      <div className="flex flex-col gap-3">
        <button type="button" onClick={handleCheck} disabled={check.isPending} className="btn-primary w-fit">
          {check.isPending ? 'Verificando…' : 'Verificar conexión'}
        </button>
        {check.data && (
          <div className="flex flex-col gap-1.5">
            <EstadoBadge label="BYMA" estado={check.data.byma} />
            <EstadoBadge label="Docta Capital" estado={check.data.docta} />
          </div>
        )}
      </div>
    </div>
  )
}
