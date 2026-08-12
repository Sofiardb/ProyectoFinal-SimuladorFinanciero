import { useState } from 'react'
import { useAddAccion, useDeleteAccion, useTipoCambio, useUpdateAccion } from '@/api/hooks'
import { conCaptura } from '@/lib/mutationHelpers'
import { calcularDisponible } from '@/lib/presupuesto'
import { accionCatalogoPorId, accionPreview, accionRow } from '@/lib/tenenciaDisplay'
import { onErrorToast } from '@/lib/toast'
import { SECCION_TOOLTIPS } from '@/lib/tooltips'
import type { AccionCatalogo, PortfolioDetalle } from '@/types'
import CatalogoTenenciaSection, { type CatalogoOpcion, type TenenciaItem } from './CatalogoTenenciaSection'
import TypeSectionCard from './TypeSectionCard'

export default function AccionesSection({
  idPortfolio,
  detalle,
  accionesCatalogo,
  sigmaMaxAccion,
  perfilLower,
}: {
  idPortfolio: number
  detalle: PortfolioDetalle
  accionesCatalogo: AccionCatalogo[] | undefined
  sigmaMaxAccion: number | undefined
  perfilLower: string
}) {
  const addAccion = useAddAccion(idPortfolio)
  const updateAccion = useUpdateAccion(idPortfolio)
  const deleteAccion = useDeleteAccion(idPortfolio)
  const { data: tipoCambio } = useTipoCambio()
  const [error, setError] = useState<string | null>(null)

  const accionesPorId = accionCatalogoPorId(accionesCatalogo)
  const tenencias: TenenciaItem[] = detalle.acciones.map((a) => ({
    idCatalogo: a.idAccion,
    cantidadActual: a.cantidad,
    ...accionRow(a, accionesPorId, detalle.codigoMonedaBase, tipoCambio?.valor),
  }))
  const opciones: CatalogoOpcion[] = (accionesCatalogo ?? [])
    .filter((a) => !detalle.acciones.some((existing) => existing.idAccion === a.idAccion))
    .filter((a) => sigmaMaxAccion == null || a.sigmaVolatilidad == null || a.sigmaVolatilidad <= sigmaMaxAccion)
    .map((a) => ({
      id: a.idAccion,
      etiqueta: `${a.ticker} - ${a.nombre}`,
      previewFields: accionPreview({
        sector: a.sector,
        precioActual: a.precioActual,
        mu: a.muRetornoEsperado,
        sigma: a.sigmaVolatilidad,
        rho: a.rhoCorrelacionIndice,
      }),
      precioActual: a.precioActual ?? 0,
    }))

  if (tenencias.length === 0 && opciones.length === 0) return null

  return (
    <TypeSectionCard>
      <CatalogoTenenciaSection
        titulo="Acciones"
        tooltip={SECCION_TOOLTIPS.acciones}
        pickLabel="Elegí una acción"
        addLabel="+ Agregar acción"
        emptyMessage={`No hay acciones disponibles para el perfil ${perfilLower} en este momento.`}
        tenencias={tenencias}
        catalogo={opciones}
        isMutating={addAccion.isPending || updateAccion.isPending || deleteAccion.isPending}
        disponible={calcularDisponible(detalle, tipoCambio?.valor)}
        monedaBase={detalle.codigoMonedaBase}
        moneda="USD"
        tipoCambio={tipoCambio?.valor}
        error={error}
        onDescartarError={() => setError(null)}
        onAdd={(idAccion, cantidad, precioCompra) =>
          conCaptura(setError, () => addAccion.mutateAsync({ idAccion, cantidad, precioCompra }))
        }
        onUpdate={(idAccion, cantidad) => {
          const precioCompra = detalle.acciones.find((a) => a.idAccion === idAccion)?.precioCompra ?? 0
          return conCaptura(setError, () => updateAccion.mutateAsync({ id: idAccion, cantidad, precioCompra }))
        }}
        onDelete={(idAccion) => deleteAccion.mutate(idAccion, { onError: onErrorToast })}
      />
    </TypeSectionCard>
  )
}
