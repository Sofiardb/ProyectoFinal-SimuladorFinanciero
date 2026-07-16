import { useNavigate } from 'react-router-dom'
import { Card } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import GrupoMonedaList from '@/components/portfolios/GrupoMonedaList'
import { usePortfolio, useBonosCatalogo, useLetrasCatalogo } from '@/api/hooks'
import {
  accionCardDisplay,
  bonoCardDisplay,
  bonoCatalogoPorId,
  letraCardDisplay,
  letraCatalogoPorId,
  plazoFijoCardDisplay,
  type CardDisplay,
} from '@/lib/tenenciaDisplay'
import { formatFecha } from '@/lib/format'
import { cn } from '@/lib/utils'
import type { PortfolioResumen } from '@/types'

const BUDGET = 5

export default function PortfolioCard({ portfolio }: { portfolio: PortfolioResumen }) {
  const navigate = useNavigate()
  const { data: detalle, isLoading } = usePortfolio(portfolio.idPortfolio)
  const { data: bonosCatalogo } = useBonosCatalogo()
  const { data: letrasCatalogo } = useLetrasCatalogo()
  const archivado = portfolio.estado === 'ARCHIVADO'

  const bonosPorId = bonoCatalogoPorId(bonosCatalogo)
  const letrasPorId = letraCatalogoPorId(letrasCatalogo)

  const usdItems: CardDisplay[] = detalle
    ? [
        ...detalle.acciones.map(accionCardDisplay),
        ...detalle.plazosFijos.filter((pf) => pf.codigoMoneda === 'USD').map(plazoFijoCardDisplay),
      ]
    : []
  const arsItems: CardDisplay[] = detalle
    ? [
        ...detalle.bonos.map((b) => bonoCardDisplay(b, bonosPorId)),
        ...detalle.letras.map((l) => letraCardDisplay(l, letrasPorId)),
        ...detalle.plazosFijos.filter((pf) => pf.codigoMoneda === 'ARS').map(plazoFijoCardDisplay),
      ]
    : []

  const totalCount = usdItems.length + arsItems.length
  const visibleUsd = usdItems.slice(0, BUDGET)
  const remainingBudget = BUDGET - visibleUsd.length
  const visibleArs = arsItems.slice(0, remainingBudget)
  const hiddenCount = totalCount - (visibleUsd.length + visibleArs.length)

  return (
    <Card className={cn('gap-4 border-line p-6', archivado && 'opacity-60')}>
      <div className="flex items-start justify-between">
        <div className="min-w-0">
          <p className="truncate font-display text-base font-semibold text-navy-950">
            {portfolio.nombre}
          </p>
          <p className="mt-[3px] text-xs text-ink-soft">
            Creado el {formatFecha(portfolio.fechaCreacion)}
            {archivado ? ' · Archivado' : ''}
          </p>
        </div>
        <button
          onClick={() => navigate(`/portfolios/${portfolio.idPortfolio}/simular`)}
          className="h-8 shrink-0 whitespace-nowrap rounded-[7px] bg-sand-50 px-3 text-xs font-semibold text-navy-950 hover:bg-sand-100"
        >
          Simular
        </button>
      </div>

      {isLoading && (
        <div className="space-y-2">
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-2/3" />
        </div>
      )}

      {visibleUsd.length > 0 && (
        <GrupoMonedaList titulo="USD · ACCIONES Y PLAZO FIJO" tituloClassName="text-blue-brand" items={visibleUsd} />
      )}
      {visibleArs.length > 0 && (
        <GrupoMonedaList titulo="ARS · BONOS, LETRAS Y PLAZO FIJO" tituloClassName="text-currency-ars" items={visibleArs} />
      )}
      {detalle && totalCount === 0 && (
        <p className="text-sm text-ink-muted">Todavía no tiene instrumentos.</p>
      )}
      {hiddenCount > 0 && (
        <div className="flex items-center justify-between rounded-lg bg-line-soft px-3 py-[9px]">
          <span className="text-[12.5px] font-semibold text-ink-muted">+{hiddenCount} más…</span>
        </div>
      )}

      <div className="flex justify-end border-t border-line-soft pt-1">
        <button
          onClick={() => navigate(`/portfolios/${portfolio.idPortfolio}`)}
          className="text-[13px] font-semibold text-navy-950 hover:underline"
        >
          Ver detalle →
        </button>
      </div>
    </Card>
  )
}
