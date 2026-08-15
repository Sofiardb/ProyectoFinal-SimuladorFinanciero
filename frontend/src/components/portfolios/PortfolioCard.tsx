import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Pencil, Trash2 } from 'lucide-react'
import { Card } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import DisabledButtonTooltip from '@/components/ui/disabled-button-tooltip'
import GrupoMonedaList from '@/components/portfolios/GrupoMonedaList'
import PerfilBadge from '@/components/portfolios/PerfilBadge'
import PresupuestoBoxes from '@/components/portfolios/PresupuestoBoxes'
import CreateEditPortfolioDialog from '@/components/portfolios/CreateEditPortfolioDialog'
import DeletePortfolioDialog from '@/components/portfolios/DeletePortfolioDialog'
import { usePortfolio, useBonosCatalogo, useLetrasCatalogo } from '@/api/hooks'
import { useTienePortfolioInstrumentos } from '@/hooks/usePortfolioInstrumentos'
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

export default function PortfolioCard({
  portfolio,
  mostrarPerfil = false,
}: {
  portfolio: PortfolioResumen
  mostrarPerfil?: boolean
}) {
  const navigate = useNavigate()
  const [editOpen, setEditOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const { data: detalle, isLoading } = usePortfolio(portfolio.idPortfolio)
  const { data: bonosCatalogo } = useBonosCatalogo()
  const { data: letrasCatalogo } = useLetrasCatalogo()
  const archivado = portfolio.estado === 'ARCHIVADO'
  const tieneInstrumentos = useTienePortfolioInstrumentos(detalle)

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
    <Card className={cn('h-full gap-4 border-line p-6', archivado && 'opacity-60')}>
      <div className="flex items-start justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <p className="truncate font-display text-base font-semibold text-navy-950">
              {portfolio.nombre}
            </p>
            {mostrarPerfil && <PerfilBadge nombre={portfolio.nombrePerfilRiesgo} />}
          </div>
          <p className="mt-[3px] text-xs text-ink-soft">
            Creado el {formatFecha(portfolio.fechaCreacion)}
            {archivado ? ' · Archivado' : ''}
          </p>
        </div>
        <DisabledButtonTooltip
          className="shrink-0"
          title={
            archivado
              ? 'Reactivá el portfolio para poder simular.'
              : !tieneInstrumentos
                ? 'Agregá al menos un instrumento para poder simular.'
                : undefined
          }
        >
          <button
            onClick={() => navigate(`/portfolios/${portfolio.idPortfolio}/simular`)}
            disabled={archivado || !tieneInstrumentos}
            className="h-8 whitespace-nowrap rounded-[7px] bg-sand-50 px-3 text-xs font-semibold text-navy-950 hover:bg-sand-100 disabled:pointer-events-none disabled:opacity-40"
          >
            Simular
          </button>
        </DisabledButtonTooltip>
      </div>

      {isLoading && (
        <div className="space-y-2">
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-2/3" />
        </div>
      )}

      {detalle && <PresupuestoBoxes detalle={detalle} />}

      {visibleUsd.length > 0 && (
        <GrupoMonedaList
          titulo="USD · ACCIONES Y PLAZO FIJO"
          tituloClassName="text-currency-usd"
          items={visibleUsd}
          idPortfolio={portfolio.idPortfolio}
        />
      )}
      {visibleArs.length > 0 && (
        <GrupoMonedaList
          titulo="ARS · BONOS, LETRAS Y PLAZO FIJO"
          tituloClassName="text-currency-ars"
          items={visibleArs}
          idPortfolio={portfolio.idPortfolio}
        />
      )}
      {detalle && totalCount === 0 && (
        <div className="flex flex-col items-start gap-2">
          <p className="text-sm text-ink-muted">Todavía no tiene instrumentos.</p>
          <button
            onClick={() => navigate(`/portfolios/${portfolio.idPortfolio}`)}
            className="h-8 shrink-0 rounded-[7px] bg-navy-950 px-3 text-xs font-semibold text-white hover:bg-navy-900"
          >
            Agregar instrumentos
          </button>
        </div>
      )}
      {hiddenCount > 0 && (
        <div className="flex items-center justify-between rounded-lg bg-line-soft px-3 py-[9px]">
          <span className="text-[12.5px] font-semibold text-ink-muted">+{hiddenCount} más…</span>
        </div>
      )}

      <div className="mt-auto flex items-center justify-between border-t border-line-soft pt-1">
        <div className="flex items-center gap-1">
          <button
            onClick={() => setEditOpen(true)}
            title="Editar portfolio"
            aria-label="Editar portfolio"
            className="rounded-md p-1.5 text-ink-muted hover:bg-line-soft hover:text-navy-950"
          >
            <Pencil className="size-4" />
          </button>
          <button
            onClick={() => setDeleteOpen(true)}
            title="Eliminar portfolio"
            aria-label="Eliminar portfolio"
            className="rounded-md p-1.5 text-ink-muted hover:bg-line-soft hover:text-danger"
          >
            <Trash2 className="size-4" />
          </button>
        </div>
        <button
          onClick={() => navigate(`/portfolios/${portfolio.idPortfolio}`)}
          className="text-[13px] font-semibold text-navy-950 hover:underline"
        >
          Ver detalle →
        </button>
      </div>

      <CreateEditPortfolioDialog open={editOpen} onOpenChange={setEditOpen} portfolio={portfolio} />
      <DeletePortfolioDialog open={deleteOpen} onOpenChange={setDeleteOpen} portfolio={portfolio} />
    </Card>
  )
}
