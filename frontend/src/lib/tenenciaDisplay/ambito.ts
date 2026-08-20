import type { AmbitoInfo } from '@/lib/tenenciaDisplay/tipos'
import type { InstrumentoSimulacion, PortfolioDetalle } from '@/types'

export function resolveAmbitoInfo(
  ambito: string,
  instrumentos: InstrumentoSimulacion[] | undefined,
  detalle: PortfolioDetalle | undefined,
): AmbitoInfo {
  if (ambito === 'portfolio_ars') return { label: 'Portfolio (ARS)', corto: 'Portfolio ARS', moneda: 'ARS' }
  if (ambito === 'portfolio_usd') return { label: 'Portfolio (USD)', corto: 'Portfolio USD', moneda: 'USD' }

  const m = ambito.match(/^(accion|bono|letra|plazo_fijo)_(\d+)$/)
  if (!m) return { label: ambito, corto: ambito, moneda: 'ARS' }
  const [, tipo, idStr] = m
  const id = Number(idStr)
  const snap = instrumentos?.find((i) => i.ambito === ambito)

  if (tipo === 'accion') {
    const ticker = snap?.ticker ?? detalle?.acciones.find((x) => x.idAccion === id)?.ticker
    const nombre = snap?.nombre ?? detalle?.acciones.find((x) => x.idAccion === id)?.nombre
    return { label: ticker ? `${ticker} · ${nombre}` : ambito, corto: ticker ?? ambito, moneda: 'USD' }
  }
  if (tipo === 'bono') {
    const ticker = snap?.ticker ?? detalle?.bonos.find((x) => x.idBono === id)?.ticker
    const nombre = snap?.nombre ?? detalle?.bonos.find((x) => x.idBono === id)?.nombre
    return { label: ticker ? `${ticker} · ${nombre}` : ambito, corto: ticker ?? ambito, moneda: 'ARS' }
  }
  if (tipo === 'letra') {
    const ticker = snap?.ticker ?? detalle?.letras.find((x) => x.idLetra === id)?.ticker
    const nombre = snap?.nombre ?? detalle?.letras.find((x) => x.idLetra === id)?.nombre
    return { label: ticker ? `${ticker} · ${nombre}` : ambito, corto: ticker ?? ambito, moneda: 'ARS' }
  }
  const pfDetalle = detalle?.plazosFijos.find((x) => x.idPortfolioPlazoFijo === id)
  const entidadFinanciera = snap?.entidadFinanciera ?? pfDetalle?.entidadFinanciera
  const nombreTipo = snap?.nombreTipoPlazoFijo ?? pfDetalle?.nombreTipoPlazoFijo
  const moneda = (snap?.codigoMoneda ?? pfDetalle?.codigoMoneda) as 'ARS' | 'USD' | undefined
  return {
    label: entidadFinanciera ? `${entidadFinanciera} (${nombreTipo})` : ambito,
    corto: entidadFinanciera ?? ambito,
    moneda: moneda ?? 'ARS',
  }
}
