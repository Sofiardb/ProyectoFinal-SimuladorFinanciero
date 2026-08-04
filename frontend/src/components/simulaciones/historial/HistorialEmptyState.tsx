import { Link } from 'react-router-dom'
import type { PerfilRiesgo } from '@/types'

interface Props {
  sinPortfolios: boolean
  sinPortfolioDeEstePerfil: boolean
  sinSimulacionesEnAbsoluto: boolean
  haySimulable: boolean
  perfilSeleccionado?: PerfilRiesgo
  linkRevisarPortfolios: string
  onCrear: () => void
  onVerTodas: () => void
}

export default function HistorialEmptyState({
  sinPortfolios,
  sinPortfolioDeEstePerfil,
  sinSimulacionesEnAbsoluto,
  haySimulable,
  perfilSeleccionado,
  linkRevisarPortfolios,
  onCrear,
  onVerTodas,
}: Props) {
  const nombrePerfil = perfilSeleccionado?.nombre.toLowerCase() ?? 'seleccionado'

  return (
    <div className="fade-in-content card text-[13.5px] text-ink-muted">
      {sinPortfolios ? (
        <>
          Todavía no tenés portfolios.{' '}
          <button type="button" onClick={onCrear} className="link-inline">
            Creá uno
          </button>{' '}
          para poder simular.
        </>
      ) : sinPortfolioDeEstePerfil ? (
        <>
          No tenés un portfolio con perfil{' '}
          <span className="font-semibold text-navy-950">{nombrePerfil}</span>
          .{' '}
          <button type="button" onClick={onCrear} className="link-inline">
            Creá uno
          </button>
          {!sinSimulacionesEnAbsoluto && (
            <>
              {' '}o{' '}
              <button type="button" onClick={onVerTodas} className="link-inline">
                mirá las simulaciones disponibles
              </button>
            </>
          )}
          .
        </>
      ) : sinSimulacionesEnAbsoluto ? (
        haySimulable ? (
          <>
            Todavía no corriste ninguna simulación.{' '}
            <Link to="/simulaciones/nueva" className="link-inline">
              Lanzá una
            </Link>
            .
          </>
        ) : (
          <>
            Todavía no corriste ninguna simulación y los portfolios disponibles no cumplen
            con las condiciones para lanzar una simulación.{' '}
            <Link to={linkRevisarPortfolios} className="link-inline">
              Revisá tus portfolios
            </Link>
            .
          </>
        )
      ) : (
        <>
          No tenés simulaciones con perfil{' '}
          <span className="font-semibold text-navy-950">{nombrePerfil}</span>
          .{' '}
          {haySimulable ? (
            <Link to="/simulaciones/nueva" className="link-inline">
              Lanzá una
            </Link>
          ) : (
            <Link to={linkRevisarPortfolios} className="link-inline">
              Revisá tus portfolios
            </Link>
          )}{' '}
          o{' '}
          <button type="button" onClick={onVerTodas} className="link-inline">
            mirá todas
          </button>
          .
        </>
      )}
    </div>
  )
}
