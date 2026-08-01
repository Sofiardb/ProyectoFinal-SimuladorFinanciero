import { useState } from 'react'
import { toast } from 'sonner'
import { useRefreshAccion, useRefreshAcciones, type GbmRefreshResult } from '@/api/hooks'
import { FormattedErrorMessage } from '@/lib/formatErrorMessage'
import type { CampoPreview } from '@/lib/tenenciaDisplay'
import { onErrorToast } from '@/lib/toast'
import AdminCardHeader from './AdminCardHeader'
import AdminActionRow, { resultText } from './AdminActionRow'

function gbmResultadoCampos(resultado: GbmRefreshResult): CampoPreview[] {
  return [
    { label: 'Ticker', value: resultado.ticker },
    { label: 'μ (retorno esperado anual)', value: resultado.muRetornoEsperado.toFixed(4) },
    { label: 'σ (volatilidad anual)', value: resultado.sigmaVolatilidad.toFixed(4) },
    { label: 'ρ (correlación índice)', value: resultado.rhoCorrelacionIndice.toFixed(4) },
    { label: 'Precio actual', value: resultado.precioActual.toFixed(2) },
    { label: 'Meses de datos', value: String(resultado.mesesDeDatos) },
  ]
}

function GbmResultado({ resultado }: { resultado: GbmRefreshResult }) {
  return (
    <div className="grid grid-cols-2 gap-x-4 gap-y-1 sm:grid-cols-3">
      {gbmResultadoCampos(resultado).map((c) => (
        <div key={c.label}>
          <p className="stat-label">{c.label}</p>
          <p className="stat-value">{c.value}</p>
        </div>
      ))}
    </div>
  )
}

export default function AccionesCard() {
  const refreshTodas = useRefreshAcciones()
  const refreshTicker = useRefreshAccion()
  const [ticker, setTicker] = useState('')

  const handleTodas = () => {
    refreshTodas.mutate(undefined, {
      onSuccess: (data) => toast.success(`Se recalcularon ${data.actualizadas} acciones.`),
      onError: onErrorToast,
    })
  }

  const handleTicker = () => {
    if (!ticker.trim()) return
    refreshTicker.mutate(ticker.trim(), {
      onSuccess: (data) => toast.success(`${data.ticker} actualizado.`),
    })
  }

  return (
    <div className="card">
      <AdminCardHeader
        titulo="Acciones"
        descripcion="Recalcula los parámetros GBM (μ, σ, ρ, S₀) usando 10 años de historia de Alpha Vantage."
      />
      <div className="flex flex-col gap-4">
        <AdminActionRow
          onClick={handleTodas}
          isPending={refreshTodas.isPending}
          label="Recalcular todas"
          pendingLabel="Recalculando…"
          helperText="Operación lenta — puede tardar varios minutos por el rate limit de Alpha Vantage."
          result={
            refreshTodas.data && (
              <p className={resultText}>Última corrida: {refreshTodas.data.actualizadas} acciones actualizadas.</p>
            )
          }
        />

        <div className="flex flex-col gap-2 border-t border-line pt-4">
          <span className="field-label">Recalcular un ticker específico</span>
          <div className="flex flex-wrap items-center gap-2">
            <input
              type="text"
              className="field-input w-32"
              placeholder="Ej: AAPL"
              value={ticker}
              onChange={(e) => setTicker(e.target.value.toUpperCase())}
            />
            <button
              type="button"
              onClick={handleTicker}
              disabled={refreshTicker.isPending || !ticker.trim()}
              className="btn-primary w-fit"
            >
              {refreshTicker.isPending ? 'Recalculando…' : 'Recalcular ticker'}
            </button>
          </div>
          {refreshTicker.data && <GbmResultado resultado={refreshTicker.data} />}
          {refreshTicker.error && (
            <div className="banner-danger">
              <FormattedErrorMessage text={refreshTicker.error.message} />
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
