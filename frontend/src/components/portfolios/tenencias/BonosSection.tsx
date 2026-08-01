import { useState } from 'react'
import { useAddBono, useDeleteBono, useUpdateBono } from '@/api/hooks'
import { conCaptura } from '@/lib/mutationHelpers'
import { bonoCatalogoPorId, bonoPreview, bonoRow } from '@/lib/tenenciaDisplay'
import { formatFechaCorta } from '@/lib/format'
import { onErrorToast } from '@/lib/toast'
import { CANTIDAD_LOTES_TOOLTIP_BONO, SECCION_TOOLTIPS } from '@/lib/tooltips'
import type { BonoCatalogo, PortfolioDetalle } from '@/types'
import CatalogoTenenciaSection, { type CatalogoOpcion, type TenenciaItem } from './CatalogoTenenciaSection'
import TypeSectionCard from './TypeSectionCard'

export default function BonosSection({
  idPortfolio,
  detalle,
  bonosCatalogo,
  perfilLower,
}: {
  idPortfolio: number
  detalle: PortfolioDetalle
  bonosCatalogo: BonoCatalogo[] | undefined
  perfilLower: string
}) {
  const addBono = useAddBono(idPortfolio)
  const updateBono = useUpdateBono(idPortfolio)
  const deleteBono = useDeleteBono(idPortfolio)
  const [error, setError] = useState<string | null>(null)

  const bonosPorId = bonoCatalogoPorId(bonosCatalogo)
  const tenencias: TenenciaItem[] = detalle.bonos.map((b) => ({
    idCatalogo: b.idBono,
    cantidadActual: b.cantidad,
    ...bonoRow(b, bonosPorId),
  }))
  const opciones: CatalogoOpcion[] = (bonosCatalogo ?? [])
    .filter((b) => b.diasAlVencimiento > 0)
    .filter((b) => !detalle.bonos.some((existing) => existing.idBono === b.idBono))
    .map((b) => ({
      id: b.idBono,
      etiqueta: `${b.ticker} - Vence ${formatFechaCorta(b.fechaVencimiento)}`,
      previewFields: bonoPreview(b),
      precioActual: b.precioActual ?? 0,
    }))

  if (tenencias.length === 0 && opciones.length === 0) return null

  return (
    <TypeSectionCard>
      <CatalogoTenenciaSection
        titulo="Bonos"
        tooltip={SECCION_TOOLTIPS.bonos}
        pickLabel="Elegí un bono"
        addLabel="+ Agregar bono"
        cantidadLabel="Cantidad de lotes"
        cantidadTooltip={CANTIDAD_LOTES_TOOLTIP_BONO}
        emptyMessage={`No hay bonos disponibles para el perfil ${perfilLower} en este momento.`}
        tenencias={tenencias}
        catalogo={opciones}
        isMutating={addBono.isPending || updateBono.isPending || deleteBono.isPending}
        error={error}
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
