import { formatMoneda, formatPorcentaje } from '@/lib/format'
import { GBM_TOOLTIPS } from '@/lib/tooltips'
import { montoConvertidoField } from '@/lib/tenenciaDisplay/comun'
import type { CampoPreview, CardDisplay, TenenciaRowCore } from '@/lib/tenenciaDisplay/tipos'
import type { AccionCatalogo, PortfolioAccion } from '@/types'

export function accionPreview(a: {
  sector?:       string
  precioActual?: number
  mu?:           number
  sigma?:        number
  rho?:          number
}): CampoPreview[] {
  return [
    { label: 'Sector', value: a.sector ?? '—' },
    { label: 'Precio actual', value: a.precioActual != null ? `USD ${a.precioActual.toFixed(2)}` : '—' },
    {
      label: 'Retorno esperado (μ)',
      value: a.mu != null ? formatPorcentaje(a.mu * 100) : '—',
      tooltip: GBM_TOOLTIPS.mu.definition,
    },
    {
      label: 'Volatilidad (σ)',
      value: a.sigma != null ? formatPorcentaje(a.sigma * 100) : '—',
      tooltip: GBM_TOOLTIPS.sigma.definition,
    },
    {
      label: 'Correlación (ρ)',
      value: a.rho != null ? formatPorcentaje(a.rho * 100) : '—',
      tooltip: GBM_TOOLTIPS.rho.definition,
    },
  ]
}

export function accionSubtitulo(a: { sector?: string }): string {
  return a.sector ?? ''
}

export function accionCatalogoPorId(catalogo: AccionCatalogo[] | undefined): Map<number, AccionCatalogo> {
  return new Map((catalogo ?? []).map((a) => [a.idAccion, a]))
}

export function accionHeldPreview(
  a: PortfolioAccion,
  catalogo: Map<number, AccionCatalogo>,
  monedaBase: string,
  tipoCambio?: number,
): CampoPreview[] {
  const c = catalogo.get(a.idAccion)
  const montoInvertido = a.cantidad * a.precioCompra
  return [
    { label: 'Cantidad', value: a.cantidad.toLocaleString('es-AR') },
    { label: 'Monto invertido', value: formatMoneda(montoInvertido, 'USD') },
    montoConvertidoField(montoInvertido, 'USD', monedaBase, tipoCambio),
    ...accionPreview({
      sector: a.sector ?? c?.sector,
      precioActual: a.precioActual ?? c?.precioActual,
      // μ/σ/ρ: se muestra el snapshot con el que se simula (docs/09), no el valor vivo del catálogo.
      mu: a.muRetornoEsperadoCompra ?? c?.muRetornoEsperado,
      sigma: a.sigmaVolatilidadCompra ?? c?.sigmaVolatilidad,
      rho: a.rhoCorrelacionIndiceCompra ?? c?.rhoCorrelacionIndice,
    }),
  ].filter((f): f is CampoPreview => f != null)
}

export function accionRow(
  a: PortfolioAccion,
  catalogo: Map<number, AccionCatalogo>,
  monedaBase: string,
  tipoCambio?: number,
): TenenciaRowCore {
  return {
    titulo: `${a.ticker} · ${a.nombre}`,
    subtitulo: accionSubtitulo({ sector: a.sector }),
    previewFields: accionHeldPreview(a, catalogo, monedaBase, tipoCambio),
  }
}

export function accionCardDisplay(a: PortfolioAccion): CardDisplay {
  return {
    id: `accion_${a.idPortfolioAccion}`,
    title: `${a.ticker} · ${a.nombre}`,
    subtitle: a.sector ?? '',
    stat: `${a.cantidad} acciones`,
  }
}
