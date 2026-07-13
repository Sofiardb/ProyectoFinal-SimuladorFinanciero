export function formatMoneda(value: number, codigoMoneda: string): string {
  return new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency: codigoMoneda,
    maximumFractionDigits: 2,
  }).format(value)
}

export function formatPorcentaje(value: number): string {
  return `${value.toFixed(1)}%`
}

export function formatFecha(iso: string): string {
  return new Intl.DateTimeFormat('es-AR', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(new Date(iso))
}
