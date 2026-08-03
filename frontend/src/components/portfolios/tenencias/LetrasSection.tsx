import { useState } from 'react'
import { useAddLetra, useDeleteLetra, useUpdateLetra } from '@/api/hooks'
import { conCaptura } from '@/lib/mutationHelpers'
import { letraCatalogoPorId, letraPreview, letraRow } from '@/lib/tenenciaDisplay'
import { onErrorToast } from '@/lib/toast'
import { CANTIDAD_LOTES_TOOLTIP_LETRA, MONTO_INVERTIDO_TOOLTIP_LETRA, SECCION_TOOLTIPS } from '@/lib/tooltips'
import type { LetraCatalogo, PortfolioDetalle } from '@/types'
import CatalogoTenenciaSection, { type CatalogoOpcion, type TenenciaItem } from './CatalogoTenenciaSection'
import TypeSectionCard from './TypeSectionCard'

export default function LetrasSection({
  idPortfolio,
  detalle,
  letrasCatalogo,
  perfilLower,
}: {
  idPortfolio: number
  detalle: PortfolioDetalle
  letrasCatalogo: LetraCatalogo[] | undefined
  perfilLower: string
}) {
  const addLetra = useAddLetra(idPortfolio)
  const updateLetra = useUpdateLetra(idPortfolio)
  const deleteLetra = useDeleteLetra(idPortfolio)
  const [error, setError] = useState<string | null>(null)

  const letrasPorId = letraCatalogoPorId(letrasCatalogo)
  const tenencias: TenenciaItem[] = detalle.letras.map((l) => {
    const c = letrasPorId.get(l.idLetra)
    return {
      idCatalogo: l.idLetra,
      cantidadActual: l.cantidad,
      precioActual: l.precioActual ?? c?.precioActual,
      esCer: c?.tipoLetra === 'LECER',
      ...letraRow(l, letrasPorId),
    }
  })
  const opciones: CatalogoOpcion[] = (letrasCatalogo ?? [])
    .filter((l) => l.diasAlVencimiento > 0)
    .filter((l) => !detalle.letras.some((existing) => existing.idLetra === l.idLetra))
    .map((l) => ({
      id: l.idLetra,
      etiqueta: `${l.ticker} - ${l.nombre} · ${l.tipoLetra === 'LECAP' ? 'Tasa fija' : 'CER'}`,
      previewFields: letraPreview(l),
      precioActual: l.precioActual ?? 0,
      esCer: l.tipoLetra === 'LECER',
    }))

  if (tenencias.length === 0 && opciones.length === 0) return null

  return (
    <TypeSectionCard>
      <CatalogoTenenciaSection
        titulo="Letras"
        tooltip={SECCION_TOOLTIPS.letras}
        pickLabel="Elegí una letra"
        addLabel="+ Agregar letra"
        cantidadLabel="Cantidad de lotes"
        cantidadTooltip={CANTIDAD_LOTES_TOOLTIP_LETRA}
        montoInvertidoTooltip={MONTO_INVERTIDO_TOOLTIP_LETRA}
        emptyMessage={`No hay letras disponibles para el perfil ${perfilLower} en este momento.`}
        tenencias={tenencias}
        catalogo={opciones}
        isMutating={addLetra.isPending || updateLetra.isPending || deleteLetra.isPending}
        error={error}
        onAdd={(idLetra, cantidad, precioCompra) =>
          conCaptura(setError, () => addLetra.mutateAsync({ idLetra, cantidad, precioCompra }))
        }
        onUpdate={(idLetra, cantidad) => {
          const precioCompra = detalle.letras.find((l) => l.idLetra === idLetra)?.precioCompra ?? 0
          return conCaptura(setError, () => updateLetra.mutateAsync({ id: idLetra, cantidad, precioCompra }))
        }}
        onDelete={(idLetra) => deleteLetra.mutate(idLetra, { onError: onErrorToast })}
      />
    </TypeSectionCard>
  )
}
