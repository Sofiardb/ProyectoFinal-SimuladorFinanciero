import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { Skeleton } from '@/components/ui/skeleton'
import DisabledButtonTooltip from '@/components/ui/disabled-button-tooltip'
import RangosInflacionCard from '@/components/simulaciones/RangosInflacionCard'
import ConfirmarSimulacionStaleDialog from '@/components/simulaciones/nuevaSimulacion/ConfirmarSimulacionStaleDialog'
import DetallePortfolioResumenCard from '@/components/simulaciones/nuevaSimulacion/DetallePortfolioResumenCard'
import SeleccionarPortfolio from '@/components/simulaciones/nuevaSimulacion/SeleccionarPortfolio'
import SimulacionFinalizadaCard from '@/components/simulaciones/nuevaSimulacion/SimulacionFinalizadaCard'
import { construirFilasPortfolio } from '@/components/simulaciones/nuevaSimulacion/filasPortfolio'
import { usePortfolio, usePortfolioPreview, useLanzarSimulacion, useAccionesCatalogo, useBonosCatalogo, useLetrasCatalogo } from '@/api/hooks'
import { onErrorToast } from '@/lib/toast'
import type { SimulacionResumen } from '@/types'

const HORIZONTE_MIN = 1
const HORIZONTE_MAX = 60
const HORIZONTE_DEFAULT = 12

export default function NuevaSimulacionPage() {
  const { id } = useParams<{ id?: string }>()
  const idFromUrl = Number(id)
  const navigate = useNavigate()

  if (!Number.isFinite(idFromUrl)) {
    return <SeleccionarPortfolio />
  }

  return <ConfigurarSimulacion idPortfolio={idFromUrl} navigate={navigate} />
}

function ConfigurarSimulacion({
  idPortfolio,
  navigate,
}: {
  idPortfolio: number
  navigate: ReturnType<typeof useNavigate>
}) {
  const { data: detalle, isLoading: loadingDetalle } = usePortfolio(idPortfolio)
  const { data: preview, isLoading: loadingPreview } = usePortfolioPreview(idPortfolio)
  const { data: accionesCatalogo } = useAccionesCatalogo()
  const { data: bonosCatalogo } = useBonosCatalogo()
  const { data: letrasCatalogo } = useLetrasCatalogo()
  const lanzarSimulacion = useLanzarSimulacion(idPortfolio)

  const [horizonteMeses, setHorizonteMeses] = useState(HORIZONTE_DEFAULT)
  const [resumen, setResumen] = useState<SimulacionResumen | null>(null)
  const [confirmStaleOpen, setConfirmStaleOpen] = useState(false)

  if (loadingDetalle || loadingPreview) {
    return (
      <div className="page-shell max-w-[920px] space-y-4">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-40 w-full" />
      </div>
    )
  }

  if (!detalle) {
    return (
      <div className="page-shell max-w-[920px] text-center">
        <p className="text-ink-muted">No se encontró el portfolio.</p>
        <Link to="/portfolios" className="link-back-fallback">
          Volver a mis portfolios
        </Link>
      </div>
    )
  }

  if (resumen) {
    return (
      <div className="page-shell max-w-[920px]">
        <SimulacionFinalizadaCard
          resumen={resumen}
          nombrePortfolio={detalle.nombre}
          onVolverAlPortfolio={() => navigate(`/portfolios/${idPortfolio}`)}
          onVerResultados={() => navigate(`/simulaciones/${resumen.idSimulacion}`)}
        />
      </div>
    )
  }

  const bloqueado = preview ? !preview.puedeSimular : false
  const editHref = `/portfolios/${idPortfolio}`
  const { usdFilas, arsFilas } = construirFilasPortfolio(detalle, { accionesCatalogo, bonosCatalogo, letrasCatalogo })

  const handleLanzar = () => {
    lanzarSimulacion.mutate(
      { horizonteMeses },
      {
        onSuccess: (data) => setResumen(data),
        onError: onErrorToast,
      },
    )
  }

  const handleLanzarClick = () => {
    if (preview?.tieneActualizaciones) {
      setConfirmStaleOpen(true)
      return
    }
    handleLanzar()
  }

  const handleConfirmarConSnapshot = () => {
    setConfirmStaleOpen(false)
    handleLanzar()
  }

  return (
    <div className="page-shell max-w-[920px]">
      <div className="breadcrumb-nav">
        <Link to={`/portfolios?perfil=${detalle.idPerfilRiesgo}`} className="hover:text-navy-950">
          Portfolios
        </Link>
        <span>/</span>
        <Link to={`/portfolios/${idPortfolio}`} className="hover:text-navy-950">
          {detalle.nombre}
        </Link>
        <span>/</span>
        <span className="font-semibold text-navy-950">Nueva simulación</span>
      </div>
      <button onClick={() => navigate(-1)} className="btn-back">
        ← Volver
      </button>

      <div className="mb-6">
        <h1 className="page-title mb-1.5">
          Nueva simulación
        </h1>
        <p className="text-[13.5px] text-ink-muted">Definí el horizonte temporal para {detalle.nombre}.</p>
      </div>

      {preview?.tieneActualizaciones && (
        <div className="banner-warning mb-6 flex flex-wrap items-center justify-between gap-4">
          <span>{detalle.nombre} tiene instrumentos con datos de mercado más recientes que el último snapshot.</span>
          <Link
            to={`/portfolios/${idPortfolio}/comparar-mercado`}
            className="inline-flex h-9 shrink-0 items-center justify-center rounded-lg border-[1.5px] border-warning-accent bg-white px-3.5 text-[12.5px] font-semibold whitespace-nowrap text-warning-title"
          >
            Ver comparación
          </Link>
        </div>
      )}

      <div className="card mb-5">
        <p className="card-section-label mb-3">
          Horizonte: {horizonteMeses} {horizonteMeses === 1 ? 'mes' : 'meses'}
        </p>
        <input
          type="range"
          min={HORIZONTE_MIN}
          max={HORIZONTE_MAX}
          value={horizonteMeses}
          onChange={(e) => setHorizonteMeses(Number(e.target.value))}
          className="w-full accent-navy-950"
        />
      </div>

      <RangosInflacionCard />

      <DetallePortfolioResumenCard usdFilas={usdFilas} arsFilas={arsFilas} editHref={editHref} bloqueado={bloqueado} />

      <div className="card flex flex-wrap items-center justify-between gap-4">
        <p className="max-w-[400px] text-[12.5px] text-ink-soft">
          Se van a generar 1.000 trayectorias Monte Carlo por escenario para {detalle.nombre}.
        </p>
        <DisabledButtonTooltip title={bloqueado ? 'Hay instrumentos vencidos que bloquean esta simulación.' : undefined}>
          <button
            onClick={handleLanzarClick}
            disabled={bloqueado || lanzarSimulacion.isPending}
            className="btn-primary"
          >
            {lanzarSimulacion.isPending ? 'Lanzando…' : 'Lanzar simulación'}
          </button>
        </DisabledButtonTooltip>
      </div>

      <ConfirmarSimulacionStaleDialog
        open={confirmStaleOpen}
        onOpenChange={setConfirmStaleOpen}
        nombrePortfolio={detalle.nombre}
        isPending={lanzarSimulacion.isPending}
        onVerComparacion={() => navigate(`/portfolios/${idPortfolio}/comparar-mercado`)}
        onConfirmar={handleConfirmarConSnapshot}
      />
    </div>
  )
}
