import PercentilesPatrimonioTabla from '@/components/simulaciones/PercentilesPatrimonioTabla'
import type { ResultadosSimulacionView } from '@/hooks/useResultadosSimulacionView'

export default function TablaPercentiles({ view }: { view: ResultadosSimulacionView }) {
  if (!view.kpisPortfolio.some((k) => k.patrimonio && k.gananciasReales)) return null
  return (
    <div className="flex flex-col gap-3">
      {view.kpisPortfolio.map(
        (k) =>
          k.patrimonio &&
          k.gananciasReales && (
            <PercentilesPatrimonioTabla
              key={k.ambito}
              titulo={`Percentiles al final del horizonte (${view.labelDe(k.ambito)}, global)`}
              moneda={k.moneda}
              patrimonio={k.patrimonio}
              gananciasReales={k.gananciasReales}
            />
          ),
      )}
    </div>
  )
}
