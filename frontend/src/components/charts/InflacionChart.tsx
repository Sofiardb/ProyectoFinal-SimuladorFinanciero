import { CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import GuiaResultadosTrigger from '@/components/simulaciones/GuiaResultadosTrigger'
import { ESCENARIOS_COLOR } from '@/lib/escenarios'
import { formatPorcentaje } from '@/lib/format'

export interface SerieInflacionPorEscenario {
  favorable:    number[]
  moderado:     number[]
  desfavorable: number[]
}

interface MiniChartProps {
  titulo: string
  datos:  SerieInflacionPorEscenario
}

function MiniChart({ titulo, datos }: MiniChartProps) {
  const T = datos.favorable.length
  const data = Array.from({ length: T }, (_, mes) => ({
    mes,
    favorable: datos.favorable[mes],
    moderado: datos.moderado[mes],
    desfavorable: datos.desfavorable[mes],
  }))

  return (
    <div>
      <p className="mb-1.5 text-[11.5px] font-semibold text-ink-soft">{titulo}</p>
      <ResponsiveContainer width="100%" height={200}>
        <LineChart data={data} margin={{ top: 4, right: 8, left: 4, bottom: 4 }}>
          <CartesianGrid stroke="var(--color-line)" vertical={false} />
          <XAxis
            dataKey="mes"
            tickLine={false}
            axisLine={{ stroke: 'var(--color-line)' }}
            tick={{ fontSize: 10, fill: 'var(--color-ink-soft)' }}
          />
          <YAxis
            tickLine={false}
            axisLine={false}
            tick={{ fontSize: 10, fill: 'var(--color-ink-soft)' }}
            tickFormatter={(v) => `${v.toFixed(1)}%`}
            width={40}
            domain={['auto', 'auto']}
          />
          <Tooltip
            formatter={(v) => formatPorcentaje(Number(v))}
            labelFormatter={(mes) => `Mes ${mes}`}
            contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid var(--color-line)' }}
          />
          <Legend
            wrapperStyle={{
              fontSize: 11,
              width: '100%',
              display: 'flex',
              flexWrap: 'wrap',
              justifyContent: 'center',
              gap: '4px 10px',
            }}
          />
          {ESCENARIOS_COLOR.map((e) => (
            <Line
              key={e.key}
              name={e.label}
              dataKey={e.key}
              stroke={e.color}
              strokeWidth={2}
              dot={false}
              isAnimationActive={false}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}

interface InflacionChartProps {
  mensualArs:    SerieInflacionPorEscenario
  mensualUsd:    SerieInflacionPorEscenario
  acumuladaArs:  SerieInflacionPorEscenario
  acumuladaUsd:  SerieInflacionPorEscenario
  onAbrirGuia?:  () => void
}

export default function InflacionChart({ mensualArs, mensualUsd, acumuladaArs, acumuladaUsd, onAbrirGuia }: InflacionChartProps) {
  if (mensualArs.favorable.length === 0) return null

  return (
    <div className="card mb-5" data-guia="grafico-inflacion">
      <p className="card-section-label mb-3 flex items-center gap-1">
        Inflación por escenario
        {onAbrirGuia && <GuiaResultadosTrigger onClick={onAbrirGuia} />}
      </p>
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
        <MiniChart titulo="Mensual (ARS)" datos={mensualArs} />
        <MiniChart titulo="Mensual (USD)" datos={mensualUsd} />
        <MiniChart titulo="Acumulada (ARS)" datos={acumuladaArs} />
        <MiniChart titulo="Acumulada (USD)" datos={acumuladaUsd} />
      </div>
    </div>
  )
}
