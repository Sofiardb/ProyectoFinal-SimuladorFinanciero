import { formatPorcentaje } from '@/lib/format'
import type {
  AccionCatalogo,
  BonoCatalogo,
  LetraCatalogo,
  PortfolioAccion,
  PortfolioBono,
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

const PRECIO_VN_TOOLTIP =
  'El precio cotiza cada 100 de valor nominal (VN). Por ejemplo, $105 significa que pagás $105 por cada $100 de VN que comprás — no es el precio de "una unidad".'

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
export function accionPreview(a: { sector?: string; precioActual?: number }): CampoPreview[] {
  return [
    { label: 'Sector', value: a.sector ?? '—' },
    { label: 'Precio actual', value: a.precioActual != null ? `USD ${a.precioActual.toFixed(2)}` : '—' },
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
    ...accionPreview({ sector: a.sector ?? c?.sector, precioActual: a.precioActual ?? c?.precioActual }),
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
