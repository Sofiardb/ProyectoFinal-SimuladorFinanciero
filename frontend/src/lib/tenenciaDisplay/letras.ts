import { formatFechaCorta, formatMoneda, formatPorcentaje } from '@/lib/format'
import { TASA_TOOLTIP, TIPO_TASA_TOOLTIP } from '@/lib/tooltips'
import { montoConvertidoField, precioVnField, tasaTexto, valorNominalField } from '@/lib/tenenciaDisplay/comun'
import type { CampoPreview, CardDisplay, TenenciaRowCore } from '@/lib/tenenciaDisplay/tipos'
import type { LetraCatalogo, PortfolioLetra } from '@/types'

export function letraPreview(l: {
  fechaVencimiento: string
  tipoLetra: 'LECAP' | 'LECER'
  tasa: number
  precioActual?: number
}): CampoPreview[] {
  return [
    { label: 'Vencimiento', value: formatFechaCorta(l.fechaVencimiento) },
    { label: 'Tasa', value: formatPorcentaje(l.tasa * 100), tooltip: TASA_TOOLTIP },
    {
      label: 'Tipo',
      value: l.tipoLetra === 'LECAP' ? 'Tasa fija' : 'Indexado por inflación (CER)',
      tooltip: TIPO_TASA_TOOLTIP,
    },
    precioVnField(l.precioActual),
  ]
}

export function letraSubtitulo(l: { fechaVencimiento: string }): string {
  return `Vence: ${formatFechaCorta(l.fechaVencimiento)}`
}

export function letraCatalogoPorId(catalogo: LetraCatalogo[] | undefined): Map<number, LetraCatalogo> {
  return new Map((catalogo ?? []).map((l) => [l.idLetra, l]))
}

export function letraHeldPreview(
  l: PortfolioLetra,
  catalogo: Map<number, LetraCatalogo>,
  monedaBase: string,
  tipoCambio?: number,
): CampoPreview[] {
  const c = catalogo.get(l.idLetra)
  const montoInvertido = l.cantidad * l.precioCompra
  return [
    valorNominalField(l.cantidad),
    { label: 'Monto invertido', value: formatMoneda(montoInvertido, 'ARS') },
    montoConvertidoField(montoInvertido, 'ARS', monedaBase, tipoCambio),
    ...letraPreview({
      fechaVencimiento: l.fechaVencimiento,
      tipoLetra: c?.tipoLetra ?? 'LECAP',
      tasa: l.tasa,
      precioActual: l.precioActual ?? c?.precioActual,
    }),
  ].filter((f): f is CampoPreview => f != null)
}

export function letraRow(
  l: PortfolioLetra,
  catalogo: Map<number, LetraCatalogo>,
  monedaBase: string,
  tipoCambio?: number,
): TenenciaRowCore {
  return {
    titulo: `${l.ticker} · ${l.nombre}`,
    subtitulo: letraSubtitulo({ fechaVencimiento: l.fechaVencimiento }),
    previewFields: letraHeldPreview(l, catalogo, monedaBase, tipoCambio),
  }
}

export function letraCardDisplay(l: PortfolioLetra, catalogo: Map<number, LetraCatalogo>): CardDisplay {
  const c = catalogo.get(l.idLetra)
  return {
    id: `letra_${l.idPortfolioLetra}`,
    title: `${l.ticker} · ${l.nombre}`,
    subtitle: letraSubtitulo({ fechaVencimiento: l.fechaVencimiento }),
    stat: tasaTexto(c?.tipoLetra === 'LECER' ? 'CER' : 'Fija', l.tasa),
    instrumento: { tipo: 'letra', id: l.idLetra },
  }
}
