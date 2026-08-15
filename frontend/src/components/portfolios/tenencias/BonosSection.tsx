import { useState } from 'react'
import { useAddBono, useDeleteBono, useTipoCambio, useUpdateBono } from '@/api/hooks'
import { conCaptura } from '@/lib/mutationHelpers'
import { calcularDisponible } from '@/lib/presupuesto'
import { bonoCatalogoPorId, bonoPreview, bonoRow } from '@/lib/tenenciaDisplay'
import { formatFechaCorta } from '@/lib/format'
import { onErrorToast } from '@/lib/toast'
import { CANTIDAD_LOTES_TOOLTIP_BONO, MONTO_INVERTIDO_TOOLTIP_BONO, SECCION_TOOLTIPS } from '@/lib/tooltips'
import type { BonoCatalogo, PortfolioDetalle } from '@/types'
import CatalogoTenenciaSection, { type CatalogoOpcion, type TenenciaItem } from './CatalogoTenenciaSection'
import TypeSectionCard from './TypeSectionCard'

export default function BonosSection({
  idPortfolio,
  detalle,
  bonosCatalogo,
  perfilLower,
  editarKey,
}: {
  idPortfolio: number
  detalle: PortfolioDetalle
  bonosCatalogo: BonoCatalogo[] | undefined
  perfilLower: string
  editarKey?: string | null
}) {
  const addBono = useAddBono(idPortfolio)
  const updateBono = useUpdateBono(idPortfolio)
  const deleteBono = useDeleteBono(idPortfolio)
  const { data: tipoCambio } = useTipoCambio()
  const [error, setError] = useState<string | null>(null)

  const bonosPorId = bonoCatalogoPorId(bonosCatalogo)
  const tenencias: TenenciaItem[] = detalle.bonos.map((b) => {
    const c = bonosPorId.get(b.idBono)
    return {
      idCatalogo: b.idBono,
      cantidadActual: b.cantidad,
      precioActual: b.precioActual ?? c?.precioActual,
      flujos: c?.flujos,
      esCer: c?.tipoBono === 'INDEXADO_INFLACION',
      ...bonoRow(b, bonosPorId, detalle.codigoMonedaBase, tipoCambio?.valor),
    }
  })
  const opciones: CatalogoOpcion[] = (bonosCatalogo ?? [])
    .filter((b) => b.diasAlVencimiento > 0)
    .filter((b) => !detalle.bonos.some((existing) => existing.idBono === b.idBono))
    .map((b) => ({
      id: b.idBono,
      etiqueta: `${b.ticker} - Vence ${formatFechaCorta(b.fechaVencimiento)} · ${b.tipoBono === 'TASA_FIJA' ? 'Tasa fija' : 'CER'}`,
      previewFields: bonoPreview(b),
      precioActual: b.precioActual ?? 0,
      flujos: b.flujos,
      esCer: b.tipoBono === 'INDEXADO_INFLACION',
    }))

  if (tenencias.length === 0 && opciones.length === 0) return null

  return (
    <TypeSectionCard>
      <CatalogoTenenciaSection
        titulo="Bonos"
        tipo="bono"
        editarKey={editarKey}
        tooltip={SECCION_TOOLTIPS.bonos}
        pickLabel="Elegí un bono"
        addLabel="+ Agregar bono"
        cantidadLabel="Cantidad de lotes"
        cantidadTooltip={CANTIDAD_LOTES_TOOLTIP_BONO}
        montoInvertidoTooltip={MONTO_INVERTIDO_TOOLTIP_BONO}
        emptyMessage={`No hay bonos disponibles para el perfil ${perfilLower} en este momento.`}
        tenencias={tenencias}
        catalogo={opciones}
        isMutating={addBono.isPending || updateBono.isPending || deleteBono.isPending}
        disponible={calcularDisponible(detalle, tipoCambio?.valor)}
        monedaBase={detalle.codigoMonedaBase}
        moneda="ARS"
        tipoCambio={tipoCambio?.valor}
        error={error}
        onDescartarError={() => setError(null)}
        onAdd={(idBono, cantidad, precioCompra) =>
          conCaptura(setError, () => addBono.mutateAsync({ idBono, cantidad, precioCompra }))
        }
        onUpdate={(idBono, cantidad) => {
          const precioCompra = detalle.bonos.find((b) => b.idBono === idBono)?.precioCompra ?? 0
          return conCaptura(setError, () => updateBono.mutateAsync({ id: idBono, cantidad, precioCompra }))
        }}
        onDelete={(idBono) => deleteBono.mutate(idBono, { onError: onErrorToast })}
      />
    </TypeSectionCard>
  )
}
