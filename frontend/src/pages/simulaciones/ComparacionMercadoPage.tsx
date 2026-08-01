import { Link, useNavigate, useParams } from 'react-router-dom'
import { toast } from 'sonner'
import { Skeleton } from '@/components/ui/skeleton'
import AccionesComparacionMercado from '@/components/simulaciones/AccionesComparacionMercado'
import FilaComparacionMercadoCard from '@/components/simulaciones/FilaComparacionMercadoCard'
import { usePortfolio, usePortfolioPreview, useRefrescarMercado } from '@/api/hooks'
import { construirFilas } from '@/lib/comparacionMercado'
import { onErrorToast } from '@/lib/toast'

export default function ComparacionMercadoPage() {
  const { id } = useParams<{ id: string }>()
  const idPortfolio = Number(id)
  const navigate = useNavigate()

  const { data: detalle, isLoading: loadingPortfolio } = usePortfolio(idPortfolio)
  const { data: preview, isLoading: loadingPreview } = usePortfolioPreview(idPortfolio)
  const refrescarMercado = useRefrescarMercado(idPortfolio)

  if (loadingPortfolio || loadingPreview) {
    return (
      <div className="page-shell max-w-[920px] space-y-4">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-32 w-full" />
      </div>
    )
  }

  if (!detalle || !preview) {
    return (
      <div className="page-shell max-w-[920px] text-center">
        <p className="text-ink-muted">No se encontró el portfolio.</p>
        <Link to="/portfolios" className="link-back-fallback">
          Volver a mis portfolios
        </Link>
      </div>
    )
  }

  const filas = construirFilas(preview.instrumentos)
  const totalInstrumentos = preview.instrumentos.filter((i) => i.tipo !== 'plazo_fijo').length

  const volverASimular = () => navigate(`/portfolios/${idPortfolio}/simular`)

  const actualizarSinSimular = () => {
    refrescarMercado.mutate(undefined, {
      onSuccess: () => {
        toast.success('Portfolio actualizado con los datos de mercado de hoy.')
        navigate(`/portfolios/${idPortfolio}`)
      },
      onError: onErrorToast,
    })
  }

  const actualizarYSimular = () => {
    refrescarMercado.mutate(undefined, {
      onSuccess: () => {
        toast.success('Portfolio actualizado. Elegí el horizonte para lanzar la simulación.')
        volverASimular()
      },
      onError: onErrorToast,
    })
  }

  return (
    <div className="page-shell max-w-[920px] pb-32">
      <div className="breadcrumb-nav">
        <Link to={`/portfolios?perfil=${detalle.idPerfilRiesgo}`} className="hover:text-navy-950">
          Portfolios
        </Link>
        <span>/</span>
        <Link to={`/portfolios/${idPortfolio}`} className="hover:text-navy-950">
          {detalle.nombre}
        </Link>
        <span>/</span>
        <span className="font-semibold text-navy-950">Comparar versiones</span>
      </div>
      <button onClick={() => navigate(-1)} className="btn-back">
        ← Volver
      </button>

      <div className="mb-2">
        <h1 className="page-title">
          Comparar versiones
        </h1>
        <p className="mt-2 max-w-[640px] text-[13.5px] leading-relaxed text-ink-muted">
          {detalle.nombre} tiene instrumentos con datos de mercado más recientes que los del snapshot con el que fue
          armado. Elegí cómo continuar antes de simular.
        </p>
      </div>

      <div className="banner-warning my-5 flex items-start gap-3">
        <span className="text-base">⚠</span>
        <span>
          Se detectaron actualizaciones de mercado en <b>{filas.length}</b> de <b>{totalInstrumentos}</b> instrumentos.
        </span>
      </div>

      <div className="flex flex-col gap-4">
        {filas.map((f) => (
          <FilaComparacionMercadoCard key={f.id} fila={f} />
        ))}

        {filas.some((f) => f.metricas.some((m) => m.tooltip)) && (
          <p className="text-[12px] leading-relaxed text-ink-soft">
            Estos valores son una referencia histórica de cómo se comportó el ticker en el pasado — rendimientos
            pasados no garantizan resultados futuros.
          </p>
        )}
      </div>

      <AccionesComparacionMercado
        isPending={refrescarMercado.isPending}
        onMantener={volverASimular}
        onActualizarSinSimular={actualizarSinSimular}
        onActualizarYSimular={actualizarYSimular}
      />
    </div>
  )
}
