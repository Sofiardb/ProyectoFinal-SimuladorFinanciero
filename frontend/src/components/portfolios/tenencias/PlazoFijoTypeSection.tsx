import { useState } from 'react'
import { useAddPlazoFijo, useDeletePlazoFijo, useUpdatePlazoFijo } from '@/api/hooks'
import { conCaptura } from '@/lib/mutationHelpers'
import { onErrorToast } from '@/lib/toast'
import { SECCION_TOOLTIPS } from '@/lib/tooltips'
import type { PortfolioDetalle, TipoPlazoFijo } from '@/types'
import PlazoFijoSection from './PlazoFijoSection'
import TypeSectionCard from './TypeSectionCard'

export default function PlazoFijoTypeSection({
  idPortfolio,
  detalle,
  moneda,
  idMoneda,
  tiposPlazoFijo,
  addButtonDataTour,
}: {
  idPortfolio: number
  detalle: PortfolioDetalle
  moneda: 'ARS' | 'USD'
  idMoneda: number
  tiposPlazoFijo: TipoPlazoFijo[] | undefined
  addButtonDataTour?: string
}) {
  const addPlazoFijo = useAddPlazoFijo(idPortfolio)
  const updatePlazoFijo = useUpdatePlazoFijo(idPortfolio)
  const deletePlazoFijo = useDeletePlazoFijo(idPortfolio)
  const [error, setError] = useState<string | null>(null)

  // Depósitos en USD sólo admiten el tipo "Tradicional" (sin UVA, que ajusta por inflación en pesos).
  const tipos =
    moneda === 'USD' ? (tiposPlazoFijo ?? []).filter((t) => t.codigo === 'TRADICIONAL') : (tiposPlazoFijo ?? [])

  return (
    <TypeSectionCard>
      <PlazoFijoSection
        titulo={`Plazo fijo (${moneda})`}
        tooltip={moneda === 'USD' ? SECCION_TOOLTIPS.plazoFijoUsd : SECCION_TOOLTIPS.plazoFijoArs}
        moneda={moneda}
        addButtonDataTour={addButtonDataTour}
        detalle={detalle}
        tenencias={detalle.plazosFijos.filter((pf) => pf.codigoMoneda === moneda)}
        tipos={tipos}
        isMutating={addPlazoFijo.isPending || updatePlazoFijo.isPending || deletePlazoFijo.isPending}
        error={error}
        onDescartarError={() => setError(null)}
        onAdd={(payload) => conCaptura(setError, () => addPlazoFijo.mutateAsync({ ...payload, idMoneda }))}
        onUpdate={(idPortfolioPlazoFijo, payload) =>
          conCaptura(setError, () => updatePlazoFijo.mutateAsync({ id: idPortfolioPlazoFijo, ...payload }))
        }
        onDelete={(idPortfolioPlazoFijo) => deletePlazoFijo.mutate(idPortfolioPlazoFijo, { onError: onErrorToast })}
      />
    </TypeSectionCard>
  )
}
