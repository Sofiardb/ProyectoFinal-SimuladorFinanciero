import { type ReactNode, useMemo } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { Skeleton } from '@/components/ui/skeleton'
import PerfilBadge from '@/components/portfolios/PerfilBadge'
import InflacionChart from '@/components/charts/InflacionChart'
import KpiCard from '@/components/simulaciones/KpiCard'
import PanelGraficoResultados from '@/components/simulaciones/PanelGraficoResultados'
import { useTodasLasSimulaciones, type SimulacionConPortfolio } from '@/api/hooks'
import { useResultadosSimulacionView, type ResultadosSimulacionView } from '@/hooks/useResultadosSimulacionView'
import { formatFecha, formatMoneda, formatPorcentaje } from '@/lib/format'
import type { InstrumentoSimulacion, PortfolioDetalle, ResultadoSimulacionRow, SimulacionDetalle } from '@/types'

function ultimo(v: number[] | undefined): number | undefined {
  return v && v.length > 0 ? v[v.length - 1] : undefined
}

interface Grupo {
  idPortfolio:     number
  nombrePortfolio: string
  items:           SimulacionConPortfolio[]
}

/** Selector de simulación para un lado (A o B) — arriba de todo, fija qué se compara en cada fila. */
function SelectorSimulacion({
  idSimulacion,
  onChange,
  grupos,
}: {
  idSimulacion: number | null
  onChange:     (id: number | null) => void
  grupos:       Grupo[]
}) {
  return (
    <select
      value={idSimulacion ?? ''}
      onChange={(e) => onChange(e.target.value ? Number(e.target.value) : null)}
      className="field-input"
    >
      <option value="">Elegí una simulación…</option>
      {grupos.map((g) => (
        <optgroup key={g.idPortfolio} label={g.nombrePortfolio}>
          {g.items.map((s) => (
            <option key={s.idSimulacion} value={s.idSimulacion}>
              {formatFecha(s.fechaEjecucion)} · {s.horizonteMeses} meses
            </option>
          ))}
        </optgroup>
      ))}
    </select>
  )
}

/** Encabezado con nombre de portfolio, perfil y fecha — arriba de cada columna. */
function CabeceraSimulacion({ view }: { view: ResultadosSimulacionView }) {
  if (view.isLoading) return <Skeleton className="h-6 w-40" />
  if (!view.sim || !view.detalle) return <p className="text-[13px] text-ink-soft">Elegí una simulación para ver el detalle.</p>
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="font-semibold text-navy-950">{view.detalle.nombre}</span>
      <PerfilBadge nombre={view.detalle.nombrePerfilRiesgo} />
      <span className="text-[11.5px] text-ink-soft">
        {formatFecha(view.sim.fechaEjecucion)} · {view.sim.horizonteMeses} meses
      </span>
    </div>
  )
}

/** Fila de comparación: mismo tipo de contenido para las dos simulaciones elegidas, una al lado
 * de la otra en desktop y apiladas en mobile (grid-cols-1 lg:grid-cols-2, igual que el resto de
 * la app) — así siempre se compara "lo mismo contra lo mismo" en la misma altura de página. */
function FilaComparacion({ children }: { children: [ReactNode, ReactNode] }) {
  return (
    <div className="mb-5 grid grid-cols-1 gap-4 lg:grid-cols-2">
      <div>{children[0]}</div>
      <div>{children[1]}</div>
    </div>
  )
}

/** Evita repetir loading/vacío en cada fila: solo llama a `children` cuando sim+filas están listos. */
function Columna({
  view,
  alto = 'h-40',
  children,
}: {
  view: ResultadosSimulacionView
  alto?: string
  children: (datos: {
    sim: SimulacionDetalle
    filas: ResultadoSimulacionRow[]
    detalle: PortfolioDetalle | undefined
    instrumentos: InstrumentoSimulacion[] | undefined
  }) => ReactNode
}) {
  if (view.isLoading) return <Skeleton className={`${alto} w-full`} />
  if (!view.sim || !view.filas) {
    return (
      <div className={`card flex ${alto} items-center justify-center text-center text-[13px] text-ink-soft`}>
        Elegí una simulación
      </div>
    )
  }
  return <>{children({ sim: view.sim, filas: view.filas, detalle: view.detalle, instrumentos: view.instrumentos })}</>
}

function ComparacionSimulaciones({ idA, idB }: { idA: number | null; idB: number | null }) {
  const viewA = useResultadosSimulacionView(idA ?? NaN)
  const viewB = useResultadosSimulacionView(idB ?? NaN)

  return (
    <>
      <FilaComparacion>
        <CabeceraSimulacion view={viewA} />
        <CabeceraSimulacion view={viewB} />
      </FilaComparacion>

      <FilaComparacion>
        <Columna view={viewA} alto="h-52">
          {({ sim, filas }) => <KpisComparacion sim={sim} filas={filas} view={viewA} />}
        </Columna>
        <Columna view={viewB} alto="h-52">
          {({ sim, filas }) => <KpisComparacion sim={sim} filas={filas} view={viewB} />}
        </Columna>
      </FilaComparacion>

      <FilaComparacion>
        <Columna view={viewA}>
          {({ filas, detalle, instrumentos }) => (
            <PanelGraficoResultados
              titulo="Portfolio"
              ambitosDisponibles={viewA.ambitosPortfolio}
              seleccionUnica
              moneda={viewA.monedaKpi}
              filas={filas}
              detalle={detalle}
              instrumentos={instrumentos}
              montoInvertidoDe={viewA.montoInvertidoDe}
            />
          )}
        </Columna>
        <Columna view={viewB}>
          {({ filas, detalle, instrumentos }) => (
            <PanelGraficoResultados
              titulo="Portfolio"
              ambitosDisponibles={viewB.ambitosPortfolio}
              seleccionUnica
              moneda={viewB.monedaKpi}
              filas={filas}
              detalle={detalle}
              instrumentos={instrumentos}
              montoInvertidoDe={viewB.montoInvertidoDe}
            />
          )}
        </Columna>
      </FilaComparacion>

      <FilaComparacion>
        <Columna view={viewA}>
          {({ filas, detalle, instrumentos }) => (
            <PanelGraficoResultados
              titulo="Instrumentos (ARS)"
              ambitosDisponibles={viewA.ambitosArs}
              seleccionUnica={false}
              moneda="ARS"
              filas={filas}
              detalle={detalle}
              instrumentos={instrumentos}
              montoInvertidoDe={viewA.montoInvertidoDe}
            />
          )}
        </Columna>
        <Columna view={viewB}>
          {({ filas, detalle, instrumentos }) => (
            <PanelGraficoResultados
              titulo="Instrumentos (ARS)"
              ambitosDisponibles={viewB.ambitosArs}
              seleccionUnica={false}
              moneda="ARS"
              filas={filas}
              detalle={detalle}
              instrumentos={instrumentos}
              montoInvertidoDe={viewB.montoInvertidoDe}
            />
          )}
        </Columna>
      </FilaComparacion>

      <FilaComparacion>
        <Columna view={viewA}>
          {({ filas, detalle, instrumentos }) => (
            <PanelGraficoResultados
              titulo="Instrumentos (USD)"
              ambitosDisponibles={viewA.ambitosUsd}
              seleccionUnica={false}
              moneda="USD"
              filas={filas}
              detalle={detalle}
              instrumentos={instrumentos}
              montoInvertidoDe={viewA.montoInvertidoDe}
            />
          )}
        </Columna>
        <Columna view={viewB}>
          {({ filas, detalle, instrumentos }) => (
            <PanelGraficoResultados
              titulo="Instrumentos (USD)"
              ambitosDisponibles={viewB.ambitosUsd}
              seleccionUnica={false}
              moneda="USD"
              filas={filas}
              detalle={detalle}
              instrumentos={instrumentos}
              montoInvertidoDe={viewB.montoInvertidoDe}
            />
          )}
        </Columna>
      </FilaComparacion>

      <FilaComparacion>
        <Columna view={viewA} alto="h-56">
          {() => (
            <InflacionChart
              mensualArs={viewA.mensualArs}
              mensualUsd={viewA.mensualUsd}
              acumuladaArs={viewA.acumuladaArs}
              acumuladaUsd={viewA.acumuladaUsd}
            />
          )}
        </Columna>
        <Columna view={viewB} alto="h-56">
          {() => (
            <InflacionChart
              mensualArs={viewB.mensualArs}
              mensualUsd={viewB.mensualUsd}
              acumuladaArs={viewB.acumuladaArs}
              acumuladaUsd={viewB.acumuladaUsd}
            />
          )}
        </Columna>
      </FilaComparacion>

      <FilaComparacion>
        <Columna view={viewA}>{() => <TablaPercentiles view={viewA} />}</Columna>
        <Columna view={viewB}>{() => <TablaPercentiles view={viewB} />}</Columna>
      </FilaComparacion>
    </>
  )
}

function KpisComparacion({ view }: { sim: SimulacionDetalle; filas: ResultadoSimulacionRow[]; view: ResultadosSimulacionView }) {
  return (
    <div className="grid grid-cols-2 gap-3">
      <KpiCard label="Monto invertido" value={view.montoInvertido != null ? formatMoneda(view.montoInvertido, view.monedaKpi) : '—'} />
      <KpiCard label="Valor final (mediana)" value={view.valorFinalMediana != null ? formatMoneda(view.valorFinalMediana, view.monedaKpi) : '—'} />
      <KpiCard
        label="Inflación acumulada (ARS)"
        value={view.inflacionAcumuladaArs != null ? formatPorcentaje((view.inflacionAcumuladaArs - 1) * 100) : '—'}
      />
      <KpiCard
        label="Inflación acumulada (USD)"
        value={view.inflacionAcumuladaUsd != null ? formatPorcentaje((view.inflacionAcumuladaUsd - 1) * 100) : '—'}
      />
    </div>
  )
}

function TablaPercentiles({ view }: { view: ResultadosSimulacionView }) {
  if (!view.gananciasRealesKpi || !view.patrimonioKpi) return null
  const patrimonio = view.patrimonioKpi
  const gananciasReales = view.gananciasRealesKpi
  return (
    <div className="card overflow-x-auto">
      <p className="card-section-label mb-3">Percentiles al final del horizonte ({view.labelDe(view.ambitoKpi ?? '')}, global)</p>
      <table className="w-full text-[12.5px]">
        <thead>
          <tr className="text-left text-ink-soft">
            <th className="pb-2 font-semibold">Percentil</th>
            <th className="pb-2 font-semibold">Patrimonio</th>
            <th className="pb-2 font-semibold">Ganancia real</th>
          </tr>
        </thead>
        <tbody>
          {(['p25', 'mediana', 'p75'] as const).map((p) => (
            <tr key={p} className="border-t border-line">
              <td className="py-2 font-semibold text-navy-950">{p === 'mediana' ? 'Mediana' : p.toUpperCase()}</td>
              <td className="py-2">{formatMoneda(ultimo(patrimonio[p]) ?? 0, view.monedaKpi)}</td>
              <td className="py-2">{formatMoneda(ultimo(gananciasReales[p]) ?? 0, view.monedaKpi)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export default function CompararPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const { data: simulaciones, isLoading } = useTodasLasSimulaciones()

  const idA = searchParams.get('a') ? Number(searchParams.get('a')) : null
  const idB = searchParams.get('b') ? Number(searchParams.get('b')) : null

  const grupos: Grupo[] = useMemo(() => {
    const mapa = new Map<number, Grupo>()
    for (const s of simulaciones) {
      if (!mapa.has(s.idPortfolio)) mapa.set(s.idPortfolio, { idPortfolio: s.idPortfolio, nombrePortfolio: s.nombrePortfolio, items: [] })
      mapa.get(s.idPortfolio)!.items.push(s)
    }
    return Array.from(mapa.values())
  }, [simulaciones])

  function setId(cual: 'a' | 'b', id: number | null) {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev)
      if (id == null) next.delete(cual)
      else next.set(cual, String(id))
      return next
    })
  }

  return (
    <div className="page-shell max-w-[1080px]">
      <div className="breadcrumb-nav">
        <Link to="/simulaciones" className="hover:text-navy-950">Historial</Link>
        <span>/</span>
        <span className="font-semibold text-navy-950">Comparar simulaciones</span>
      </div>

      <div className="mb-6">
        <h1 className="mb-1.5 font-display text-2xl leading-tight font-bold text-navy-950 xl:text-[26px]">
          Comparar simulaciones
        </h1>
        <p className="text-[13.5px] text-ink-muted">Elegí dos corridas (del mismo portfolio o de distintos) para ponerlas lado a lado.</p>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <Skeleton className="h-11 w-full" />
          <Skeleton className="h-11 w-full" />
        </div>
      ) : (
        <>
          <FilaComparacion>
            <SelectorSimulacion idSimulacion={idA} onChange={(id) => setId('a', id)} grupos={grupos} />
            <SelectorSimulacion idSimulacion={idB} onChange={(id) => setId('b', id)} grupos={grupos} />
          </FilaComparacion>

          <ComparacionSimulaciones idA={idA} idB={idB} />
        </>
      )}
    </div>
  )
}
