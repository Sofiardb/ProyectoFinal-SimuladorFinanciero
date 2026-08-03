import { useRefreshLetras } from '@/api/hooks'
import AdminCardHeader from './AdminCardHeader'
import AdminActionRow, { resultText } from './AdminActionRow'

export default function LetrasCard() {
  const refresh = useRefreshLetras()

  const handleClick = () => refresh.mutate()

  return (
    <div className="card">
      <AdminCardHeader
        titulo="Letras"
        descripcion="Actualiza precios y TNA de LECAP/LECER consultando BYMA Open Data."
      />
      <AdminActionRow
        onClick={handleClick}
        isPending={refresh.isPending}
        label="Actualizar letras"
        pendingLabel="Actualizando…"
        result={refresh.data && <p className={resultText}>{refresh.data.mensaje}</p>}
      />
    </div>
  )
}
