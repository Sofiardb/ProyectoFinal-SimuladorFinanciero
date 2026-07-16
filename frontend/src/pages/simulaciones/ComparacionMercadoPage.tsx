import { Link, useNavigate, useParams } from 'react-router-dom'
import { toast } from 'sonner'
import { Skeleton } from '@/components/ui/skeleton'
import InfoTooltip from '@/components/portfolios/InfoTooltip'
import { usePortfolio, usePortfolioPreview, useRefrescarMercado } from '@/api/hooks'
import { formatMoneda, formatPorcentaje } from '@/lib/format'
import { onErrorToast } from '@/lib/toast'
import { GBM_TOOLTIPS } from '@/lib/tooltips'
import type { InstrumentoPreviewItem } from '@/types'

interface Metrica {
  label:      string
  oldDisplay: string
  newDisplay: string
  subida:     boolean | null // null = sin cambio
  tooltip?:   { term: string; definition: string }
}

interface Fila {
  id:         string
  identifier: string
  tipoLabel:  string
  metricas:   Metrica[]
  notaMonto?: string
}

function cambio(a?: number, b?: number): boolean {
  if (a == null || b == null) return a !== b
  if (a === 0) return b !== 0
  return Math.abs((b - a) / a) >= 0.001
}

function construirFilas(instrumentos: InstrumentoPreviewItem[]): Fila[] {
  const filas: Fila[] = []

  for (const inst of instrumentos) {
    const metricas: Metrica[] = []
    let notaMonto: string | undefined

    // El usuario mantiene fija la cantidad (acciones: nro. de acciones; bono/letra: cantidad de lotes
    // de VN100) — lo que cambia con el mercado es el precio por unidad, no "cuánto invirtió" (eso es
    // un hecho histórico derivado). Comparamos el precio unitario y avisamos aparte que actualizarlo
    // mueve el monto invertido, usando el mismo término que el usuario vio al cargar la tenencia.
    if (inst.estado === 'ACTUALIZADO' && inst.precioMercado != null) {
      const moneda = inst.tipo === 'accion' ? 'USD' : 'ARS'
      const label = inst.tipo === 'accion' ? 'Precio (por acción)' : 'Precio (VN 100)'
      const prefijo = moneda === 'USD' ? 'USD ' : '$'
      const nombreCantidad = inst.tipo === 'accion' ? 'la misma cantidad de acciones' : 'la misma cantidad de lotes'
      metricas.push({
        label,
        oldDisplay: `${prefijo}${inst.precioOriginal.toFixed(2)}`,
        newDisplay: `${prefijo}${inst.precioMercado.toFixed(2)}`,
        subida: inst.precioMercado > inst.precioOriginal,
      })
      if (inst.montoMercado != null) {
        notaMonto = `Manteniendo ${nombreCantidad}, actualizar este precio hace que el monto invertido derive de ${formatMoneda(inst.montoOriginal, moneda)} a ${formatMoneda(inst.montoMercado, moneda)}.`
      }
    }

    if (inst.tipo === 'bono' || inst.tipo === 'letra') {
      if (inst.estadoTasa === 'ACTUALIZADO' && inst.tasaOriginal != null && inst.tasaMercado != null) {
        metricas.push({
          label: 'Tasa',
          oldDisplay: formatPorcentaje(inst.tasaOriginal * 100),
          newDisplay: formatPorcentaje(inst.tasaMercado * 100),
          subida: inst.tasaMercado > inst.tasaOriginal,
        })
      }
    }

    if (inst.tipo === 'accion' && inst.estadoTasa === 'ACTUALIZADO') {
      if (cambio(inst.muOriginal, inst.muMercado) && inst.muOriginal != null && inst.muMercado != null) {
        metricas.push({
          label: 'Retorno esperado (μ)',
          oldDisplay: formatPorcentaje(inst.muOriginal * 100),
          newDisplay: formatPorcentaje(inst.muMercado * 100),
          subida: inst.muMercado > inst.muOriginal,
          tooltip: GBM_TOOLTIPS.mu,
        })
      }
      if (cambio(inst.sigmaOriginal, inst.sigmaMercado) && inst.sigmaOriginal != null && inst.sigmaMercado != null) {
        metricas.push({
          label: 'Volatilidad (σ)',
          oldDisplay: formatPorcentaje(inst.sigmaOriginal * 100),
          newDisplay: formatPorcentaje(inst.sigmaMercado * 100),
          subida: inst.sigmaMercado > inst.sigmaOriginal,
          tooltip: GBM_TOOLTIPS.sigma,
        })
      }
      if (cambio(inst.rhoOriginal, inst.rhoMercado) && inst.rhoOriginal != null && inst.rhoMercado != null) {
        metricas.push({
          label: 'Correlación (ρ)',
          oldDisplay: formatPorcentaje(inst.rhoOriginal * 100),
          newDisplay: formatPorcentaje(inst.rhoMercado * 100),
          subida: inst.rhoMercado > inst.rhoOriginal,
          tooltip: GBM_TOOLTIPS.rho,
        })
      }
    }

    if (metricas.length > 0) {
      filas.push({
        id: inst.id,
        identifier: inst.ticker ?? inst.entidadFinanciera ?? inst.id,
        tipoLabel:
          inst.tipo === 'accion' ? 'Acciones' : inst.tipo === 'bono' ? 'Bono' : inst.tipo === 'letra' ? 'Letra' : inst.tipo,
        metricas,
        notaMonto,
      })
    }
  }

  return filas
}

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
        <Link to="/portfolios" className="mt-2 inline-block text-sm font-medium text-navy-950 underline">
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
        <h1 className="font-display text-2xl leading-tight font-bold text-navy-950 xl:text-[26px]">
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
          <div key={f.id} className="card flex flex-col gap-3">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="min-w-[160px]">
                <p className="text-[13.5px] font-semibold text-navy-950">{f.identifier}</p>
                <p className="mt-0.5 text-[11.5px] text-ink-soft">{f.tipoLabel}</p>
              </div>

              <div className="flex flex-1 flex-wrap justify-end gap-x-8 gap-y-3">
                {f.metricas.map((m) => (
                  <div key={m.label} className="flex items-center gap-3">
                    <div className="text-right">
                      <p className="mb-0.5 flex items-center justify-end gap-1 text-[10.5px] text-ink-soft uppercase">
                        {m.label}
                        {m.tooltip && <InfoTooltip term={m.tooltip.term} definition={m.tooltip.definition} />}
                      </p>
                      <p className="text-[13px] font-semibold text-ink-muted">{m.oldDisplay}</p>
                    </div>
                    <span
                      className={
                        m.subida === null
                          ? 'text-ink-soft'
                          : m.subida
                            ? 'text-accent-blue-strong'
                            : 'text-danger'
                      }
                    >
                      {m.subida === null ? '=' : m.subida ? '↑' : '↓'}
                    </span>
                    <div className="text-left">
                      <p className="mb-0.5 text-[10.5px] text-ink-soft uppercase">Hoy</p>
                      <p
                        className={
                          'text-[13px] font-bold ' + (m.subida === false ? 'text-danger' : 'text-accent-blue-strong')
                        }
                      >
                        {m.newDisplay}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {f.notaMonto && <p className="text-[11.5px] text-warning-text">⚠ {f.notaMonto}</p>}
          </div>
        ))}

        {filas.some((f) => f.metricas.some((m) => m.tooltip)) && (
          <p className="text-[12px] leading-relaxed text-ink-soft">
            Estos valores son una referencia histórica de cómo se comportó el ticker en el pasado — rendimientos
            pasados no garantizan resultados futuros.
          </p>
        )}
      </div>

      <div className="fixed inset-x-0 bottom-0 border-t border-line bg-white px-4 py-4 sm:px-6 lg:px-8">
        <div className="mx-auto flex max-w-[920px] flex-col gap-3">
          <p className="text-[12.5px] text-ink-soft">
            Podés mantener el portfolio tal como está, actualizarlo sin simular todavía, o actualizarlo y continuar
            hacia una nueva simulación con los datos de hoy.
          </p>
          <div className="flex flex-wrap gap-3">
            <button onClick={volverASimular} className="btn-secondary flex-1">
              Mantener como snapshot
            </button>
            <button
              onClick={actualizarSinSimular}
              disabled={refrescarMercado.isPending}
              className="btn-secondary flex-1"
            >
              Actualizar pero sin simular
            </button>
            <button
              onClick={actualizarYSimular}
              disabled={refrescarMercado.isPending}
              className="btn-primary flex-[1.4]"
            >
              Actualizar y continuar a simular
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
