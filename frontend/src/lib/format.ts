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

/** Fecha de hoy en el huso horario local, formato YYYY-MM-DD (para atributos `min`/`value` de <input type="date">). */
export function hoyISO(): string {
  const d = new Date()
  const yyyy = d.getFullYear()
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${yyyy}-${mm}-${dd}`
}
