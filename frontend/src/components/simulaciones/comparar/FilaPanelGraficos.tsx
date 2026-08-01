import PanelGraficoResultados from '@/components/simulaciones/PanelGraficoResultados'
import type { ResultadosSimulacionView } from '@/hooks/useResultadosSimulacionView'
import { Columna, FilaComparacion } from './ComparacionGrid'

/** Una fila de comparación con un PanelGraficoResultados por lado — parametriza lo que cambia
 * entre "Portfolio", "Instrumentos (ARS)" e "Instrumentos (USD)" para no repetir el bloque 3 veces. */
export default function FilaPanelGraficos({
  viewA,
  viewB,
  titulo,
  ambitosDe,
  seleccionUnica,
  monedaDe,
}: {
  viewA:          ResultadosSimulacionView
  viewB:          ResultadosSimulacionView
  titulo:         string
  ambitosDe:      (view: ResultadosSimulacionView) => string[]
  seleccionUnica: boolean
  monedaDe:       (view: ResultadosSimulacionView) => 'ARS' | 'USD'
}) {
  return (
    <FilaComparacion>
      <Columna view={viewA}>
        {({ filas, detalle, instrumentos }) => (
          <PanelGraficoResultados
            titulo={titulo}
            ambitosDisponibles={ambitosDe(viewA)}
            seleccionUnica={seleccionUnica}
            moneda={monedaDe(viewA)}
            filas={filas}
            detalle={detalle}
            instrumentos={instrumentos}
            montoInvertidoDe={viewA.montoInvertidoDe}
          />
        )}
      </Columna>
      <Columna view={viewB}>
        {({ filas, detalle, instrumentos }) => (
          <PanelGraficoResultados
            titulo={titulo}
            ambitosDisponibles={ambitosDe(viewB)}
            seleccionUnica={seleccionUnica}
            moneda={monedaDe(viewB)}
            filas={filas}
            detalle={detalle}
            instrumentos={instrumentos}
            montoInvertidoDe={viewB.montoInvertidoDe}
          />
        )}
      </Columna>
    </FilaComparacion>
  )
}
