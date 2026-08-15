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
import type { InstrumentoRef } from '@/lib/instrumentoRef'
import type { AccionCatalogo, BonoCatalogo, LetraCatalogo, PortfolioDetalle, PortfolioPlazoFijo } from '@/types'

export interface FilaTenenciaResumen {
  id:          string
  titulo:      string
  subtitulo:   string
  campos:      CampoPreview[]
  instrumento: InstrumentoRef
}

function fila(id: string, instrumento: InstrumentoRef, row: TenenciaRowCore): FilaTenenciaResumen {
  return { id, titulo: row.titulo, subtitulo: row.subtitulo, campos: row.previewFields, instrumento }
}

function plazoFijoFila(pf: PortfolioPlazoFijo, monedaBase: string, tipoCambio: number | undefined): FilaTenenciaResumen {
  return {
    id: `pf_${pf.idPortfolioPlazoFijo}`,
    titulo: pf.entidadFinanciera,
    subtitulo: pf.nombreTipoPlazoFijo,
    campos: plazoFijoPreview(pf, monedaBase, tipoCambio),
    instrumento: { tipo: 'pf', id: pf.idPortfolioPlazoFijo },
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
  tipoCambio?: number,
): { usdFilas: FilaTenenciaResumen[]; arsFilas: FilaTenenciaResumen[] } {
  const accionesPorId = accionCatalogoPorId(catalogos.accionesCatalogo)
  const bonosPorId = bonoCatalogoPorId(catalogos.bonosCatalogo)
  const letrasPorId = letraCatalogoPorId(catalogos.letrasCatalogo)

  const monedaBase = detalle.codigoMonedaBase
  const accionesFilas = detalle.acciones.map((a) =>
    fila(`accion_${a.idPortfolioAccion}`, { tipo: 'accion', id: a.idAccion }, accionRow(a, accionesPorId, monedaBase, tipoCambio)),
  )
  const bonosFilas = detalle.bonos.map((b) =>
    fila(`bono_${b.idPortfolioBono}`, { tipo: 'bono', id: b.idBono }, bonoRow(b, bonosPorId, monedaBase, tipoCambio)),
  )
  const letrasFilas = detalle.letras.map((l) =>
    fila(`letra_${l.idPortfolioLetra}`, { tipo: 'letra', id: l.idLetra }, letraRow(l, letrasPorId, monedaBase, tipoCambio)),
  )

  const usdFilas = [
    ...accionesFilas,
    ...detalle.plazosFijos
      .filter((pf) => pf.codigoMoneda === 'USD')
      .map((pf) => plazoFijoFila(pf, monedaBase, tipoCambio)),
  ]
  const arsFilas = [
    ...bonosFilas,
    ...letrasFilas,
    ...detalle.plazosFijos
      .filter((pf) => pf.codigoMoneda === 'ARS')
      .map((pf) => plazoFijoFila(pf, monedaBase, tipoCambio)),
  ]

  return { usdFilas, arsFilas }
}
