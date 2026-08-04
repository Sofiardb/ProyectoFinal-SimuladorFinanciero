import type { TooltipContentProps } from 'recharts'
import type { SerieEscenario } from '@/lib/escenarioChartData'

interface Props extends TooltipContentProps {
  series: SerieEscenario[]
  formatY: (v: number) => string
}

export default function EscenarioTooltip({ active, label, payload, series, formatY }: Props) {
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
}
