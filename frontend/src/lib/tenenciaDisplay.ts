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
  label: string
  value: string
}

export function tasaTexto(tipo: string, tasa: number): string {
  return `${tipo} ${formatPorcentaje(tasa * 100)}`
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
}): CampoPreview[] {
  return [
    { label: 'Vencimiento', value: b.fechaVencimiento },
    { label: 'Tasa', value: tasaTexto(b.tipoBono === 'TASA_FIJA' ? 'Fija' : 'CER', b.tasaDescuento) },
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
}): CampoPreview[] {
  return [
    { label: 'Vencimiento', value: l.fechaVencimiento },
    { label: 'Tasa', value: tasaTexto(l.tipoLetra === 'LECAP' ? 'Fija' : 'CER', l.tasa) },
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
  return accionPreview({ sector: a.sector ?? c?.sector, precioActual: a.precioActual ?? c?.precioActual })
}

export function bonoHeldPreview(b: PortfolioBono, catalogo: Map<number, BonoCatalogo>): CampoPreview[] {
  const c = catalogo.get(b.idBono)
  if (!c) return [{ label: 'Emisor', value: b.emisor ?? '—' }, { label: 'Precio actual', value: b.precioActual != null ? `USD ${b.precioActual.toFixed(2)}` : '—' }]
  return bonoPreview(c)
}

export function letraHeldPreview(l: PortfolioLetra, catalogo: Map<number, LetraCatalogo>): CampoPreview[] {
  const c = catalogo.get(l.idLetra)
  return letraPreview({
    fechaVencimiento: l.fechaVencimiento,
    tipoLetra: c?.tipoLetra ?? 'LECAP',
    tasa: l.tasa,
  })
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
