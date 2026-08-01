import {
  accionCatalogoPorId,
  accionRow,
  bonoCatalogoPorId,
  bonoRow,
  letraCatalogoPorId,
  letraRow,
  plazoFijoPreview,
  type CampoPreview,
  type TenenciaRowCore,
} from '@/lib/tenenciaDisplay'
import type { AccionCatalogo, BonoCatalogo, LetraCatalogo, PortfolioDetalle, PortfolioPlazoFijo } from '@/types'

export interface FilaTenenciaResumen {
  id:        string
  titulo:    string
  subtitulo: string
  campos:    CampoPreview[]
}

function fila(id: string, row: TenenciaRowCore): FilaTenenciaResumen {
  return { id, titulo: row.titulo, subtitulo: row.subtitulo, campos: row.previewFields }
}

function plazoFijoFila(pf: PortfolioPlazoFijo): FilaTenenciaResumen {
  return {
    id: `pf_${pf.idPortfolioPlazoFijo}`,
    titulo: pf.entidadFinanciera,
    subtitulo: pf.nombreTipoPlazoFijo,
    campos: plazoFijoPreview(pf),
  }
}

/** Agrupa las tenencias de un portfolio en filas de resumen por moneda, para el detalle previo a lanzar la simulación. */
export function construirFilasPortfolio(
  detalle: PortfolioDetalle,
  catalogos: {
    accionesCatalogo: AccionCatalogo[] | undefined
    bonosCatalogo:    BonoCatalogo[] | undefined
    letrasCatalogo:   LetraCatalogo[] | undefined
  },
): { usdFilas: FilaTenenciaResumen[]; arsFilas: FilaTenenciaResumen[] } {
  const accionesPorId = accionCatalogoPorId(catalogos.accionesCatalogo)
  const bonosPorId = bonoCatalogoPorId(catalogos.bonosCatalogo)
  const letrasPorId = letraCatalogoPorId(catalogos.letrasCatalogo)

  const accionesFilas = detalle.acciones.map((a) => fila(`accion_${a.idPortfolioAccion}`, accionRow(a, accionesPorId)))
  const bonosFilas = detalle.bonos.map((b) => fila(`bono_${b.idPortfolioBono}`, bonoRow(b, bonosPorId)))
  const letrasFilas = detalle.letras.map((l) => fila(`letra_${l.idPortfolioLetra}`, letraRow(l, letrasPorId)))

  const usdFilas = [
    ...accionesFilas,
    ...detalle.plazosFijos.filter((pf) => pf.codigoMoneda === 'USD').map(plazoFijoFila),
  ]
  const arsFilas = [
    ...bonosFilas,
    ...letrasFilas,
    ...detalle.plazosFijos.filter((pf) => pf.codigoMoneda === 'ARS').map(plazoFijoFila),
  ]

  return { usdFilas, arsFilas }
}
