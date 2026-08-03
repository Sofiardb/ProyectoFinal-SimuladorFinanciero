import { useRefreshTipoCambio } from '@/api/hooks'
import AdminCardHeader from './AdminCardHeader'
import AdminActionRow, { resultText } from './AdminActionRow'

export default function TipoCambioCard() {
  const refresh = useRefreshTipoCambio()

  const handleClick = () => refresh.mutate()

  return (
    <div className="card">
      <AdminCardHeader
        titulo="Tipo de cambio (BCRA)"
        descripcion="Fuerza una consulta live al BCRA de la cotización USD/ARS, ignorando el valor cacheado del día."
      />
      <AdminActionRow
        onClick={handleClick}
        isPending={refresh.isPending}
        label="Actualizar cotización"
        pendingLabel="Actualizando…"
        result={
          refresh.data && (
            <p className={resultText}>
              {refresh.data.mensaje}{' '}
              <span className="font-semibold text-navy-950">
                (1 USD = {refresh.data.cotizacionUsdArs.toFixed(2)} ARS)
              </span>
            </p>
          )
        }
      />
    </div>
  )
}
