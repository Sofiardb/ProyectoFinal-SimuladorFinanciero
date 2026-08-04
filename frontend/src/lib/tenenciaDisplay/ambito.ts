import type { AmbitoInfo } from '@/lib/tenenciaDisplay/tipos'
import type { PortfolioDetalle } from '@/types'

export function resolveAmbitoInfo(ambito: string, detalle: PortfolioDetalle): AmbitoInfo {
  if (ambito === 'portfolio_ars') return { label: 'Portfolio (ARS)', corto: 'Portfolio ARS', moneda: 'ARS' }
  if (ambito === 'portfolio_usd') return { label: 'Portfolio (USD)', corto: 'Portfolio USD', moneda: 'USD' }

  const m = ambito.match(/^(accion|bono|letra|plazo_fijo)_(\d+)$/)
  if (!m) return { label: ambito, corto: ambito, moneda: 'ARS' }
  const [, tipo, idStr] = m
  const id = Number(idStr)

  if (tipo === 'accion') {
    const a = detalle.acciones.find((x) => x.idAccion === id)
    return { label: a ? `${a.ticker} · ${a.nombre}` : ambito, corto: a?.ticker ?? ambito, moneda: 'USD' }
  }
  if (tipo === 'bono') {
    const b = detalle.bonos.find((x) => x.idBono === id)
    return { label: b ? `${b.ticker} · ${b.nombre}` : ambito, corto: b?.ticker ?? ambito, moneda: 'ARS' }
  }
  if (tipo === 'letra') {
    const l = detalle.letras.find((x) => x.idLetra === id)
    return { label: l ? `${l.ticker} · ${l.nombre}` : ambito, corto: l?.ticker ?? ambito, moneda: 'ARS' }
  }
  // plazo_fijo
  const pf = detalle.plazosFijos.find((x) => x.idPortfolioPlazoFijo === id)
  return {
    label: pf ? `${pf.entidadFinanciera} (${pf.nombreTipoPlazoFijo})` : ambito,
    corto: pf?.entidadFinanciera ?? ambito,
    moneda: (pf?.codigoMoneda as 'ARS' | 'USD') ?? 'ARS',
  }
}
