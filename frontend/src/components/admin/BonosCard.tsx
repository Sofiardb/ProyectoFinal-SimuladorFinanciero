import { useRefreshBonosFlujos, useRefreshBonosYields } from '@/api/hooks'
import AdminCardHeader from './AdminCardHeader'
import AdminActionRow, { resultText } from './AdminActionRow'

export default function BonosCard() {
  const yields_ = useRefreshBonosYields()
  const flujos = useRefreshBonosFlujos()

  const handleYields = () => yields_.mutate()

  const handleFlujos = () => flujos.mutate()

  return (
    <div className="card">
      <AdminCardHeader titulo="Bonos" descripcion="Actualiza TIR y flujos de caja consultando Docta Capital." />
      <div className="flex flex-col gap-4">
        <AdminActionRow
          onClick={handleYields}
          isPending={yields_.isPending}
          label="Actualizar TIR (yields)"
          pendingLabel="Actualizando…"
          result={yields_.data && <p className={resultText}>{yields_.data.mensaje}</p>}
        />
        <AdminActionRow
          onClick={handleFlujos}
          isPending={flujos.isPending}
          label="Actualizar flujos de caja"
          pendingLabel="Actualizando…"
          helperText="Operación lenta — puede tardar varios segundos."
          result={flujos.data && <p className={resultText}>{flujos.data.mensaje}</p>}
        />
      </div>
    </div>
  )
}
