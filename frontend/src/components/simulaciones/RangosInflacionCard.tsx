import InfoTooltip from '@/components/portfolios/InfoTooltip'
import { useEscenariosEconomicos } from '@/api/hooks'
import { ESCENARIO_BADGE } from '@/lib/escenarios'
import { formatPorcentaje } from '@/lib/format'

const LABEL_POR_ESCENARIO: Record<string, string> = {
  favorable: 'Favorable',
  moderado: 'Moderado',
  desfavorable: 'Desfavorable',
}

/**
 * Rangos de inflación mensual por escenario — de solo lectura. El prototipo los muestra como inputs
 * editables, pero no hay override por corrida en el backend (docs/09 §4): escenario_economico es una
 * tabla de configuración global de admin. Mismo espíritu pasivo que TipoCambioIndicator.
 */
export default function RangosInflacionCard() {
  const { data: escenarios, isLoading } = useEscenariosEconomicos()

  if (isLoading || !escenarios || escenarios.length === 0) return null

  const ordenados = [...escenarios].sort((a, b) => a.idEscenarioEconomico - b.idEscenarioEconomico)

  return (
    <div className="card mb-5">
      <p className="card-section-label mb-3 flex items-center gap-1">
        Rangos de inflación mensual por escenario
        <InfoTooltip
          term="Rangos de inflación"
          definition="Cada simulación corre los tres escenarios en paralelo con estos rangos, configurados a nivel de plataforma. No se pueden editar por corrida individual."
        />
      </p>
      <div className="flex flex-col gap-3">
        {ordenados.map((e) => (
          <div
            key={e.idEscenarioEconomico}
            className="flex flex-col gap-1.5 border-b border-line pb-3 text-[12.5px] last:border-0 last:pb-0 sm:flex-row sm:items-center sm:justify-between sm:gap-3"
          >
            <span
              className={`inline-flex w-fit items-center rounded-full px-2.5 py-1 text-[11.5px] font-bold ${
                ESCENARIO_BADGE[e.nombreEscenario] ?? 'bg-line-soft text-ink-muted'
              }`}
            >
              {LABEL_POR_ESCENARIO[e.nombreEscenario] ?? e.nombreEscenario}
            </span>
            <span className="flex flex-wrap gap-x-3 gap-y-0.5">
              <span className="font-semibold text-navy-950">
                ARS {formatPorcentaje(e.inflacionMensualMin * 100)} – {formatPorcentaje(e.inflacionMensualMax * 100)}
              </span>
              <span className="text-ink-soft">
                USD {formatPorcentaje(e.inflacionMensualMinUsd * 100)} – {formatPorcentaje(e.inflacionMensualMaxUsd * 100)}
              </span>
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}
