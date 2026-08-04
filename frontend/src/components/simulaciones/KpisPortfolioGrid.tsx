import { Fragment } from 'react'
import KpiCard from '@/components/simulaciones/KpiCard'
import type { GuiaResultados } from '@/hooks/useGuiaResultados'
import type { KpiPortfolioMoneda } from '@/hooks/useResultadosSimulacionView'
import { formatMoneda, formatPorcentaje } from '@/lib/format'

interface Props {
  className: string
  kpisPortfolio: KpiPortfolioMoneda[]
  inflacionAcumuladaArs: number | undefined
  inflacionAcumuladaUsd: number | undefined
  guia?: GuiaResultados
}

export default function KpisPortfolioGrid({
  className,
  kpisPortfolio,
  inflacionAcumuladaArs,
  inflacionAcumuladaUsd,
  guia,
}: Props) {
  return (
    <div className={className}>
      {kpisPortfolio.map((k, i) => (
        <Fragment key={k.ambito}>
          <KpiCard
            label={kpisPortfolio.length > 1 ? `Monto invertido (${k.moneda})` : 'Monto invertido'}
            value={k.montoInvertido != null ? formatMoneda(k.montoInvertido, k.moneda) : '—'}
            dataGuia={guia && i === 0 ? 'kpi-monto-invertido' : undefined}
            onAbrirGuia={guia && i === 0 ? () => guia.iniciarEnSlot('kpis', 0) : undefined}
          />
          <KpiCard
            label={kpisPortfolio.length > 1 ? `Valor final (mediana) (${k.moneda})` : 'Valor final (mediana)'}
            value={k.valorFinalMediana != null ? formatMoneda(k.valorFinalMediana, k.moneda) : '—'}
            dataGuia={guia && i === 0 ? 'kpi-valor-final' : undefined}
            onAbrirGuia={guia && i === 0 ? () => guia.iniciarEnSlot('kpis', 1) : undefined}
          />
        </Fragment>
      ))}
      <KpiCard
        label="Inflación acumulada (ARS)"
        value={inflacionAcumuladaArs != null ? formatPorcentaje((inflacionAcumuladaArs - 1) * 100) : '—'}
        tooltip={
          guia
            ? { term: 'Inflación acumulada (ARS)', definition: 'Mediana de la inflación acumulada simulada en pesos a lo largo del horizonte, escenario global.' }
            : undefined
        }
        dataGuia={guia ? 'kpi-inflacion-ars' : undefined}
        onAbrirGuia={guia ? () => guia.iniciarEnSlot('kpis', 2) : undefined}
      />
      <KpiCard
        label="Inflación acumulada (USD)"
        value={inflacionAcumuladaUsd != null ? formatPorcentaje((inflacionAcumuladaUsd - 1) * 100) : '—'}
        tooltip={
          guia
            ? { term: 'Inflación acumulada (USD)', definition: 'Mediana de la inflación acumulada simulada en dólares a lo largo del horizonte, escenario global.' }
            : undefined
        }
      />
    </div>
  )
}
