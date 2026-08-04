import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Skeleton } from '@/components/ui/skeleton'
import { SlowLoadingHint } from '@/components/ui/slow-loading-hint'
import TabList from '@/components/ui/tab-list'
import DeleteSimulacionDialog from '@/components/simulaciones/DeleteSimulacionDialog'
import HistorialEmptyState from '@/components/simulaciones/historial/HistorialEmptyState'
import HistorialTabla from '@/components/simulaciones/historial/HistorialTabla'
import CreateEditPortfolioDialog from '@/components/portfolios/CreateEditPortfolioDialog'
import {
  usePerfilesRiesgo,
  usePortfolios,
  usePortfoliosConInstrumentos,
  useTodasLasSimulaciones,
  type SimulacionConPortfolio,
} from '@/api/hooks'
import { formatFecha } from '@/lib/format'

export default function HistorialPage() {
  const { data: perfiles } = usePerfilesRiesgo()
  const { data: portfolios } = usePortfolios()
  const { data: portfoliosSimulables } = usePortfoliosConInstrumentos()
  const { data: simulaciones, isLoading } = useTodasLasSimulaciones()
  const [perfilFiltro, setPerfilFiltro] = useState<number | null>(null)
  const [seleccionadas, setSeleccionadas] = useState<number[]>([])
  const [aEliminar, setAEliminar] = useState<SimulacionConPortfolio | null>(null)
  const [crearOpen, setCrearOpen] = useState(false)
  const navigate = useNavigate()

  const filtradas = perfilFiltro == null ? simulaciones : simulaciones.filter((s) => s.idPerfilRiesgo === perfilFiltro)
  const sinPortfolios = (portfolios?.length ?? 0) === 0
  const sinSimulacionesEnAbsoluto = simulaciones.length === 0
  const perfilSeleccionado = perfiles?.find((p) => p.idPerfilRiesgo === perfilFiltro)
  const sinPortfolioDeEstePerfil =
    perfilFiltro != null && !(portfolios ?? []).some((p) => p.idPerfilRiesgo === perfilFiltro)
  const haySimulable =
    perfilFiltro == null
      ? portfoliosSimulables.length > 0
      : portfoliosSimulables.some((p) => p.idPerfilRiesgo === perfilFiltro)
  // Si estás en "Todos", Revisá tus portfolios te lleva a la pestaña Conservador por default.
  const idPerfilParaRevisar =
    perfilFiltro ?? perfiles?.find((p) => p.nombre.toLowerCase() === 'conservador')?.idPerfilRiesgo ?? perfiles?.[0]?.idPerfilRiesgo
  const linkRevisarPortfolios = idPerfilParaRevisar != null ? `/portfolios?perfil=${idPerfilParaRevisar}` : '/portfolios'

  const tabs = [
    { id: null, label: 'Todos' },
    ...(perfiles ?? []).map((p) => ({ id: p.idPerfilRiesgo, label: p.nombre })),
  ]

  function toggleSeleccion(idSimulacion: number) {
    setSeleccionadas((prev) => {
      if (prev.includes(idSimulacion)) return prev.filter((id) => id !== idSimulacion)
      if (prev.length >= 2) return prev
      return [...prev, idSimulacion]
    })
  }

  function comparar() {
    if (seleccionadas.length !== 2) return
    navigate(`/simulaciones/comparar?a=${seleccionadas[0]}&b=${seleccionadas[1]}`)
  }

  return (
    <div className="page-shell max-w-[1080px]">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="page-title mb-1.5">
            Historial de simulaciones
          </h1>
          <p className="text-[13.5px] text-ink-muted">Todas las corridas de tus portfolios, más recientes primero.</p>
        </div>
        <button
          data-tour="tour-comparar"
          onClick={comparar}
          disabled={seleccionadas.length !== 2}
          className="btn-primary"
        >
          Comparar ({seleccionadas.length}/2)
        </button>
      </div>

      <TabList
        idPrefix="historial"
        panelId="panel-historial"
        tabs={tabs}
        activeId={perfilFiltro}
        onChange={setPerfilFiltro}
        wrapperClassName="mb-5"
      />

      <div
        role="tabpanel"
        id="panel-historial"
        aria-labelledby={`tab-historial-${perfilFiltro ?? 'todos'}`}
      >
        {isLoading ? (
          <div className="space-y-3">
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
            <SlowLoadingHint isLoading={isLoading} />
          </div>
        ) : filtradas.length === 0 ? (
          <HistorialEmptyState
            sinPortfolios={sinPortfolios}
            sinPortfolioDeEstePerfil={sinPortfolioDeEstePerfil}
            sinSimulacionesEnAbsoluto={sinSimulacionesEnAbsoluto}
            haySimulable={haySimulable}
            perfilSeleccionado={perfilSeleccionado}
            linkRevisarPortfolios={linkRevisarPortfolios}
            onCrear={() => setCrearOpen(true)}
            onVerTodas={() => setPerfilFiltro(null)}
          />
        ) : (
          <HistorialTabla
            filas={filtradas}
            seleccionadas={seleccionadas}
            onToggleSeleccion={toggleSeleccion}
            onEliminar={setAEliminar}
          />
        )}
      </div>

      {aEliminar && (
        <DeleteSimulacionDialog
          open
          onOpenChange={(open) => !open && setAEliminar(null)}
          idSimulacion={aEliminar.idSimulacion}
          descripcion={`${aEliminar.nombrePortfolio} · ${formatFecha(aEliminar.fechaEjecucion)} · ${aEliminar.horizonteMeses} meses`}
          onDeleted={() => setAEliminar(null)}
        />
      )}

      <CreateEditPortfolioDialog
        open={crearOpen}
        onOpenChange={setCrearOpen}
        defaultPerfilId={perfilFiltro ?? undefined}
      />
    </div>
  )
}
