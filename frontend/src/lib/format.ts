export function formatMoneda(value: number, codigoMoneda: string): string {
  return new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency: codigoMoneda,
    maximumFractionDigits: 2,
  }).format(value)
}

export function formatPorcentaje(value: number): string {
  return `${value.toFixed(2)}%`
}

export function formatFecha(iso: string): string {
  return new Intl.DateTimeFormat('es-AR', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(new Date(iso))
}

/** dd/mm/yyyy, a partir de una fecha ISO (YYYY-MM-DD o datetime). */
export function formatFechaCorta(iso: string): string {
  return new Intl.DateTimeFormat('es-AR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(new Date(iso))
}

/** "hoy" / "ayer" / "hace N días", a partir de una fecha ISO (YYYY-MM-DD o datetime). */
export function formatDiasDesde(iso: string): string {
  const fecha = new Date(iso)
  const hoy = new Date()
  const fechaUTC = Date.UTC(fecha.getFullYear(), fecha.getMonth(), fecha.getDate())
  const hoyUTC = Date.UTC(hoy.getFullYear(), hoy.getMonth(), hoy.getDate())
  const dias = Math.round((hoyUTC - fechaUTC) / 86_400_000)

  if (dias <= 0) return 'hoy'
  if (dias === 1) return 'ayer'
  return `hace ${dias} días`
}

/** Fecha de hoy en el huso horario local, formato YYYY-MM-DD (para atributos `min`/`value` de <input type="date">). */
export function hoyISO(): string {
  const d = new Date()
  const yyyy = d.getFullYear()
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${yyyy}-${mm}-${dd}`
}
