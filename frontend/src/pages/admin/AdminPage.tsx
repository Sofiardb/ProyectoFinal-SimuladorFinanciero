import { useState } from 'react'
import { toast } from 'sonner'
import {
  useAdminCheck,
  useRefreshLetras,
  useRefreshBonosYields,
  useRefreshBonosFlujos,
  useRefreshAcciones,
  useRefreshAccion,
  useRefreshTipoCambio,
  type EstadoConexion,
  type GbmRefreshResult,
} from '@/api/hooks'
import { FormattedErrorMessage } from '@/lib/formatErrorMessage'
import type { CampoPreview } from '@/lib/tenenciaDisplay'
import { cn } from '@/lib/utils'

const resultText = 'text-[12.5px] leading-normal text-ink-muted'

export default function AdminPage() {
  return (
    <div className="mx-auto max-w-[1080px] px-4 pt-8 pb-10 sm:px-6 lg:px-8 lg:pt-11 lg:pb-16">
      <div className="mb-7">
        <h1 className="mb-1.5 font-display text-2xl font-bold text-navy-950 xl:text-[28px]">
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

function CardHeader({ titulo, descripcion }: { titulo: string; descripcion: string }) {
  return (
    <div className="mb-3.5">
      <h3 className="font-display text-sm font-semibold text-navy-950">{titulo}</h3>
      <p className="mt-0.5 text-[12.5px] text-ink-soft">{descripcion}</p>
    </div>
  )
}

function EstadoBadge({ label, estado }: { label: string; estado: EstadoConexion }) {
  return (
    <div className="flex items-start gap-2">
      <span
        className={cn(
          'mt-[5px] size-2 shrink-0 rounded-full',
          estado.ok ? 'bg-favorable' : 'bg-desfavorable',
        )}
      />
      <p className="text-[12.5px] leading-normal">
        <span className="font-semibold text-navy-950">{label}: </span>
        <span className={estado.ok ? 'text-favorable' : 'text-desfavorable'}>{estado.detalle}</span>
      </p>
    </div>
  )
}

function ConectividadCard() {
  const check = useAdminCheck()

  const handleCheck = () => {
    check.mutate(undefined, {
      onSuccess: (data) =>
        toast.success(
          data.byma.ok && data.docta.ok
            ? 'Ambas APIs externas responden correctamente.'
            : 'Verificación completa: alguna API externa no responde.',
        ),
      onError: (error) => toast.error(error.message),
    })
  }

  return (
    <div className="card">
      <CardHeader
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

function LetrasCard() {
  const refresh = useRefreshLetras()

  const handleClick = () => {
    refresh.mutate(undefined, {
      onSuccess: (data) => toast.success(data.mensaje),
      onError: (error) => toast.error(error.message),
    })
  }

  return (
    <div className="card">
      <CardHeader
        titulo="Letras"
        descripcion="Actualiza precios y TNA de LECAP/LECER consultando BYMA Open Data."
      />
      <div className="flex flex-col gap-2">
        <button type="button" onClick={handleClick} disabled={refresh.isPending} className="btn-primary w-fit">
          {refresh.isPending ? 'Actualizando…' : 'Actualizar letras'}
        </button>
        {refresh.data && <p className={resultText}>{refresh.data.mensaje}</p>}
      </div>
    </div>
  )
}

function BonosCard() {
  const yields_ = useRefreshBonosYields()
  const flujos = useRefreshBonosFlujos()

  const handleYields = () => {
    yields_.mutate(undefined, {
      onSuccess: (data) => toast.success(data.mensaje),
      onError: (error) => toast.error(error.message),
    })
  }

  const handleFlujos = () => {
    flujos.mutate(undefined, {
      onSuccess: (data) => toast.success(data.mensaje),
      onError: (error) => toast.error(error.message),
    })
  }

  return (
    <div className="card">
      <CardHeader titulo="Bonos" descripcion="Actualiza TIR y flujos de caja consultando Docta Capital." />
      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-2">
          <button
            type="button"
            onClick={handleYields}
            disabled={yields_.isPending}
            className="btn-primary w-fit"
          >
            {yields_.isPending ? 'Actualizando…' : 'Actualizar TIR (yields)'}
          </button>
          {yields_.data && <p className={resultText}>{yields_.data.mensaje}</p>}
        </div>
        <div className="flex flex-col gap-2">
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={handleFlujos}
              disabled={flujos.isPending}
              className="btn-primary w-fit"
            >
              {flujos.isPending ? 'Actualizando…' : 'Actualizar flujos de caja'}
            </button>
            <span className="text-[11.5px] text-ink-soft">Operación lenta — puede tardar varios segundos.</span>
          </div>
          {flujos.data && <p className={resultText}>{flujos.data.mensaje}</p>}
        </div>
      </div>
    </div>
  )
}

function gbmResultadoCampos(resultado: GbmRefreshResult): CampoPreview[] {
  return [
    { label: 'Ticker', value: resultado.ticker },
    { label: 'μ (retorno esperado)', value: resultado.muRetornoEsperado.toFixed(4) },
    { label: 'σ (volatilidad)', value: resultado.sigmaVolatilidad.toFixed(4) },
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
          <p className="text-[9.5px] tracking-[0.3px] text-ink-soft uppercase">{c.label}</p>
          <p className="text-[12.5px] font-semibold text-navy-950">{c.value}</p>
        </div>
      ))}
    </div>
  )
}

function AccionesCard() {
  const refreshTodas = useRefreshAcciones()
  const refreshTicker = useRefreshAccion()
  const [ticker, setTicker] = useState('')

  const handleTodas = () => {
    refreshTodas.mutate(undefined, {
      onSuccess: (data) => toast.success(`Se recalcularon ${data.actualizadas} acciones.`),
      onError: (error) => toast.error(error.message),
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
      <CardHeader
        titulo="Acciones"
        descripcion="Recalcula los parámetros GBM (μ, σ, ρ, S₀) usando 10 años de historia de Alpha Vantage."
      />
      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-2">
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={handleTodas}
              disabled={refreshTodas.isPending}
              className="btn-primary w-fit"
            >
              {refreshTodas.isPending ? 'Recalculando…' : 'Recalcular todas'}
            </button>
            <span className="text-[11.5px] text-ink-soft">
              Operación lenta — puede tardar varios minutos por el rate limit de Alpha Vantage.
            </span>
          </div>
          {refreshTodas.data && (
            <p className={resultText}>Última corrida: {refreshTodas.data.actualizadas} acciones actualizadas.</p>
          )}
        </div>

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

function TipoCambioCard() {
  const refresh = useRefreshTipoCambio()

  const handleClick = () => {
    refresh.mutate(undefined, {
      onSuccess: (data) => toast.success(data.mensaje),
      onError: (error) => toast.error(error.message),
    })
  }

  return (
    <div className="card">
      <CardHeader
        titulo="Tipo de cambio (BCRA)"
        descripcion="Fuerza una consulta live al BCRA de la cotización USD/ARS, ignorando el valor cacheado del día."
      />
      <div className="flex flex-col gap-2">
        <button type="button" onClick={handleClick} disabled={refresh.isPending} className="btn-primary w-fit">
          {refresh.isPending ? 'Actualizando…' : 'Actualizar cotización'}
        </button>
        {refresh.data && (
          <p className={resultText}>
            {refresh.data.mensaje}{' '}
            <span className="font-semibold text-navy-950">
              (1 USD = {refresh.data.cotizacionUsdArs.toFixed(2)} ARS)
            </span>
          </p>
        )}
      </div>
    </div>
  )
}
