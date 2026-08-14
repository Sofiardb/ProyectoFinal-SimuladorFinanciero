import { Area, CartesianGrid, ComposedChart, Legend, Line, ReferenceArea, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import EscenarioTooltip from '@/components/charts/EscenarioTooltip'
import { buildChartData, computeMarginTop, computeZonasVencidas, ordenarVencimientos } from '@/lib/escenarioChartData'
import type { BreakevenMarcador, SerieEscenario, VencimientoMarcador } from '@/lib/escenarioChartData'

export type { SerieEscenario, VencimientoMarcador, BreakevenMarcador }

interface EscenarioChartProps {
  series:        SerieEscenario[]
  /** Modo B (un solo escenario/instrumento): banda p25-p75 + mín/máx tenues. Modo A: solo medias. */
  mostrarBanda:  boolean
  /** Independiente de `mostrarBanda` — se apaga en el overlay nominal-vs-real: con dos líneas más
   * la banda ya es suficiente, agregar también mín/máx satura
   * el gráfico. Por defecto sigue a `mostrarBanda` para no romper otros usos. */
  mostrarMinMax?: boolean
  formatY:       (v: number) => string
  height?:       number | `${number}%`
  vencimientos?: VencimientoMarcador[]
  breakeven?:    BreakevenMarcador
}

export default function EscenarioChart({
  series,
  mostrarBanda,
  mostrarMinMax = mostrarBanda,
  formatY,
  height = 280,
  vencimientos,
  breakeven,
}: EscenarioChartProps) {
  if (series.length === 0 || series[0].media.length === 0) return null

  const T = series[0].media.length
  const hayOverlay = series.some((s) => s.mediaSecundaria != null)
  const data = buildChartData(series, mostrarBanda, mostrarMinMax)

  const vencimientosOrdenados = ordenarVencimientos(vencimientos)
  const marginTop = computeMarginTop(vencimientosOrdenados.length)
  const zonasVencidas = computeZonasVencidas(vencimientosOrdenados, T)
  const FILAS_ETIQUETA = 3

  return (
    <ResponsiveContainer width="100%" height={height}>
      <ComposedChart data={data} margin={{ top: marginTop, right: 12, left: 4, bottom: 4 }}>
        <CartesianGrid stroke="var(--color-line)" vertical={false} />

        {zonasVencidas.map((z) => (
          <ReferenceArea
            key={`zona-${z.desde}`}
            x1={z.desde}
            x2={z.hasta}
            fill="var(--color-ink-soft)"
            fillOpacity={0.06}
            ifOverflow="visible"
          />
        ))}
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
        <Tooltip content={(props) => <EscenarioTooltip {...props} series={series} formatY={formatY} />} />
        {(series.length > 1 || hayOverlay || mostrarBanda) && (
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
          const texto = v.monto != null ? `${v.label} (${formatY(v.monto)} en caja libre)` : v.label
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
                  y={marginTop - 4 - fila * 11}
                  textAnchor="middle"
                  fontSize={9}
                  fill="var(--color-ink-soft)"
                >
                  {texto}
                </text>
              )}
            />
          )
        })}

        {breakeven && (
          <ReferenceLine y={breakeven.valor} stroke="var(--color-ink-soft)" strokeDasharray="3 3" strokeWidth={1} />
        )}

        {/* Nombrada y con entrada propia en la leyenda (a diferencia de mín/máx, que quedan mudos)
            para que quede claro a qué franja del gráfico se refiere — antes era un ícono de ayuda
            suelto en la fila de controles, sin ninguna conexión visual con la banda sombreada. */}
        {mostrarBanda &&
          series.map((s) => (
            <Area
              key={`${s.key}-banda`}
              name="Rango p25–p75"
              dataKey={`${s.key}_banda`}
              stroke="none"
              fill={s.color}
              fillOpacity={0.12}
              isAnimationActive={false}
              legendType="square"
            />
          ))}
        {/* Banda de la serie secundaria del overlay — sin nombre propio en la leyenda,
            ya la identifican los colores de las dos líneas de arriba (Nominal/Real). */}
        {mostrarBanda &&
          series
            .filter((s) => s.p25Secundaria != null && s.p75Secundaria != null)
            .map((s) => (
              <Area
                key={`${s.key}-banda-secundaria`}
                dataKey={`${s.key}_bandaSecundaria`}
                stroke="none"
                fill={s.colorSecundaria ?? s.color}
                fillOpacity={0.12}
                isAnimationActive={false}
                legendType="none"
              />
            ))}
        {/* Color propio (gris neutro, no s.color) para no confundirse con el nominal/nominal-real
            del overlay: mín/máx describe el rango de TODAS las simulaciones, no una serie puntual. */}
        {mostrarMinMax &&
          series.map((s) => (
            <Line
              key={`${s.key}-minimo`}
              dataKey={`${s.key}_minimo`}
              stroke="var(--color-ink-soft)"
              strokeOpacity={0.5}
              strokeWidth={1}
              dot={false}
              isAnimationActive={false}
              legendType="none"
            />
          ))}
        {/* Nombrada solo esta (no la de mínimo, que va pareja) para que el par tenue mín/máx tenga
            una única entrada en la leyenda — antes ninguna de las dos tenía nombre y no había forma
            de saber qué eran esas líneas tenues que se abren mucho más que la banda p25–p75. */}
        {mostrarMinMax &&
          series.map((s) => (
            <Line
              key={`${s.key}-maximo`}
              name="Mín–máx simulado"
              dataKey={`${s.key}_maximo`}
              stroke="var(--color-ink-soft)"
              strokeOpacity={0.5}
              strokeWidth={1}
              dot={false}
              isAnimationActive={false}
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

        {series
          .filter((s) => s.mediaSecundaria != null)
          .map((s) => (
            <Line
              key={`${s.key}-secundaria`}
              name={s.labelSecundaria}
              dataKey={`${s.key}_secundaria`}
              stroke={s.colorSecundaria ?? s.color}
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
