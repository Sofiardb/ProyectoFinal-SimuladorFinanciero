import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Skeleton } from '@/components/ui/skeleton'
import PortfolioCard from '@/components/portfolios/PortfolioCard'
import { usePerfilesRiesgo, usePortfolios, usePortfoliosConInstrumentos } from '@/api/hooks'

const PORTFOLIOS_POR_PAGINA = 9

export default function SeleccionarPortfolio() {
  const { data: perfiles, isLoading: loadingPerfiles } = usePerfilesRiesgo()
  const { data: todosLosPortfolios } = usePortfolios()
  const { data: portfolios, isLoading: loadingPortfolios } = usePortfoliosConInstrumentos()
  const [pagina, setPagina] = useState(1)

  const isLoading = loadingPerfiles || loadingPortfolios

  const ordenPerfil = new Map((perfiles ?? []).map((p, idx) => [p.idPerfilRiesgo, idx]))
  const portfoliosOrdenados = [...(portfolios ?? [])].sort(
    (a, b) => (ordenPerfil.get(a.idPerfilRiesgo) ?? 0) - (ordenPerfil.get(b.idPerfilRiesgo) ?? 0),
  )

  const totalPaginas = Math.max(1, Math.ceil(portfoliosOrdenados.length / PORTFOLIOS_POR_PAGINA))
  const paginaActual = Math.min(pagina, totalPaginas)
  const inicio = (paginaActual - 1) * PORTFOLIOS_POR_PAGINA
  const visibles = portfoliosOrdenados.slice(inicio, inicio + PORTFOLIOS_POR_PAGINA)

  return (
    <div className="page-shell-lg max-w-[1080px]">
      <div className="mb-7">
        <h1 className="page-title mb-1.5">
          Nueva simulación
        </h1>
        <p className="text-sm text-ink-muted">Elegí para qué portfolio querés correr una simulación.</p>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-2 xl:grid-cols-3">
          <Skeleton className="h-52 w-full" />
          <Skeleton className="h-52 w-full" />
          <Skeleton className="h-52 w-full" />
        </div>
      ) : portfoliosOrdenados.length === 0 ? (
        <div className="card text-[13.5px] text-ink-muted">
          {todosLosPortfolios && todosLosPortfolios.length > 0 ? (
            <>
              Todavía no tenés un portfolio activo con instrumentos cargados.{' '}
              <Link to="/portfolios" className="font-semibold text-navy-950 underline">
                Revisá tus portfolios
              </Link>{' '}
              para poder simular.
            </>
          ) : (
            <>
              Todavía no tenés portfolios.{' '}
              <Link to="/portfolios" className="font-semibold text-navy-950 underline">
                Creá uno
              </Link>{' '}
              para poder simular.
            </>
          )}
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-5 lg:grid-cols-2 xl:grid-cols-3">
            {visibles.map((portfolio) => (
              <PortfolioCard key={portfolio.idPortfolio} portfolio={portfolio} mostrarPerfil />
            ))}
          </div>

          {totalPaginas > 1 && (
            <div className="mt-7 flex items-center justify-center gap-4">
              <button
                onClick={() => setPagina((p) => Math.max(1, p - 1))}
                disabled={paginaActual === 1}
                className="btn-secondary disabled:cursor-not-allowed disabled:opacity-40"
              >
                ← Anterior
              </button>
              <span className="text-[13px] text-ink-muted">
                Página {paginaActual} de {totalPaginas}
              </span>
              <button
                onClick={() => setPagina((p) => Math.min(totalPaginas, p + 1))}
                disabled={paginaActual === totalPaginas}
                className="btn-secondary disabled:cursor-not-allowed disabled:opacity-40"
              >
                Siguiente →
              </button>
            </div>
          )}
        </>
      )}
    </div>
  )
}
