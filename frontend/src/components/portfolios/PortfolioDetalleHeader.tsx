import { Link, useNavigate } from 'react-router-dom'
import PerfilBadge from '@/components/portfolios/PerfilBadge'
import TipoCambioIndicator from '@/components/portfolios/TipoCambioIndicator'
import DisabledButtonTooltip from '@/components/ui/disabled-button-tooltip'
import { formatFecha } from '@/lib/format'
import type { PortfolioDetalle } from '@/types'

export default function PortfolioDetalleHeader({
  detalle,
  idPortfolio,
  tieneInstrumentos,
  archivado,
  isTogglingArchivado,
  onToggleArchivado,
  onEdit,
  onDelete,
}: {
  detalle: PortfolioDetalle
  idPortfolio: number
  tieneInstrumentos: boolean
  archivado: boolean
  isTogglingArchivado: boolean
  onToggleArchivado: () => void
  onEdit: () => void
  onDelete: () => void
}) {
  const navigate = useNavigate()

  return (
    <>
      <div className="breadcrumb-nav">
        <Link to={`/portfolios?perfil=${detalle.idPerfilRiesgo}`} className="hover:text-navy-950">
          Portfolios
        </Link>
        <span>/</span>
        <Link to={`/portfolios?perfil=${detalle.idPerfilRiesgo}`} className="hover:text-navy-950">
          {detalle.nombrePerfilRiesgo}
        </Link>
        <span>/</span>
        <span className="font-semibold text-navy-950">{detalle.nombre}</span>
      </div>
      <button onClick={() => navigate(-1)} className="btn-back">
        ← Volver
      </button>

      <div className="mb-6 flex flex-wrap items-start justify-between gap-5">
        <div>
          <div className="mb-1.5 flex flex-wrap items-center gap-2.5">
            <h1 className="page-title">{detalle.nombre}</h1>
            <PerfilBadge nombre={detalle.nombrePerfilRiesgo} />
          </div>
          <p className="text-[13px] text-ink-soft">
            Creado el {formatFecha(detalle.fechaCreacion)} · Última modificación{' '}
            {formatFecha(detalle.fechaModificacion)}
          </p>
          {detalle.capitalInicial != null && <TipoCambioIndicator />}
        </div>

        <div className="flex flex-wrap gap-2">
          <DisabledButtonTooltip
            title={
              archivado
                ? 'Reactivá el portfolio para poder simular.'
                : !tieneInstrumentos
                  ? 'Agregá al menos un instrumento para poder simular.'
                  : undefined
            }
          >
            <button
              onClick={() => navigate(`/portfolios/${idPortfolio}/simular`)}
              disabled={archivado || !tieneInstrumentos}
              className="btn-primary"
            >
              Nueva simulación
            </button>
          </DisabledButtonTooltip>
          <button onClick={onEdit} className="btn-secondary">
            Editar portfolio
          </button>
          <button onClick={onToggleArchivado} disabled={isTogglingArchivado} className="btn-secondary">
            {archivado ? 'Reactivar portfolio' : 'Archivar portfolio'}
          </button>
          <button onClick={onDelete} className="btn-danger-outline">
            Eliminar portfolio
          </button>
        </div>
      </div>

      {archivado && (
        <div className="mb-6 rounded-[10px] border border-line bg-white p-4 text-[13px] text-ink-muted">
          Portfolio archivado — reactivalo para poder agregar, editar o eliminar instrumentos.
        </div>
      )}
    </>
  )
}
