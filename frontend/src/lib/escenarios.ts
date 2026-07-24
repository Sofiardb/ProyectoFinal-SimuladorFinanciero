/** Clases Tailwind para el "pill" de color por escenario económico (fondo claro + texto legible
 * del mismo tono) — usado en Resultados, Comparar y Rangos de inflación (Nueva Simulación). */
export const ESCENARIO_BADGE: Record<string, string> = {
  favorable: 'bg-favorable-bg text-favorable-badge',
  moderado: 'bg-moderado-bg text-moderado-badge',
  desfavorable: 'bg-desfavorable-bg text-desfavorable-badge',
}
