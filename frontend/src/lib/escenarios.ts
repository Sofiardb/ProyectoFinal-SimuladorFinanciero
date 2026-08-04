import type { EscenarioNombre } from '@/types'

export const ESCENARIO_BADGE: Record<string, string> = {
  favorable: 'bg-favorable-bg text-favorable-badge',
  moderado: 'bg-moderado-bg text-moderado-badge',
  desfavorable: 'bg-desfavorable-bg text-desfavorable-badge',
}

export const ESCENARIOS_COLOR: { key: EscenarioNombre; label: string; color: string }[] = [
  { key: 'favorable', label: 'Favorable', color: 'var(--color-favorable)' },
  { key: 'moderado', label: 'Moderado', color: 'var(--color-moderado)' },
  { key: 'desfavorable', label: 'Desfavorable', color: 'var(--color-desfavorable)' },
]
