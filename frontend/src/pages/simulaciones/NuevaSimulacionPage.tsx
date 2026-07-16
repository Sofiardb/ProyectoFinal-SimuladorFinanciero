import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { Skeleton } from '@/components/ui/skeleton'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import TenenciaResumenRow from '@/components/portfolios/tenencias/TenenciaResumenRow'
import {
  usePortfolio,
  usePortfolioPreview,
  usePortfolios,
  useLanzarSimulacion,
  useAccionesCatalogo,
  useBonosCatalogo,
  useLetrasCatalogo,
} from '@/api/hooks'
import {
  accionCatalogoPorId,
  accionRow,
  bonoCatalogoPorId,
  bonoRow,
  letraCatalogoPorId,
  letraRow,
  plazoFijoPreview,
  type TenenciaRowCore,
} from '@/lib/tenenciaDisplay'
import { onErrorToast } from '@/lib/toast'
import type { SimulacionResumen, PortfolioPlazoFijo } from '@/types'

function fila(id: string, row: TenenciaRowCore) {
  return { id, titulo: row.titulo, subtitulo: row.subtitulo, campos: row.previewFields }
}

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

function SeleccionarPortfolio() {
  const { data: portfolios, isLoading } = usePortfolios()
  const navigate = useNavigate()

  return (
    <div className="page-shell max-w-[640px]">
      <h1 className="mb-1.5 font-display text-2xl leading-tight font-bold text-navy-950 xl:text-[26px]">
        Nueva simulación
      </h1>
      <p className="mb-6 text-[13.5px] text-ink-muted">Elegí para qué portfolio querés correr una simulación.</p>

      {isLoading ? (
        <Skeleton className="h-40 w-full" />
      ) : !portfolios || portfolios.length === 0 ? (
        <div className="card text-[13.5px] text-ink-muted">
          Todavía no tenés portfolios.{' '}
          <Link to="/portfolios" className="font-semibold text-navy-950 underline">
            Creá uno
          </Link>{' '}
          para poder simular.
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {portfolios.map((p) => (
            <button
              key={p.idPortfolio}
              onClick={() => navigate(`/portfolios/${p.idPortfolio}/simular`)}
              className="card flex items-center justify-between text-left hover:border-navy-950"
            >
              <div>
                <p className="text-[13.5px] font-semibold text-navy-950">{p.nombre}</p>
                <p className="mt-0.5 text-[11.5px] text-ink-soft">{p.nombrePerfilRiesgo}</p>
              </div>
              <span className="text-[12.5px] font-semibold text-navy-950">Elegir →</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
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
        <Link to="/portfolios" className="mt-2 inline-block text-sm font-medium text-navy-950 underline">
          Volver a mis portfolios
        </Link>
      </div>
    )
  }

  if (resumen) {
    return (
      <div className="page-shell max-w-[920px]">
        <div className="card p-14 text-center">
          <div className="mx-auto mb-5 flex size-14 items-center justify-center rounded-full bg-riesgo-moderado-bg text-2xl text-accent-blue-strong">
            ✓
          </div>
          <p className="mb-2 font-display text-xl font-semibold text-navy-950">Simulación en curso</p>
          <p className="mx-auto mb-6 max-w-[420px] text-sm leading-relaxed text-ink-muted">
            Corriendo {resumen.numTrayectorias.toLocaleString('es-AR')} trayectorias Monte Carlo para {detalle.nombre}{' '}
            a {resumen.horizonteMeses} meses. Vas a poder verla en el historial cuando esté lista.
          </p>
          <button onClick={() => navigate(`/portfolios/${idPortfolio}`)} className="btn-primary">
            Volver al portfolio
          </button>
        </div>
      </div>
    )
  }

  const bloqueado = preview ? !preview.puedeSimular : false
  const editHref = `/portfolios/${idPortfolio}`

  const accionesPorId = accionCatalogoPorId(accionesCatalogo)
  const bonosPorId = bonoCatalogoPorId(bonosCatalogo)
  const letrasPorId = letraCatalogoPorId(letrasCatalogo)

  const accionesFilas = detalle.acciones.map((a) => fila(`accion_${a.idPortfolioAccion}`, accionRow(a, accionesPorId)))
  const bonosFilas = detalle.bonos.map((b) => fila(`bono_${b.idPortfolioBono}`, bonoRow(b, bonosPorId)))
  const letrasFilas = detalle.letras.map((l) => fila(`letra_${l.idPortfolioLetra}`, letraRow(l, letrasPorId)))
  const plazoFijoFila = (pf: PortfolioPlazoFijo) => ({
    id: `pf_${pf.idPortfolioPlazoFijo}`,
    titulo: pf.entidadFinanciera,
    subtitulo: pf.nombreTipoPlazoFijo,
    campos: plazoFijoPreview(pf),
  })

  const usdFilas = [
    ...accionesFilas,
    ...detalle.plazosFijos.filter((pf) => pf.codigoMoneda === 'USD').map(plazoFijoFila),
  ]
  const arsFilas = [
    ...bonosFilas,
    ...letrasFilas,
    ...detalle.plazosFijos.filter((pf) => pf.codigoMoneda === 'ARS').map(plazoFijoFila),
  ]

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
        <h1 className="mb-1.5 font-display text-2xl leading-tight font-bold text-navy-950 xl:text-[26px]">
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
        <p className="mb-3 text-[11px] font-bold tracking-[0.4px] text-ink-soft uppercase">
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

      <div className="card mb-5 flex flex-col gap-5">
        <p className="text-[11px] font-bold tracking-[0.4px] text-ink-soft uppercase">
          Detalle del portfolio
        </p>
        {usdFilas.length > 0 && (
          <div>
            <p className="mb-2 text-[11px] font-bold tracking-[0.4px] text-blue-brand">
              USD · ACCIONES Y PLAZO FIJO
            </p>
            <div className="flex flex-col gap-2">
              {usdFilas.map((f) => (
                <TenenciaResumenRow key={f.id} titulo={f.titulo} subtitulo={f.subtitulo} campos={f.campos} editHref={editHref} />
              ))}
            </div>
          </div>
        )}
        {arsFilas.length > 0 && (
          <div>
            <p className="mb-2 text-[11px] font-bold tracking-[0.4px] text-currency-ars">
              ARS · BONOS, LETRAS Y PLAZO FIJO
            </p>
            <div className="flex flex-col gap-2">
              {arsFilas.map((f) => (
                <TenenciaResumenRow key={f.id} titulo={f.titulo} subtitulo={f.subtitulo} campos={f.campos} editHref={editHref} />
              ))}
            </div>
          </div>
        )}
        {usdFilas.length === 0 && arsFilas.length === 0 && (
          <p className="text-[13px] text-ink-muted">Este portfolio todavía no tiene instrumentos.</p>
        )}
        {bloqueado && (
          <p className="text-[12.5px] text-danger">
            Hay instrumentos vencidos que bloquean esta simulación. Eliminalos o reemplazalos desde el detalle del
            portfolio.
          </p>
        )}
      </div>

      <div className="card flex flex-wrap items-center justify-between gap-4">
        <p className="max-w-[400px] text-[12.5px] text-ink-soft">
          Se van a generar 1.000 trayectorias Monte Carlo por escenario para {detalle.nombre}.
        </p>
        <button
          onClick={handleLanzarClick}
          disabled={bloqueado || lanzarSimulacion.isPending}
          className="btn-primary"
        >
          {lanzarSimulacion.isPending ? 'Lanzando…' : 'Lanzar simulación'}
        </button>
      </div>

      <Dialog open={confirmStaleOpen} onOpenChange={setConfirmStaleOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Vas a simular con datos desactualizados</DialogTitle>
            <DialogDescription>
              {detalle.nombre} tiene instrumentos con datos de mercado más recientes que el snapshot con el
              que fue armado, y todavía no revisaste la comparación. Podés ver qué cambió antes de decidir,
              o simular igual con los valores del snapshot actual.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => navigate(`/portfolios/${idPortfolio}/comparar-mercado`)}>
              Ver comparación
            </Button>
            <Button onClick={handleConfirmarConSnapshot} disabled={lanzarSimulacion.isPending}>
              Simular con el snapshot actual
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
