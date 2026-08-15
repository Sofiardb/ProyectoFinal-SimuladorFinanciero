import InflacionChart from '@/components/charts/InflacionChart'
import { useResultadosSimulacionView } from '@/hooks/useResultadosSimulacionView'
import CabeceraSimulacion from './CabeceraSimulacion'
import { Columna, FilaComparacion } from './ComparacionGrid'
import FilaPanelGraficos from './FilaPanelGraficos'
import type { Grupo } from './SelectorSimulacion'
import KpisComparacion from './KpisComparacion'
import TablaPercentiles from './TablaPercentiles'

export default function ComparacionSimulaciones({
  idA,
  idB,
  onChangeA,
  onChangeB,
  grupos,
}: {
  idA: number | null
  idB: number | null
  onChangeA: (id: number | null) => void
  onChangeB: (id: number | null) => void
  grupos: Grupo[]
}) {
  const viewA = useResultadosSimulacionView(idA ?? NaN)
  const viewB = useResultadosSimulacionView(idB ?? NaN)

  return (
    <>
      <FilaComparacion>
        <CabeceraSimulacion lado="a" view={viewA} idSimulacion={idA} onChange={onChangeA} grupos={grupos} />
        <CabeceraSimulacion lado="b" view={viewB} idSimulacion={idB} onChange={onChangeB} grupos={grupos} />
      </FilaComparacion>

      <FilaComparacion>
        <Columna view={viewA} lado="a" alto="h-52">
          {({ sim, filas }) => <KpisComparacion sim={sim} filas={filas} view={viewA} />}
        </Columna>
        <Columna view={viewB} lado="b" alto="h-52">
          {({ sim, filas }) => <KpisComparacion sim={sim} filas={filas} view={viewB} />}
        </Columna>
      </FilaComparacion>

      <FilaPanelGraficos
        viewA={viewA}
        viewB={viewB}
        titulo="Portfolio"
        ambitosDe={(v) => v.ambitosPortfolio}
        seleccionUnica
        monedaDe={(v) => v.kpisPortfolio[0]?.moneda ?? 'ARS'}
      />

      <FilaPanelGraficos
        viewA={viewA}
        viewB={viewB}
        titulo="Instrumentos (ARS)"
        ambitosDe={(v) => v.ambitosArs}
        seleccionUnica={false}
        monedaDe={() => 'ARS'}
      />

      <FilaPanelGraficos
        viewA={viewA}
        viewB={viewB}
        titulo="Instrumentos (USD)"
        ambitosDe={(v) => v.ambitosUsd}
        seleccionUnica={false}
        monedaDe={() => 'USD'}
      />

      <FilaComparacion>
        <Columna view={viewA} lado="a" alto="h-56">
          {() => (
            <InflacionChart
              mensualArs={viewA.mensualArs}
              mensualUsd={viewA.mensualUsd}
              acumuladaArs={viewA.acumuladaArs}
              acumuladaUsd={viewA.acumuladaUsd}
            />
          )}
        </Columna>
        <Columna view={viewB} lado="b" alto="h-56">
          {() => (
            <InflacionChart
              mensualArs={viewB.mensualArs}
              mensualUsd={viewB.mensualUsd}
              acumuladaArs={viewB.acumuladaArs}
              acumuladaUsd={viewB.acumuladaUsd}
            />
          )}
        </Columna>
      </FilaComparacion>

      <FilaComparacion>
        <Columna view={viewA} lado="a">{() => <TablaPercentiles view={viewA} />}</Columna>
        <Columna view={viewB} lado="b">{() => <TablaPercentiles view={viewB} />}</Columna>
      </FilaComparacion>
    </>
  )
}
