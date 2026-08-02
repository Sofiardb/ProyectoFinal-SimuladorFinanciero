import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Skeleton } from '@/components/ui/skeleton'
import PortfolioCard from '@/components/portfolios/PortfolioCard'
import CreateEditPortfolioDialog from '@/components/portfolios/CreateEditPortfolioDialog'
import { getPerfilEstilo } from '@/components/portfolios/PerfilBadge'
import { usePerfilesRiesgo, usePortfolios } from '@/api/hooks'
import { cn } from '@/lib/utils'

export default function PortfoliosPage() {
  const { data: perfiles, isLoading: perfilesLoading } = usePerfilesRiesgo()
  const { data: portfolios, isLoading: portfoliosLoading } = usePortfolios()
  const [searchParams, setSearchParams] = useSearchParams()
  const [createOpen, setCreateOpen] = useState(false)

  const perfilParam = Number(searchParams.get('perfil'))
  const activeTab = perfiles?.some((p) => p.idPerfilRiesgo === perfilParam) ? perfilParam : undefined

  const setActiveTab = (idPerfilRiesgo: number) => {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev)
      next.set('perfil', String(idPerfilRiesgo))
      return next
    })
  }

  useEffect(() => {
    if (activeTab === undefined && perfiles && perfiles.length > 0) {
      setSearchParams((prev) => {
        const next = new URLSearchParams(prev)
        next.set('perfil', String(perfiles[0].idPerfilRiesgo))
        return next
      }, { replace: true })
    }
  }, [perfiles, activeTab, setSearchParams])

  const perfilActivo = perfiles?.find((p) => p.idPerfilRiesgo === activeTab)
  const estilo = perfilActivo ? getPerfilEstilo(perfilActivo.nombre) : null
  const portfoliosDelPerfil = (portfolios ?? [])
    .filter((p) => p.idPerfilRiesgo === activeTab)
    .sort((a, b) => Number(a.estado === 'ARCHIVADO') - Number(b.estado === 'ARCHIVADO'))

  return (
    <div className="page-shell-lg max-w-[1080px]">
      <div className="mb-7">
        <h1 className="mb-1.5 font-display text-2xl font-bold text-navy-950 xl:text-[28px]">
          Mis portfolios
        </h1>
        <p className="text-sm text-ink-muted">Organizados por perfil de riesgo.</p>
      </div>

      {perfilesLoading || !perfiles || !perfilActivo || !estilo ? (
        <div className="space-y-4">
          <Skeleton className="h-9 w-64" />
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-48 w-full" />
        </div>
      ) : (
        <>
          <div className="-mx-4 mb-7 overflow-x-auto px-4 sm:mx-0 sm:px-0">
            <div role="tablist" data-tour="tour-perfil-tabs" className="flex gap-2 border-b-[1.5px] border-line">
              {perfiles.map((p) => {
                const isActive = p.idPerfilRiesgo === activeTab
                return (
                  <button
                    key={p.idPerfilRiesgo}
                    role="tab"
                    type="button"
                    aria-selected={isActive}
                    onClick={() => setActiveTab(p.idPerfilRiesgo)}
                    className={cn(
                      'shrink-0 cursor-pointer whitespace-nowrap border-b-[2.5px] border-transparent px-1.5 pb-3.5 font-display text-[14.5px] font-semibold transition-colors',
                      isActive
                        ? 'border-navy-950 text-navy-950'
                        : 'text-ink-soft hover:text-navy-950',
                    )}
                  >
                    {p.nombre}
                  </button>
                )
              })}
            </div>
          </div>

          {perfilActivo.descripcion && (
            <div className="mb-7 flex items-start gap-5 rounded-xl border border-line bg-white p-4 sm:px-7 sm:py-6">
              <div
                className={cn(
                  'flex size-[38px] shrink-0 items-center justify-center rounded-[9px]',
                  estilo.iconBg,
                )}
              >
                <span className={cn('size-3.5 rounded-full', estilo.dotBg)} />
              </div>
              <div className="flex-1">
                <p className="mb-1 font-display text-base font-semibold text-navy-950">
                  Perfil {perfilActivo.nombre}
                </p>
                <p className="max-w-[680px] text-[13.5px] leading-[1.6] text-ink-muted">
                  {perfilActivo.descripcion}
                </p>
              </div>

              {portfoliosDelPerfil.length >= 3 && (
                <button
                  type="button"
                  onClick={() => setCreateOpen(true)}
                  className="btn-primary shrink-0 self-center"
                >
                  + Crear portfolio
                </button>
              )}
            </div>
          )}

          {portfoliosLoading ? (
            <div className="grid grid-cols-1 gap-5 lg:grid-cols-2 xl:grid-cols-[repeat(auto-fit,minmax(320px,1fr))]">
              <Skeleton className="h-52 w-full" />
              <Skeleton className="h-52 w-full" />
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-5 lg:grid-cols-2 xl:grid-cols-[repeat(auto-fit,minmax(320px,1fr))]">
              {portfoliosDelPerfil.map((portfolio) => (
                <PortfolioCard key={portfolio.idPortfolio} portfolio={portfolio} />
              ))}

              <button
                data-tour="tour-crear-portfolio"
                onClick={() => setCreateOpen(true)}
                className="flex min-h-[200px] flex-col items-center justify-center gap-2.5 rounded-xl border-[1.5px] border-dashed border-line-dashed p-6 transition-colors hover:border-navy-950/40 hover:bg-chip"
              >
                <span className="flex size-[34px] items-center justify-center rounded-full bg-sand-50 text-lg font-semibold text-navy-950">
                  +
                </span>
                <span className="text-[13.5px] font-semibold text-navy-950">
                  Crear portfolio {perfilActivo.nombre}
                </span>
              </button>
            </div>
          )}
        </>
      )}

      <CreateEditPortfolioDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        defaultPerfilId={activeTab}
      />
    </div>
  )
}
