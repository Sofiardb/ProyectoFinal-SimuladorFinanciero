import { Link, useParams } from 'react-router-dom'
import { Skeleton } from '@/components/ui/skeleton'
import InflacionChart from '@/components/charts/InflacionChart'
import KpiCard from '@/components/simulaciones/KpiCard'
import PanelGraficoResultados from '@/components/simulaciones/PanelGraficoResultados'
import { useResultadosSimulacionView } from '@/hooks/useResultadosSimulacionView'
import { ESCENARIO_BADGE } from '@/lib/escenarios'
import { formatFecha, formatMoneda, formatPorcentaje } from '@/lib/format'

function ultimo(v: number[] | undefined): number | undefined {
  return v && v.length > 0 ? v[v.length - 1] : undefined
}

export default function ResultadosPage() {
  const { id } = useParams<{ id: string }>()
  const idSimulacion = Number(id)
  const v = useResultadosSimulacionView(idSimulacion)

  if (v.isLoading) {
    return (
      <div className="page-shell max-w-[960px] space-y-4">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-80 w-full" />
      </div>
    )
  }

  if (!v.sim || !v.filas) {
    return (
      <div className="page-shell max-w-[960px] text-center">
        <p className="text-ink-muted">No se encontró la simulación.</p>
        <Link to="/simulaciones" className="mt-2 inline-block text-sm font-medium text-navy-950 underline">
          Volver al historial
        </Link>
      </div>
    )
  }

  const { sim, filas, detalle, instrumentos } = v

  return (
    <div className="page-shell max-w-[1080px]">
      <div className="breadcrumb-nav">
        <Link to="/portfolios" className="hover:text-navy-950">Portfolios</Link>
        <span>/</span>
        {detalle && (
          <>
            <Link to={`/portfolios/${detalle.idPortfolio}`} className="hover:text-navy-950">{detalle.nombre}</Link>
            <span>/</span>
          </>
        )}
        <span className="font-semibold text-navy-950">Resultados</span>
      </div>

      <div className="mb-6">
        <h1 className="mb-1.5 font-display text-2xl leading-tight font-bold text-navy-950 xl:text-[26px]">
          Resultados de la simulación
        </h1>
        <p className="text-[13.5px] text-ink-muted">
          {formatFecha(sim.fechaEjecucion)} · Horizonte {sim.horizonteMeses} meses
        </p>
      </div>

      <div className="mb-5 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard label="Monto invertido" value={v.montoInvertido != null ? formatMoneda(v.montoInvertido, v.monedaKpi) : '—'} />
        <KpiCard label="Valor final (mediana)" value={v.valorFinalMediana != null ? formatMoneda(v.valorFinalMediana, v.monedaKpi) : '—'} />
        <KpiCard
          label="Inflación acumulada (ARS)"
          value={v.inflacionAcumuladaArs != null ? formatPorcentaje((v.inflacionAcumuladaArs - 1) * 100) : '—'}
          tooltip={{ term: 'Inflación acumulada (ARS)', definition: 'Mediana de la inflación acumulada simulada en pesos a lo largo del horizonte, escenario global.' }}
        />
        <KpiCard
          label="Inflación acumulada (USD)"
          value={v.inflacionAcumuladaUsd != null ? formatPorcentaje((v.inflacionAcumuladaUsd - 1) * 100) : '—'}
          tooltip={{ term: 'Inflación acumulada (USD)', definition: 'Mediana de la inflación acumulada simulada en dólares a lo largo del horizonte, escenario global.' }}
        />
      </div>

      <div className="mb-5 flex flex-wrap justify-center gap-4">
        <div className="w-full lg:w-[calc(50%-0.5rem)]">
          <PanelGraficoResultados
            titulo="Portfolio"
            ambitosDisponibles={v.ambitosPortfolio}
            seleccionUnica
            moneda={v.monedaKpi}
            filas={filas}
            detalle={detalle}
            instrumentos={instrumentos}
          />
        </div>
        <div className="w-full lg:w-[calc(50%-0.5rem)]">
          <PanelGraficoResultados
            titulo="Instrumentos (ARS)"
            ambitosDisponibles={v.ambitosArs}
            seleccionUnica={false}
            moneda="ARS"
            filas={filas}
            detalle={detalle}
            instrumentos={instrumentos}
          />
        </div>
        <div className="w-full lg:w-[calc(50%-0.5rem)]">
          <PanelGraficoResultados
            titulo="Instrumentos (USD)"
            ambitosDisponibles={v.ambitosUsd}
            seleccionUnica={false}
            moneda="USD"
            filas={filas}
            detalle={detalle}
            instrumentos={instrumentos}
          />
        </div>
      </div>

      <InflacionChart mensualArs={v.mensualArs} mensualUsd={v.mensualUsd} acumuladaArs={v.acumuladaArs} acumuladaUsd={v.acumuladaUsd} />

      {v.gananciasRealesKpi && v.patrimonioKpi && (
        <div className="card mb-5 overflow-x-auto">
          <p className="card-section-label mb-3">Percentiles al final del horizonte ({v.labelDe(v.ambitoKpi ?? '')}, global)</p>
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
                  <td className="py-2">{formatMoneda(ultimo(v.patrimonioKpi![p]) ?? 0, v.monedaKpi)}</td>
                  <td className="py-2">{formatMoneda(ultimo(v.gananciasRealesKpi![p]) ?? 0, v.monedaKpi)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {sim.parametrosEscenario.length > 0 && (
        <div className="card">
          <p className="card-section-label mb-3">Rangos de inflación usados en esta corrida</p>
          <div className="flex flex-col gap-3">
            {sim.parametrosEscenario.map((p) => (
              <div
                key={p.idTipoEscenario}
                className="flex flex-col gap-1.5 border-b border-line pb-3 text-[12.5px] last:border-0 last:pb-0 sm:flex-row sm:items-center sm:justify-between sm:gap-3"
              >
                <span
                  className={`inline-flex w-fit items-center rounded-full px-2.5 py-1 text-[11.5px] font-bold capitalize ${
                    ESCENARIO_BADGE[p.nombreTipoEscenario.toLowerCase()] ?? 'bg-line-soft text-ink-muted'
                  }`}
                >
                  {p.nombreTipoEscenario}
                </span>
                <span className="flex flex-wrap gap-x-3 gap-y-0.5 text-ink-muted">
                  <span>ARS {formatPorcentaje(p.inflacionMensualMin * 100)} – {formatPorcentaje(p.inflacionMensualMax * 100)}</span>
                  <span>USD {formatPorcentaje(p.inflacionMensualMinUsd * 100)} – {formatPorcentaje(p.inflacionMensualMaxUsd * 100)}</span>
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
