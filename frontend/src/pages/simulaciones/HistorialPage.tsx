import { useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Skeleton } from '@/components/ui/skeleton'
import { SlowLoadingHint } from '@/components/ui/slow-loading-hint'
import PerfilBadge from '@/components/portfolios/PerfilBadge'
import ValorPorMoneda from '@/components/simulaciones/ValorPorMoneda'
import DeleteSimulacionDialog from '@/components/simulaciones/DeleteSimulacionDialog'
import { usePerfilesRiesgo, usePortfolios, useTodasLasSimulaciones, type SimulacionConPortfolio } from '@/api/hooks'
import { tabListArrowTarget } from '@/lib/a11y'
import { formatFecha, formatMoneda, formatPorcentaje } from '@/lib/format'
import { cn } from '@/lib/utils'

export default function HistorialPage() {
  const { data: perfiles } = usePerfilesRiesgo()
  const { data: portfolios } = usePortfolios()
  const { data: simulaciones, isLoading } = useTodasLasSimulaciones()
  const [perfilFiltro, setPerfilFiltro] = useState<number | null>(null)
  const [seleccionadas, setSeleccionadas] = useState<number[]>([])
  const [aEliminar, setAEliminar] = useState<SimulacionConPortfolio | null>(null)
  const navigate = useNavigate()
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([])

  const filtradas = perfilFiltro == null ? simulaciones : simulaciones.filter((s) => s.idPerfilRiesgo === perfilFiltro)
  const sinPortfolios = (portfolios?.length ?? 0) === 0
  const sinSimulacionesEnAbsoluto = simulaciones.length === 0
  const perfilSeleccionado = perfiles?.find((p) => p.idPerfilRiesgo === perfilFiltro)

  const tabs: { id: number | null; label: string }[] = [
    { id: null, label: 'Todos' },
    ...(perfiles ?? []).map((p) => ({ id: p.idPerfilRiesgo, label: p.nombre })),
  ]

  const handleTabKeyDown = (e: React.KeyboardEvent<HTMLButtonElement>, index: number) => {
    const target = tabListArrowTarget(e.key, index, tabs.length)
    if (target === null) return
    e.preventDefault()
    setPerfilFiltro(tabs[target].id)
    tabRefs.current[target]?.focus()
  }

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

      <div className="-mx-4 mb-5 overflow-x-auto px-4 sm:mx-0 sm:px-0">
        <div role="tablist" className="flex gap-2 border-b-[1.5px] border-line">
          {tabs.map((tab, index) => {
            const isActive = perfilFiltro === tab.id
            return (
              <button
                key={tab.id ?? 'todos'}
                ref={(el) => {
                  tabRefs.current[index] = el
                }}
                id={`tab-historial-${tab.id ?? 'todos'}`}
                role="tab"
                type="button"
                aria-selected={isActive}
                aria-controls="panel-historial"
                tabIndex={isActive ? 0 : -1}
                onClick={() => setPerfilFiltro(tab.id)}
                onKeyDown={(e) => handleTabKeyDown(e, index)}
                className={cn(
                  'shrink-0 cursor-pointer rounded-sm border-b-[2.5px] border-transparent px-1.5 pb-3.5 font-display text-[14.5px] font-semibold whitespace-nowrap outline-none capitalize transition-colors focus-visible:ring-3 focus-visible:ring-ring/50',
                  isActive ? 'border-navy-950 text-navy-950' : 'text-ink-soft hover:text-navy-950',
                )}
              >
                {tab.label}
              </button>
            )
          })}
        </div>
      </div>

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
          <div className="fade-in-content card text-[13.5px] text-ink-muted">
            {sinPortfolios ? (
              <>
                Todavía no tenés portfolios.{' '}
                <Link to="/portfolios" className="font-semibold text-navy-950 underline">
                  Creá uno
                </Link>{' '}
                para poder simular.
              </>
            ) : sinSimulacionesEnAbsoluto ? (
              <>
                Todavía no corriste ninguna simulación.{' '}
                <Link to="/simulaciones/nueva" className="font-semibold text-navy-950 underline">
                  Lanzá una
                </Link>
                .
              </>
            ) : (
              <>
                No tenés simulaciones con perfil{' '}
                <span className="font-semibold text-navy-950">{perfilSeleccionado?.nombre.toLowerCase() ?? 'seleccionado'}</span>
                .{' '}
                <Link to="/simulaciones/nueva" className="font-semibold text-navy-950 underline">
                  Lanzá una
                </Link>{' '}
                o{' '}
                <button
                  type="button"
                  onClick={() => setPerfilFiltro(null)}
                  className="font-semibold text-navy-950 underline"
                >
                  mirá todas
                </button>
                .
              </>
            )}
          </div>
        ) : (
          <div className="fade-in-content card overflow-x-auto p-0">
            <table className="w-full text-[12.5px]">
              <thead>
                <tr className="border-b border-line text-left text-ink-soft">
                  <th className="px-4 py-3 font-semibold"></th>
                  <th className="px-2 py-3 font-semibold">Portfolio</th>
                  <th className="px-2 py-3 font-semibold">Perfil</th>
                  <th className="px-2 py-3 font-semibold">Fecha</th>
                  <th className="px-2 py-3 font-semibold">Horizonte</th>
                  <th className="px-2 py-3 font-semibold">Valor final</th>
                  <th className="px-2 py-3 font-semibold">Retorno esperado</th>
                  <th className="px-4 py-3 font-semibold">Resultados</th>
                  <th className="px-4 py-3 font-semibold"></th>
                </tr>
              </thead>
              <tbody>
                {filtradas.map((s) => {
                  const marcada = seleccionadas.includes(s.idSimulacion)
                  const deshabilitada = !marcada && seleccionadas.length >= 2
                  return (
                    <tr key={s.idSimulacion} className="border-b border-line last:border-b-0">
                      <td className="px-4 py-3">
                        <input
                          type="checkbox"
                          checked={marcada}
                          disabled={deshabilitada}
                          onChange={() => toggleSeleccion(s.idSimulacion)}
                          aria-label={`Seleccionar simulación de ${s.nombrePortfolio} del ${formatFecha(s.fechaEjecucion)} para comparar`}
                        />
                      </td>
                      <td className="px-2 py-3 font-semibold text-navy-950">{s.nombrePortfolio}</td>
                      <td className="px-2 py-3"><PerfilBadge nombre={s.nombrePerfilRiesgo} /></td>
                      <td className="px-2 py-3 text-ink-muted">{formatFecha(s.fechaEjecucion)}</td>
                      <td className="px-2 py-3 text-ink-muted">{s.horizonteMeses} meses</td>
                      <td className="px-2 py-3 text-navy-950">
                        <ValorPorMoneda
                          combinado={s.valorEsperado}
                          ars={s.valorEsperadoArs}
                          usd={s.valorEsperadoUsd}
                          formatCombinado={(v) => formatMoneda(v, s.codigoMonedaBase)}
                          formatArs={(v) => formatMoneda(v, 'ARS')}
                          formatUsd={(v) => formatMoneda(v, 'USD')}
                        />
                      </td>
                      <td className="px-2 py-3 text-navy-950">
                        <ValorPorMoneda
                          combinado={s.retornoEsperadoPct != null ? s.retornoEsperadoPct * 100 : null}
                          ars={s.retornoEsperadoPctArs != null ? s.retornoEsperadoPctArs * 100 : null}
                          usd={s.retornoEsperadoPctUsd != null ? s.retornoEsperadoPctUsd * 100 : null}
                          formatCombinado={formatPorcentaje}
                          formatArs={formatPorcentaje}
                          formatUsd={formatPorcentaje}
                        />
                      </td>
                      <td className="px-4 py-3">
                        <Link to={`/simulaciones/${s.idSimulacion}`} className="font-semibold text-navy-950 hover:underline">
                          Ver →
                        </Link>
                      </td>
                      <td className="px-4 py-3">
                        <button
                          onClick={() => setAEliminar(s)}
                          className="font-semibold text-danger hover:underline"
                        >
                          Eliminar
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
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
    </div>
  )
}
