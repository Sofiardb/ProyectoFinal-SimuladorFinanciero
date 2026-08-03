import { useMemo } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { Skeleton } from '@/components/ui/skeleton'
import { SlowLoadingHint } from '@/components/ui/slow-loading-hint'
import { FilaComparacion } from '@/components/simulaciones/comparar/ComparacionGrid'
import ComparacionSimulaciones from '@/components/simulaciones/comparar/ComparacionSimulaciones'
import SelectorSimulacion, { type Grupo } from '@/components/simulaciones/comparar/SelectorSimulacion'
import { useTodasLasSimulaciones } from '@/api/hooks'

export default function CompararPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const { data: simulaciones, isLoading } = useTodasLasSimulaciones()

  const idA = searchParams.get('a') ? Number(searchParams.get('a')) : null
  const idB = searchParams.get('b') ? Number(searchParams.get('b')) : null

  const grupos: Grupo[] = useMemo(() => {
    const mapa = new Map<number, Grupo>()
    for (const s of simulaciones) {
      if (!mapa.has(s.idPortfolio)) mapa.set(s.idPortfolio, { idPortfolio: s.idPortfolio, nombrePortfolio: s.nombrePortfolio, items: [] })
      mapa.get(s.idPortfolio)!.items.push(s)
    }
    return Array.from(mapa.values())
  }, [simulaciones])

  function setId(cual: 'a' | 'b', id: number | null) {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev)
      if (id == null) next.delete(cual)
      else next.set(cual, String(id))
      return next
    })
  }

  return (
    <div className="page-shell max-w-[1080px]">
      <div className="breadcrumb-nav">
        <Link to="/simulaciones" className="hover:text-navy-950">Historial</Link>
        <span>/</span>
        <span className="font-semibold text-navy-950">Comparar simulaciones</span>
      </div>

      <div className="mb-6">
        <h1 className="page-title mb-1.5">
          Comparar simulaciones
        </h1>
        <p className="text-[13.5px] text-ink-muted">Elegí dos corridas (del mismo portfolio o de distintos) para ponerlas lado a lado.</p>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <Skeleton className="h-11 w-full" />
          <Skeleton className="h-11 w-full" />
          <SlowLoadingHint isLoading={isLoading} />
        </div>
      ) : (
        <div className="fade-in-content">
          <FilaComparacion>
            <SelectorSimulacion idSimulacion={idA} onChange={(id) => setId('a', id)} grupos={grupos} />
            <SelectorSimulacion idSimulacion={idB} onChange={(id) => setId('b', id)} grupos={grupos} />
          </FilaComparacion>

          <ComparacionSimulaciones idA={idA} idB={idB} />
        </div>
      )}
    </div>
  )
}
