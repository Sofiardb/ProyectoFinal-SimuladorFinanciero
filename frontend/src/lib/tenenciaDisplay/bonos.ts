import { formatFechaCorta, formatPorcentaje } from '@/lib/format'
import { TASA_TOOLTIP, TIPO_TASA_TOOLTIP } from '@/lib/tooltips'
import { precioVnField, tasaTexto, valorNominalField } from '@/lib/tenenciaDisplay/comun'
import type { CampoPreview, CardDisplay, TenenciaRowCore } from '@/lib/tenenciaDisplay/tipos'
import type { BonoCatalogo, PortfolioBono } from '@/types'

export function bonoPreview(b: {
  fechaVencimiento: string
  tipoBono: 'TASA_FIJA' | 'INDEXADO_INFLACION'
  tasaDescuento: number
  precioActual?: number
}): CampoPreview[] {
  return [
    { label: 'Vencimiento', value: formatFechaCorta(b.fechaVencimiento) },
    { label: 'Tasa', value: formatPorcentaje(b.tasaDescuento * 100), tooltip: TASA_TOOLTIP },
    {
      label: 'Tipo',
      value: b.tipoBono === 'TASA_FIJA' ? 'Tasa fija' : 'Indexado por inflación (CER)',
      tooltip: TIPO_TASA_TOOLTIP,
    },
    precioVnField(b.precioActual),
  ]
}

export function bonoSubtitulo(b: { fechaVencimiento: string }): string {
  return `Vence: ${formatFechaCorta(b.fechaVencimiento)}`
}

export function bonoCatalogoPorId(catalogo: BonoCatalogo[] | undefined): Map<number, BonoCatalogo> {
  return new Map((catalogo ?? []).map((b) => [b.idBono, b]))
}

export function bonoHeldPreview(b: PortfolioBono, catalogo: Map<number, BonoCatalogo>): CampoPreview[] {
  const c = catalogo.get(b.idBono)
  const resto = !c
    ? [{ label: 'Emisor', value: b.emisor ?? '—' }, precioVnField(b.precioActual)]
    : bonoPreview({ ...c, precioActual: b.precioActual ?? c.precioActual })
  return [valorNominalField(b.cantidad), ...resto]
}

export function bonoRow(b: PortfolioBono, catalogo: Map<number, BonoCatalogo>): TenenciaRowCore {
  const c = catalogo.get(b.idBono)
  return {
    titulo: `${b.ticker} · ${b.nombre}`,
    subtitulo: c ? bonoSubtitulo(c) : (b.emisor ?? ''),
    previewFields: bonoHeldPreview(b, catalogo),
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
