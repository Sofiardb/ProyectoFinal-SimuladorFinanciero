import { Fragment, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { Skeleton } from '@/components/ui/skeleton'
import { SlowLoadingHint } from '@/components/ui/slow-loading-hint'
import InflacionChart from '@/components/charts/InflacionChart'
import KpiCard from '@/components/simulaciones/KpiCard'
import PanelGraficoResultados from '@/components/simulaciones/PanelGraficoResultados'
import PercentilesPatrimonioTabla from '@/components/simulaciones/PercentilesPatrimonioTabla'
import DeleteSimulacionDialog from '@/components/simulaciones/DeleteSimulacionDialog'
import GuiaResultadosButton from '@/components/simulaciones/GuiaResultadosButton'
import GuiaResultadosSlot from '@/components/simulaciones/GuiaResultadosSlot'
import GuiaResultadosTrigger from '@/components/simulaciones/GuiaResultadosTrigger'
import { useResultadosSimulacionView } from '@/hooks/useResultadosSimulacionView'
import { useGuiaResultados } from '@/hooks/useGuiaResultados'
import { ESCENARIO_BADGE } from '@/lib/escenarios'
import { formatFecha, formatMoneda, formatPorcentaje } from '@/lib/format'
import { GUIA_RESULTADOS } from '@/lib/guiaResultados'

export default function ResultadosPage() {
  const { id } = useParams<{ id: string }>()
  const idSimulacion = Number(id)
  const v = useResultadosSimulacionView(idSimulacion)
  const navigate = useNavigate()
  const [deleteOpen, setDeleteOpen] = useState(false)
  const guia = useGuiaResultados(GUIA_RESULTADOS)

  if (v.isLoading) {
    return (
      <div className="page-shell max-w-[960px] space-y-4">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-80 w-full" />
        <SlowLoadingHint isLoading={v.isLoading} />
      </div>
    )
  }

  if (!v.sim || !v.filas) {
    return (
      <div className="page-shell max-w-[960px] text-center">
        <p className="text-ink-muted">No se encontró la simulación.</p>
        <Link to="/simulaciones" className="link-back-fallback">
          Volver al historial
        </Link>
      </div>
    )
  }

  const { sim, filas, detalle, instrumentos } = v
  const primerAmbitoConPercentiles = v.kpisPortfolio.find((k) => k.patrimonio && k.gananciasReales)?.ambito

  return (
    <div className="page-shell fade-in-content max-w-[1080px]">
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

      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="page-title mb-1.5">
            Resultados de la simulación
          </h1>
          <p className="text-[13.5px] text-ink-muted">
            {formatFecha(sim.fechaEjecucion)} · Horizonte {sim.horizonteMeses} meses
          </p>
        </div>
        <div className="flex items-center gap-2">
          <GuiaResultadosButton guia={guia} />
          <button onClick={() => setDeleteOpen(true)} className="btn-danger-outline">
            Eliminar simulación
          </button>
        </div>
      </div>

      <div className="mb-5 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {v.kpisPortfolio.map((k, i) => (
          <Fragment key={k.ambito}>
            <KpiCard
              label={v.kpisPortfolio.length > 1 ? `Monto invertido (${k.moneda})` : 'Monto invertido'}
              value={k.montoInvertido != null ? formatMoneda(k.montoInvertido, k.moneda) : '—'}
              dataGuia={i === 0 ? 'kpi-monto-invertido' : undefined}
              onAbrirGuia={i === 0 ? () => guia.iniciarEnSlot('kpis', 0) : undefined}
            />
            <KpiCard
              label={v.kpisPortfolio.length > 1 ? `Valor final (mediana) (${k.moneda})` : 'Valor final (mediana)'}
              value={k.valorFinalMediana != null ? formatMoneda(k.valorFinalMediana, k.moneda) : '—'}
              dataGuia={i === 0 ? 'kpi-valor-final' : undefined}
              onAbrirGuia={i === 0 ? () => guia.iniciarEnSlot('kpis', 1) : undefined}
            />
          </Fragment>
        ))}
        <KpiCard
          label="Inflación acumulada (ARS)"
          value={v.inflacionAcumuladaArs != null ? formatPorcentaje((v.inflacionAcumuladaArs - 1) * 100) : '—'}
          tooltip={{ term: 'Inflación acumulada (ARS)', definition: 'Mediana de la inflación acumulada simulada en pesos a lo largo del horizonte, escenario global.' }}
          dataGuia="kpi-inflacion-ars"
          onAbrirGuia={() => guia.iniciarEnSlot('kpis', 2)}
        />
        <KpiCard
          label="Inflación acumulada (USD)"
          value={v.inflacionAcumuladaUsd != null ? formatPorcentaje((v.inflacionAcumuladaUsd - 1) * 100) : '—'}
          tooltip={{ term: 'Inflación acumulada (USD)', definition: 'Mediana de la inflación acumulada simulada en dólares a lo largo del horizonte, escenario global.' }}
        />
      </div>

      <GuiaResultadosSlot guia={guia} slot="kpis" />

      <div className="mb-5 flex flex-col gap-4">
        <PanelGraficoResultados
          titulo="Portfolio"
          ambitosDisponibles={v.ambitosPortfolio}
          seleccionUnica
          moneda={v.kpisPortfolio[0]?.moneda ?? 'ARS'}
          filas={filas}
          detalle={detalle}
          instrumentos={instrumentos}
          montoInvertidoDe={v.montoInvertidoDe}
          guiaAnchors
          onAbrirGuia={() => guia.iniciarEnSlot('panel-portfolio')}
        />
        <GuiaResultadosSlot guia={guia} slot="panel-portfolio" />
        <PanelGraficoResultados
          titulo="Instrumentos (ARS)"
          ambitosDisponibles={v.ambitosArs}
          seleccionUnica={false}
          moneda="ARS"
          filas={filas}
          detalle={detalle}
          instrumentos={instrumentos}
          montoInvertidoDe={v.montoInvertidoDe}
          dataGuiaPanel="panel-instrumentos-ars"
          onAbrirGuia={() => guia.iniciarEnSlot('panel-instrumentos-ars')}
        />
        <GuiaResultadosSlot guia={guia} slot="panel-instrumentos-ars" />
        <PanelGraficoResultados
          titulo="Instrumentos (USD)"
          ambitosDisponibles={v.ambitosUsd}
          seleccionUnica={false}
          moneda="USD"
          filas={filas}
          detalle={detalle}
          instrumentos={instrumentos}
          montoInvertidoDe={v.montoInvertidoDe}
          dataGuiaPanel="panel-instrumentos-usd"
          onAbrirGuia={() => guia.iniciarEnSlot('panel-instrumentos-usd')}
        />
        <GuiaResultadosSlot guia={guia} slot="panel-instrumentos-usd" />
      </div>

      <InflacionChart
        mensualArs={v.mensualArs}
        mensualUsd={v.mensualUsd}
        acumuladaArs={v.acumuladaArs}
        acumuladaUsd={v.acumuladaUsd}
        onAbrirGuia={() => guia.iniciarEnSlot('grafico-inflacion')}
      />

      <GuiaResultadosSlot guia={guia} slot="grafico-inflacion" />

      {v.kpisPortfolio.some((k) => k.patrimonio && k.gananciasReales) && (
        <div className="mb-5 flex flex-col gap-3">
          {v.kpisPortfolio.map((k) => k.patrimonio && k.gananciasReales && (
            <PercentilesPatrimonioTabla
              key={k.ambito}
              titulo={`Percentiles al final del horizonte (${v.labelDe(k.ambito)}, global)`}
              moneda={k.moneda}
              patrimonio={k.patrimonio}
              gananciasReales={k.gananciasReales}
              dataGuia={k.ambito === primerAmbitoConPercentiles ? 'tabla-percentiles' : undefined}
              onAbrirGuia={k.ambito === primerAmbitoConPercentiles ? () => guia.iniciarEnSlot('tabla-percentiles') : undefined}
            />
          ))}
        </div>
      )}

      <GuiaResultadosSlot guia={guia} slot="tabla-percentiles" />

      {sim.parametrosEscenario.length > 0 && (
        <div className="card" data-guia="rangos-inflacion">
          <p className="card-section-label mb-3 flex items-center gap-1">
            Rangos de inflación usados en esta corrida
            <GuiaResultadosTrigger onClick={() => guia.iniciarEnSlot('rangos-inflacion')} />
          </p>
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

      <GuiaResultadosSlot guia={guia} slot="rangos-inflacion" />

      <DeleteSimulacionDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        idSimulacion={sim.idSimulacion}
        descripcion={`${formatFecha(sim.fechaEjecucion)} · Horizonte ${sim.horizonteMeses} meses`}
        onDeleted={() => navigate(detalle ? `/portfolios/${detalle.idPortfolio}` : '/simulaciones')}
      />
    </div>
  )
}
