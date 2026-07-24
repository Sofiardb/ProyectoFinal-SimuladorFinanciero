import { useTipoCambio } from '@/api/hooks'
import { calcularMontoInvertido } from '@/lib/presupuesto'
import { formatMoneda } from '@/lib/format'
import type { PortfolioDetalle } from '@/types'

/**
 * Límite de presupuesto (capital_inicial) y monto invertido, como dos campos de solo lectura —
 * siempre antes de la lista de instrumentos. El monto invertido se recalcula en cada render a partir
 * de `detalle`, así que se actualiza solo cuando se agrega/edita/elimina una tenencia (misma fuente que
 * ya usan las secciones de instrumentos, sin fetch adicional).
 */
export default function PresupuestoBoxes({ detalle }: { detalle: PortfolioDetalle }) {
  const { data: tipoCambio } = useTipoCambio()
  const { totalArs, totalUsd, totalEnBase } = calcularMontoInvertido(detalle, tipoCambio?.valor)

  return (
    <div className="mb-5 grid grid-cols-1 gap-3 sm:max-w-[420px] sm:grid-cols-2">
      <div>
        <span className="field-label">Límite de presupuesto</span>
        <div className="readonly-chip-value">
          {detalle.capitalInicial != null ? formatMoneda(detalle.capitalInicial, detalle.codigoMonedaBase) : 'Sin límite'}
        </div>
      </div>
      <div>
        <span className="field-label">Monto invertido (convertido)</span>
        <div className="readonly-chip-value">{formatMoneda(totalEnBase, detalle.codigoMonedaBase)}</div>
      </div>
      <div>
        <span className="field-label">Invertido en ARS</span>
        <div className="readonly-chip-value">{formatMoneda(totalArs, 'ARS')}</div>
      </div>
      <div>
        <span className="field-label">Invertido en USD</span>
        <div className="readonly-chip-value">{formatMoneda(totalUsd, 'USD')}</div>
      </div>
    </div>
  )
}
