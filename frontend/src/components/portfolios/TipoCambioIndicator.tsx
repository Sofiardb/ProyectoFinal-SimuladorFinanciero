import { useTipoCambio } from '@/api/hooks'
import { formatDiasDesde } from '@/lib/format'

/**
 * Cotización USD/ARS vigente, aplicada en silencio para validar presupuesto (docs/09, sección 6) —
 * este indicador solo muestra cuán reciente es, sin bloquear ni pedirle nada al usuario.
 */
export default function TipoCambioIndicator() {
  const { data: tipoCambio } = useTipoCambio()

  if (!tipoCambio) return null

  return (
    <p className="text-[11.5px] text-ink-soft">
      TC: $
      {tipoCambio.valor.toLocaleString('es-AR', { maximumFractionDigits: 2 })} USD/ARS · actualizado{' '}
      {formatDiasDesde(tipoCambio.fecha)}
    </p>
  )
}
