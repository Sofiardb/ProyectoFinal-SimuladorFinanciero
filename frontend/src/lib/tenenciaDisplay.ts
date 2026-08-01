import { formatFecha, formatMoneda, formatPorcentaje } from '@/lib/format'
import { GBM_TOOLTIPS, PRECIO_VN_TOOLTIP } from '@/lib/tooltips'
import type {
  AccionCatalogo,
  BonoCatalogo,
  LetraCatalogo,
  PortfolioAccion,
  PortfolioBono,
  PortfolioDetalle,
  PortfolioLetra,
  PortfolioPlazoFijo,
} from '@/types'

export interface CampoPreview {
  label:    string
  value:    string
  tooltip?: string
}

export function tasaTexto(tipo: string, tasa: number): string {
  return `${tipo} ${formatPorcentaje(tasa * 100)}`
}

function precioVnField(precioActual?: number): CampoPreview {
  return {
    label:   'Precio actual',
    value:   precioActual != null ? `$${precioActual.toFixed(2)} / VN 100` : '—',
    tooltip: PRECIO_VN_TOOLTIP,
  }
}

/** Cantidad de lotes de VN100 mostrada como el valor nominal en $ que el usuario ingresó. */
function valorNominalField(cantidadLotes: number): CampoPreview {
  return { label: 'Valor nominal', value: `$${(cantidadLotes * 100).toLocaleString('es-AR')}` }
}

// ─── Acciones ──────────────────────────────────────────────────────────────
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

// ─── Bonos ─────────────────────────────────────────────────────────────────
export function bonoPreview(b: {
  fechaVencimiento: string
  tipoBono: 'TASA_FIJA' | 'INDEXADO_INFLACION'
  tasaDescuento: number
  precioActual?: number
}): CampoPreview[] {
  return [
    { label: 'Vencimiento', value: b.fechaVencimiento },
    { label: 'Tasa', value: tasaTexto(b.tipoBono === 'TASA_FIJA' ? 'Fija' : 'CER', b.tasaDescuento) },
    precioVnField(b.precioActual),
  ]
}

export function bonoSubtitulo(b: { fechaVencimiento: string }): string {
  return `Vence: ${b.fechaVencimiento}`
}

// ─── Letras ────────────────────────────────────────────────────────────────
export function letraPreview(l: {
  fechaVencimiento: string
  tipoLetra: 'LECAP' | 'LECER'
  tasa: number
  precioActual?: number
}): CampoPreview[] {
  return [
    { label: 'Vencimiento', value: l.fechaVencimiento },
    { label: 'Tasa', value: tasaTexto(l.tipoLetra === 'LECAP' ? 'Fija' : 'CER', l.tasa) },
    precioVnField(l.precioActual),
  ]
}

export function letraSubtitulo(l: { fechaVencimiento: string }): string {
  return `Vence: ${l.fechaVencimiento}`
}

// ─── Resolución de catálogo completo (para tenencias existentes) ─────────────
export function bonoCatalogoPorId(catalogo: BonoCatalogo[] | undefined): Map<number, BonoCatalogo> {
  return new Map((catalogo ?? []).map((b) => [b.idBono, b]))
}

export function accionCatalogoPorId(catalogo: AccionCatalogo[] | undefined): Map<number, AccionCatalogo> {
  return new Map((catalogo ?? []).map((a) => [a.idAccion, a]))
}

export function letraCatalogoPorId(catalogo: LetraCatalogo[] | undefined): Map<number, LetraCatalogo> {
  return new Map((catalogo ?? []).map((l) => [l.idLetra, l]))
}

export function accionHeldPreview(a: PortfolioAccion, catalogo: Map<number, AccionCatalogo>): CampoPreview[] {
  const c = catalogo.get(a.idAccion)
  return [
    { label: 'Cantidad', value: a.cantidad.toLocaleString('es-AR') },
    ...accionPreview({
      sector: a.sector ?? c?.sector,
      precioActual: a.precioActual ?? c?.precioActual,
      // μ/σ/ρ: se muestra el snapshot con el que se simula (docs/09), no el valor vivo del catálogo.
      mu: a.muRetornoEsperadoCompra ?? c?.muRetornoEsperado,
      sigma: a.sigmaVolatilidadCompra ?? c?.sigmaVolatilidad,
      rho: a.rhoCorrelacionIndiceCompra ?? c?.rhoCorrelacionIndice,
    }),
  ]
}

export function bonoHeldPreview(b: PortfolioBono, catalogo: Map<number, BonoCatalogo>): CampoPreview[] {
  const c = catalogo.get(b.idBono)
  const resto = !c
    ? [{ label: 'Emisor', value: b.emisor ?? '—' }, precioVnField(b.precioActual)]
    : bonoPreview({ ...c, precioActual: b.precioActual ?? c.precioActual })
  return [valorNominalField(b.cantidad), ...resto]
}

export function letraHeldPreview(l: PortfolioLetra, catalogo: Map<number, LetraCatalogo>): CampoPreview[] {
  const c = catalogo.get(l.idLetra)
  return [
    valorNominalField(l.cantidad),
    ...letraPreview({
      fechaVencimiento: l.fechaVencimiento,
      tipoLetra: c?.tipoLetra ?? 'LECAP',
      tasa: l.tasa,
      precioActual: l.precioActual ?? c?.precioActual,
    }),
  ]
}

// ─── Filas de tenencia ya cargada (detalle de portfolio y resumen de nueva simulación) ──────
export interface TenenciaRowCore {
  titulo:        string
  subtitulo:     string
  previewFields: CampoPreview[]
}

export function accionRow(a: PortfolioAccion, catalogo: Map<number, AccionCatalogo>): TenenciaRowCore {
  return {
    titulo: `${a.ticker} · ${a.nombre}`,
    subtitulo: accionSubtitulo({ sector: a.sector }),
    previewFields: accionHeldPreview(a, catalogo),
  }
}

export function bonoRow(b: PortfolioBono, catalogo: Map<number, BonoCatalogo>): TenenciaRowCore {
  const c = catalogo.get(b.idBono)
  return {
    titulo: `${b.ticker} · ${b.nombre}`,
    subtitulo: c ? bonoSubtitulo(c) : (b.emisor ?? ''),
    previewFields: bonoHeldPreview(b, catalogo),
  }
}

export function letraRow(l: PortfolioLetra, catalogo: Map<number, LetraCatalogo>): TenenciaRowCore {
  return {
    titulo: `${l.ticker} · ${l.nombre}`,
    subtitulo: letraSubtitulo({ fechaVencimiento: l.fechaVencimiento }),
    previewFields: letraHeldPreview(l, catalogo),
  }
}

export function plazoFijoPreview(pf: PortfolioPlazoFijo): CampoPreview[] {
  const tasaLabel = pf.nombreTipoPlazoFijo === 'Plazo fijo UVA' ? 'Tasa real' : 'TNA'
  return [
    { label: 'Monto', value: formatMoneda(pf.montoInvertido, pf.codigoMoneda) },
    { label: tasaLabel, value: formatPorcentaje(pf.tnaPactada * 100) },
    { label: 'Plazo', value: `${pf.duracionDias} días` },
    { label: 'Inicio', value: formatFecha(pf.fechaInicio) },
    { label: 'Reinversión', value: pf.reinvertirAlVencimiento ? 'Sí' : 'No' },
  ]
}


export interface AmbitoInfo {
  label:  string
  /** Identificador corto (ticker, o entidad financiera para plazo fijo) — para chips/marcadores*/
  corto:  string
  moneda: 'ARS' | 'USD'
}

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

// ─── Filas mini para la card de la lista de portfolios ───────────────────────
export interface CardDisplay {
  id:       string
  title:    string
  subtitle: string
  stat:     string
}

export function accionCardDisplay(a: PortfolioAccion): CardDisplay {
  return {
    id: `accion_${a.idPortfolioAccion}`,
    title: `${a.ticker} · ${a.nombre}`,
    subtitle: a.sector ?? '',
    stat: `${a.cantidad} acciones`,
  }
}

export function bonoCardDisplay(b: PortfolioBono, catalogo: Map<number, BonoCatalogo>): CardDisplay {
  const c = catalogo.get(b.idBono)
  return {
    id: `bono_${b.idPortfolioBono}`,
    title: `${b.ticker} · ${b.nombre}`,
    subtitle: c ? bonoSubtitulo(c) : b.emisor ? `Emisor: ${b.emisor}` : '',
    stat: c ? tasaTexto(c.tipoBono === 'TASA_FIJA' ? 'Fija' : 'CER', c.tasaDescuento) : '—',
  }
}

export function letraCardDisplay(l: PortfolioLetra, catalogo: Map<number, LetraCatalogo>): CardDisplay {
  const c = catalogo.get(l.idLetra)
  return {
    id: `letra_${l.idPortfolioLetra}`,
    title: `${l.ticker} · ${l.nombre}`,
    subtitle: letraSubtitulo({ fechaVencimiento: l.fechaVencimiento }),
    stat: tasaTexto(c?.tipoLetra === 'LECER' ? 'CER' : 'Fija', l.tasa),
  }
}

export function plazoFijoCardDisplay(pf: PortfolioPlazoFijo): CardDisplay {
  const esUva = pf.nombreTipoPlazoFijo.toUpperCase().includes('UVA')
  return {
    id: `pf_${pf.idPortfolioPlazoFijo}`,
    title: pf.entidadFinanciera,
    subtitle: `${pf.codigoMoneda} · ${pf.nombreTipoPlazoFijo}`,
    stat: `${formatPorcentaje(pf.tnaPactada * 100)} ${esUva ? 'real' : 'TNA'}`,
  }
}
