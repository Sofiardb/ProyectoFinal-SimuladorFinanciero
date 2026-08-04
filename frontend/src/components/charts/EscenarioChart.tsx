import { Area, CartesianGrid, ComposedChart, Legend, Line, ReferenceArea, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'

export interface SerieEscenario {
  key:     string
  label:   string
  color:   string
  media:   number[]
  p25?:    number[]
  p75?:    number[]
  minimo?: number[]
  maximo?: number[]
  /** Overlay nominal-vs-real (idea 4): segunda línea entera (no punteada — con color propio ya se
   * distingue de la principal), mismo ámbito. p25/p75 propios para que el overlay muestre la banda
   * de las dos series, no solo de la principal. */
  mediaSecundaria?: number[]
  labelSecundaria?: string
  colorSecundaria?: string
  p25Secundaria?: number[]
  p75Secundaria?: number[]
}

export interface VencimientoMarcador {
  mes:   number
  label: string
}

/** Línea de referencia horizontal ("punto de equilibrio"): monto invertido para patrimonio, 0 para
 * las métricas de ganancia. Solo tiene sentido con un único ámbito seleccionado. Sin texto propio
 * en el gráfico (generaba ruido visual) — es una referencia muda, como la grilla. */
export interface BreakevenMarcador {
  valor: number
}

interface EscenarioChartProps {
  series:        SerieEscenario[]
  /** Modo B (un solo escenario/instrumento): banda p25-p75 + mín/máx tenues. Modo A: solo medias. */
  mostrarBanda:  boolean
  /** Independiente de `mostrarBanda` — se apaga en el overlay nominal-vs-real: con dos líneas más
   * la banda ya es suficiente, agregar también mín/máx (que solo describe una de las dos) satura
   * el gráfico. Por defecto sigue a `mostrarBanda` para no romper otros usos. */
  mostrarMinMax?: boolean
  formatY:       (v: number) => string
  height?:       number | `${number}%`
  /** Línea vertical punteada por cada instrumento que vence dentro del horizonte — a partir de ahí
   * su "ganancia real" queda congelada (docs/02, congelamiento del deflactor al vencimiento). */
  vencimientos?: VencimientoMarcador[]
  breakeven?:    BreakevenMarcador
}

type FilaChart = { mes: number } & Record<string, number | [number, number]>

/**
 * Gráfico compartido por Resultados y Comparar (docs de diseño "graficos-decisiones"):
 * Modo A = varias líneas de media sin banda; Modo B = 1 serie con banda p25-p75 sombreada
 * y mín/máx como líneas tenues. Paleta de escenario (favorable/moderado/desfavorable) fijada
 * por el proyecto — validada colorblind-safe, ver dataviz skill.
 */
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
  const data: FilaChart[] = Array.from({ length: T }, (_, mes) => {
    const fila: FilaChart = { mes }
    for (const s of series) {
      fila[`${s.key}_media`] = s.media[mes]
      if (s.mediaSecundaria != null) fila[`${s.key}_secundaria`] = s.mediaSecundaria[mes]
      if (mostrarBanda && s.p25 != null && s.p75 != null) {
        fila[`${s.key}_banda`] = [s.p25[mes], s.p75[mes]]
      }
      if (mostrarBanda && s.p25Secundaria != null && s.p75Secundaria != null) {
        fila[`${s.key}_bandaSecundaria`] = [s.p25Secundaria[mes], s.p75Secundaria[mes]]
      }
      if (mostrarMinMax && s.minimo != null) fila[`${s.key}_minimo`] = s.minimo[mes]
      if (mostrarMinMax && s.maximo != null) fila[`${s.key}_maximo`] = s.maximo[mes]
    }
    return fila
  })

  // Vencimientos cercanos en el tiempo chocan si sus etiquetas van todas a la misma altura —
  // se intercalan en 3 filas (ordenados por mes) para que no se pisen entre sí.
  const vencimientosOrdenados = [...(vencimientos ?? [])].sort((a, b) => a.mes - b.mes)
  const FILAS_ETIQUETA = 3
  const ALTO_ETIQUETA = 11
  const marginTop = vencimientosOrdenados.length > 0 ? 8 + FILAS_ETIQUETA * ALTO_ETIQUETA : 8

  // Zona "capital parado": desde cada vencimiento hasta el próximo (o el final del horizonte).
  // Relleno uniforme — no tenemos acá el peso en $ de cada instrumento para variar la opacidad.
  const zonasVencidas = vencimientosOrdenados.map((v, i) => ({
    desde: v.mes,
    hasta: vencimientosOrdenados[i + 1]?.mes ?? T - 1,
  }))

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
        <Tooltip
          content={({ active, label, payload }) => {
            if (!active || !payload) return null
            const relevantes = payload.filter(
              (p) => typeof p.dataKey === 'string' && (p.dataKey.endsWith('_media') || p.dataKey.endsWith('_secundaria')),
            )
            if (relevantes.length === 0) return null
            return (
              <div
                role="status"
                aria-live="assertive"
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
                  const esSecundaria = typeof p.dataKey === 'string' && p.dataKey.endsWith('_secundaria')
                  const serie = series.find((s) => p.dataKey === `${s.key}_${esSecundaria ? 'secundaria' : 'media'}`)
                  const nombre = esSecundaria ? serie?.labelSecundaria : serie?.label
                  return (
                    <p key={String(p.dataKey)} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span style={{ display: 'inline-block', width: 10, height: 2, background: p.color }} />
                      <strong>{formatY(p.value as number)}</strong>
                      <span style={{ color: 'var(--color-ink-soft)' }}>{nombre}</span>
                    </p>
                  )
                })}
              </div>
            )
          }}
        />
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
        {/* Banda de la serie secundaria del overlay (idea 4) — sin nombre propio en la leyenda,
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
