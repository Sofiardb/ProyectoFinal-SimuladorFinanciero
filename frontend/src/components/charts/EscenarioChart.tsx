import { Area, CartesianGrid, ComposedChart, Legend, Line, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'

export interface SerieEscenario {
  key:     string
  label:   string
  color:   string
  media:   number[]
  p25?:    number[]
  p75?:    number[]
  minimo?: number[]
  maximo?: number[]
}

export interface VencimientoMarcador {
  mes:   number
  label: string
}

interface EscenarioChartProps {
  series:        SerieEscenario[]
  /** Modo B (un solo escenario/instrumento): banda p25-p75 + mín/máx tenues. Modo A: solo medias. */
  mostrarBanda:  boolean
  formatY:       (v: number) => string
  height?:       number | `${number}%`
  /** Línea vertical punteada por cada instrumento que vence dentro del horizonte — a partir de ahí
   * su "ganancia real" queda congelada (docs/02, congelamiento del deflactor al vencimiento). */
  vencimientos?: VencimientoMarcador[]
}

type FilaChart = { mes: number } & Record<string, number | [number, number]>

/**
 * Gráfico compartido por Resultados y Comparar (docs de diseño "graficos-decisiones"):
 * Modo A = varias líneas de media sin banda; Modo B = 1 serie con banda p25-p75 sombreada
 * y mín/máx como líneas tenues. Paleta de escenario (favorable/moderado/desfavorable) fijada
 * por el proyecto — validada colorblind-safe, ver dataviz skill.
 */
export default function EscenarioChart({ series, mostrarBanda, formatY, height = 280, vencimientos }: EscenarioChartProps) {
  if (series.length === 0 || series[0].media.length === 0) return null

  const T = series[0].media.length
  const data: FilaChart[] = Array.from({ length: T }, (_, mes) => {
    const fila: FilaChart = { mes }
    for (const s of series) {
      fila[`${s.key}_media`] = s.media[mes]
      if (mostrarBanda && s.p25 != null && s.p75 != null) {
        fila[`${s.key}_banda`] = [s.p25[mes], s.p75[mes]]
      }
      if (mostrarBanda && s.minimo != null) fila[`${s.key}_minimo`] = s.minimo[mes]
      if (mostrarBanda && s.maximo != null) fila[`${s.key}_maximo`] = s.maximo[mes]
    }
    return fila
  })

  // Vencimientos cercanos en el tiempo chocan si sus etiquetas van todas a la misma altura —
  // se intercalan en 3 filas (ordenados por mes) para que no se pisen entre sí.
  const vencimientosOrdenados = [...(vencimientos ?? [])].sort((a, b) => a.mes - b.mes)
  const FILAS_ETIQUETA = 3
  const ALTO_ETIQUETA = 11
  const marginTop = vencimientosOrdenados.length > 0 ? 8 + FILAS_ETIQUETA * ALTO_ETIQUETA : 8

  return (
    <ResponsiveContainer width="100%" height={height}>
      <ComposedChart data={data} margin={{ top: marginTop, right: 12, left: 4, bottom: 4 }}>
        <CartesianGrid stroke="var(--color-line)" vertical={false} />
        <XAxis
          dataKey="mes"
          tickLine={false}
          axisLine={{ stroke: 'var(--color-line)' }}
          tick={{ fontSize: 11, fill: 'var(--color-ink-soft)' }}
          label={{ value: 'Mes', position: 'insideBottom', offset: -2, fontSize: 11, fill: 'var(--color-ink-soft)' }}
        />
        <YAxis
          tickLine={false}
          axisLine={false}
          tick={{ fontSize: 11, fill: 'var(--color-ink-soft)' }}
          tickFormatter={formatY}
          width={72}
          domain={['auto', 'auto']}
        />
        <Tooltip
          content={({ active, label, payload }) => {
            if (!active || !payload) return null
            const relevantes = payload.filter((p) => typeof p.dataKey === 'string' && p.dataKey.endsWith('_media'))
            if (relevantes.length === 0) return null
            return (
              <div
                style={{
                  borderRadius: 8,
                  border: '1px solid var(--color-line)',
                  background: 'var(--color-card)',
                  padding: '8px 10px',
                  fontSize: 12,
                }}
              >
                <p style={{ marginBottom: 4, color: 'var(--color-ink-soft)' }}>Mes {label}</p>
                {relevantes.map((p) => {
                  const serie = series.find((s) => p.dataKey === `${s.key}_media`)
                  return (
                    <p key={String(p.dataKey)} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span style={{ display: 'inline-block', width: 10, height: 2, background: p.color }} />
                      <strong>{formatY(p.value as number)}</strong>
                      <span style={{ color: 'var(--color-ink-soft)' }}>{serie?.label}</span>
                    </p>
                  )
                })}
              </div>
            )
          }}
        />
        {series.length > 1 && (
          <Legend
            height={40}
            wrapperStyle={{
              fontSize: 12,
              width: '100%',
              display: 'flex',
              flexWrap: 'wrap',
              justifyContent: 'center',
              alignContent: 'flex-start',
              gap: '4px 12px',
              overflowY: 'auto',
            }}
          />
        )}

        {vencimientosOrdenados.map((v, i) => {
          const fila = i % FILAS_ETIQUETA
          return (
            <ReferenceLine
              key={`venc-${v.mes}-${v.label}`}
              x={v.mes}
              stroke="var(--color-ink-soft)"
              strokeDasharray="4 4"
              strokeWidth={1}
              label={(props: { viewBox?: { x?: number } }) => (
                <text
                  x={props.viewBox?.x ?? 0}
                  y={marginTop - 4 - fila * ALTO_ETIQUETA}
                  textAnchor="middle"
                  fontSize={9}
                  fill="var(--color-ink-soft)"
                >
                  {v.label}
                </text>
              )}
            />
          )
        })}

        {mostrarBanda &&
          series.map((s) => (
            <Area
              key={`${s.key}-banda`}
              dataKey={`${s.key}_banda`}
              stroke="none"
              fill={s.color}
              fillOpacity={0.12}
              isAnimationActive={false}
              legendType="none"
            />
          ))}
        {mostrarBanda &&
          series.map((s) => (
            <Line
              key={`${s.key}-minimo`}
              dataKey={`${s.key}_minimo`}
              stroke={s.color}
              strokeOpacity={0.35}
              strokeWidth={1}
              dot={false}
              isAnimationActive={false}
              legendType="none"
            />
          ))}
        {mostrarBanda &&
          series.map((s) => (
            <Line
              key={`${s.key}-maximo`}
              dataKey={`${s.key}_maximo`}
              stroke={s.color}
              strokeOpacity={0.35}
              strokeWidth={1}
              dot={false}
              isAnimationActive={false}
              legendType="none"
            />
          ))}

        {series.map((s) => (
          <Line
            key={`${s.key}-media`}
            name={s.label}
            dataKey={`${s.key}_media`}
            stroke={s.color}
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 4, strokeWidth: 2, stroke: 'var(--color-card)' }}
            isAnimationActive={false}
          />
        ))}
      </ComposedChart>
    </ResponsiveContainer>
  )
}
