import { useState, type ReactNode } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { toast } from 'sonner'
import { Skeleton } from '@/components/ui/skeleton'
import PerfilBadge from '@/components/portfolios/PerfilBadge'
import TipoCambioIndicator from '@/components/portfolios/TipoCambioIndicator'
import PresupuestoBoxes from '@/components/portfolios/PresupuestoBoxes'
import CreateEditPortfolioDialog from '@/components/portfolios/CreateEditPortfolioDialog'
import DeletePortfolioDialog from '@/components/portfolios/DeletePortfolioDialog'
import CatalogoTenenciaSection, {
  type CatalogoOpcion,
  type TenenciaItem,
} from '@/components/portfolios/tenencias/CatalogoTenenciaSection'
import PlazoFijoSection from '@/components/portfolios/tenencias/PlazoFijoSection'
import ValorPorMoneda from '@/components/simulaciones/ValorPorMoneda'
import {
  usePortfolio,
  usePerfilesRiesgo,
  useMonedas,
  useAccionesCatalogo,
  useBonosCatalogo,
  useLetrasCatalogo,
  useTiposPlazoFijo,
  useAddAccion,
  useUpdateAccion,
  useDeleteAccion,
  useAddBono,
  useUpdateBono,
  useDeleteBono,
  useAddLetra,
  useUpdateLetra,
  useDeleteLetra,
  useAddPlazoFijo,
  useUpdatePlazoFijo,
  useDeletePlazoFijo,
  useUpdatePortfolio,
  useSimulacionesPortfolio,
} from '@/api/hooks'
import { useTienePortfolioInstrumentos } from '@/hooks/usePortfolioInstrumentos'
import {
  accionPreview,
  accionCatalogoPorId,
  accionRow,
  bonoPreview,
  bonoCatalogoPorId,
  bonoRow,
  letraPreview,
  letraCatalogoPorId,
  letraRow,
} from '@/lib/tenenciaDisplay'
import { formatFecha, formatMoneda } from '@/lib/format'
import { onErrorToast } from '@/lib/toast'
import { SECCION_TOOLTIPS, CANTIDAD_LOTES_TOOLTIP_BONO, CANTIDAD_LOTES_TOOLTIP_LETRA } from '@/lib/tooltips'

/** Limpia el error previo, ejecuta la mutación y, si falla, guarda el mensaje y relanza (para que el formulario que llama quede abierto). */
async function conCaptura(setError: (mensaje: string | null) => void, fn: () => Promise<unknown>): Promise<void> {
  setError(null)
  try {
    await fn()
  } catch (error) {
    setError((error as Error).message)
    throw error
  }
}

export default function PortfolioDetallePage() {
  const { id } = useParams<{ id: string }>()
  const idPortfolio = Number(id)
  const navigate = useNavigate()

  const { data: detalle, isLoading } = usePortfolio(idPortfolio)
  const tieneInstrumentos = useTienePortfolioInstrumentos(detalle)
  const { data: simulaciones } = useSimulacionesPortfolio(idPortfolio)
  const { data: perfiles } = usePerfilesRiesgo()
  const { data: monedas } = useMonedas()
  const { data: accionesCatalogo } = useAccionesCatalogo()
  const { data: bonosCatalogo } = useBonosCatalogo()
  const { data: letrasCatalogo } = useLetrasCatalogo()
  const { data: tiposPlazoFijo } = useTiposPlazoFijo()

  const addAccion = useAddAccion(idPortfolio)
  const updateAccion = useUpdateAccion(idPortfolio)
  const deleteAccion = useDeleteAccion(idPortfolio)
  const addBono = useAddBono(idPortfolio)
  const updateBono = useUpdateBono(idPortfolio)
  const deleteBono = useDeleteBono(idPortfolio)
  const addLetra = useAddLetra(idPortfolio)
  const updateLetra = useUpdateLetra(idPortfolio)
  const deleteLetra = useDeleteLetra(idPortfolio)
  const addPlazoFijo = useAddPlazoFijo(idPortfolio)
  const updatePlazoFijo = useUpdatePlazoFijo(idPortfolio)
  const deletePlazoFijo = useDeletePlazoFijo(idPortfolio)
  const updatePortfolio = useUpdatePortfolio(idPortfolio)

  const [editOpen, setEditOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)

  const [errorAcciones, setErrorAcciones] = useState<string | null>(null)
  const [errorBonos, setErrorBonos] = useState<string | null>(null)
  const [errorLetras, setErrorLetras] = useState<string | null>(null)
  const [errorPlazoFijoUsd, setErrorPlazoFijoUsd] = useState<string | null>(null)
  const [errorPlazoFijoArs, setErrorPlazoFijoArs] = useState<string | null>(null)

  if (isLoading) {
    return (
      <div className="page-shell max-w-[1080px] space-y-4">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-40 w-full" />
        <Skeleton className="h-40 w-full" />
      </div>
    )
  }

  if (!detalle) {
    return (
      <div className="page-shell max-w-[1080px] text-center">
        <p className="text-ink-muted">No se encontró el portfolio.</p>
        <Link to="/portfolios" className="mt-2 inline-block text-sm font-medium text-navy-950 underline">
          Volver a mis portfolios
        </Link>
      </div>
    )
  }

  const sigmaMaxAccion = perfiles?.find((p) => p.idPerfilRiesgo === detalle.idPerfilRiesgo)?.sigmaMaxAccion
  const idMonedaUsd = monedas?.find((m) => m.codigoIso === 'USD')?.idMoneda
  const idMonedaArs = monedas?.find((m) => m.codigoIso === 'ARS')?.idMoneda
  const archivado = detalle.estado === 'ARCHIVADO'
  const perfilLower = detalle.nombrePerfilRiesgo.toLowerCase()

  const bonosPorId = bonoCatalogoPorId(bonosCatalogo)
  const letrasPorId = letraCatalogoPorId(letrasCatalogo)
  const accionesPorId = accionCatalogoPorId(accionesCatalogo)

  const tiposPfUsd = (tiposPlazoFijo ?? []).filter((t) => t.codigo === 'TRADICIONAL')
  const tiposPfArs = tiposPlazoFijo ?? []

  const handleToggleArchivado = () => {
    updatePortfolio.mutate(
      { estado: archivado ? 'ACTIVO' : 'ARCHIVADO' },
      {
        onSuccess: () => toast.success(archivado ? 'Portfolio reactivado.' : 'Portfolio archivado.'),
        onError: onErrorToast,
      },
    )
  }

  // ─── Acciones ────────────────────────────────────────────────────────────
  const accionesTenencias: TenenciaItem[] = detalle.acciones.map((a) => ({
    idCatalogo: a.idAccion,
    cantidadActual: a.cantidad,
    ...accionRow(a, accionesPorId),
  }))
  const accionesOpciones: CatalogoOpcion[] = (accionesCatalogo ?? [])
    .filter((a) => !detalle.acciones.some((existing) => existing.idAccion === a.idAccion))
    .filter((a) => sigmaMaxAccion == null || a.sigmaVolatilidad == null || a.sigmaVolatilidad <= sigmaMaxAccion)
    .map((a) => ({
      id: a.idAccion,
      etiqueta: `${a.ticker} - ${a.nombre}`,
      previewFields: accionPreview({
        sector: a.sector,
        precioActual: a.precioActual,
        mu: a.muRetornoEsperado,
        sigma: a.sigmaVolatilidad,
        rho: a.rhoCorrelacionIndice,
      }),
      precioActual: a.precioActual ?? 0,
    }))

  // ─── Bonos ───────────────────────────────────────────────────────────────
  const bonosTenencias: TenenciaItem[] = detalle.bonos.map((b) => ({
    idCatalogo: b.idBono,
    cantidadActual: b.cantidad,
    ...bonoRow(b, bonosPorId),
  }))
  const bonosOpciones: CatalogoOpcion[] = (bonosCatalogo ?? [])
    .filter((b) => !detalle.bonos.some((existing) => existing.idBono === b.idBono))
    .map((b) => ({
      id: b.idBono,
      etiqueta: `${b.ticker} - ${b.nombre}`,
      previewFields: bonoPreview(b),
      precioActual: b.precioActual ?? 0,
    }))

  // ─── Letras ──────────────────────────────────────────────────────────────
  const letrasTenencias: TenenciaItem[] = detalle.letras.map((l) => ({
    idCatalogo: l.idLetra,
    cantidadActual: l.cantidad,
    ...letraRow(l, letrasPorId),
  }))
  const letrasOpciones: CatalogoOpcion[] = (letrasCatalogo ?? [])
    .filter((l) => !detalle.letras.some((existing) => existing.idLetra === l.idLetra))
    .map((l) => ({
      id: l.idLetra,
      etiqueta: `${l.ticker} - ${l.nombre}`,
      previewFields: letraPreview(l),
      precioActual: l.precioActual ?? 0,
    }))

  return (
    <div className="page-shell max-w-[1080px]">
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
            <h1 className="font-display text-2xl leading-tight font-bold text-navy-950 xl:text-[26px]">
              {detalle.nombre}
            </h1>
            <PerfilBadge nombre={detalle.nombrePerfilRiesgo} />
          </div>
          <p className="text-[13px] text-ink-soft">
            Creado el {formatFecha(detalle.fechaCreacion)} · Última modificación{' '}
            {formatFecha(detalle.fechaModificacion)}
          </p>
          {detalle.capitalInicial != null && <TipoCambioIndicator />}
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => navigate(`/portfolios/${idPortfolio}/simular`)}
            disabled={archivado || !tieneInstrumentos}
            title={!archivado && !tieneInstrumentos ? 'Agregá al menos un instrumento para poder simular.' : undefined}
            className="btn-primary"
          >
            Nueva simulación
          </button>
          <button onClick={() => setEditOpen(true)} className="btn-secondary">
            Editar portfolio
          </button>
          <button
            onClick={handleToggleArchivado}
            disabled={updatePortfolio.isPending}
            className="btn-secondary"
          >
            {archivado ? 'Reactivar portfolio' : 'Archivar portfolio'}
          </button>
          <button onClick={() => setDeleteOpen(true)} className="btn-danger-outline">
            Eliminar portfolio
          </button>
        </div>
      </div>

      {archivado && (
        <div className="mb-6 rounded-[10px] border border-line bg-white p-4 text-[13px] text-ink-muted">
          Portfolio archivado — reactivalo para poder agregar, editar o eliminar instrumentos.
        </div>
      )}

      <PresupuestoBoxes detalle={detalle} />

      <div className="flex flex-col gap-5">
        <div className="flex flex-col gap-5">
          <p className="text-[11px] font-bold tracking-[0.6px] text-currency-usd">USD</p>

          {(accionesTenencias.length > 0 || accionesOpciones.length > 0) && (
            <TypeSectionCard>
              <CatalogoTenenciaSection
                titulo="Acciones"
                tooltip={SECCION_TOOLTIPS.acciones}
                pickLabel="Elegí una acción"
                addLabel="+ Agregar acción"
                emptyMessage={`No hay acciones disponibles para el perfil ${perfilLower} en este momento.`}
                tenencias={accionesTenencias}
                catalogo={accionesOpciones}
                isMutating={addAccion.isPending || updateAccion.isPending || deleteAccion.isPending}
                error={errorAcciones}
                onAdd={(idAccion, cantidad, precioCompra) =>
                  conCaptura(setErrorAcciones, () => addAccion.mutateAsync({ idAccion, cantidad, precioCompra }))
                }
                onUpdate={(idAccion, cantidad) => {
                  const precioCompra = detalle.acciones.find((a) => a.idAccion === idAccion)?.precioCompra ?? 0
                  return conCaptura(setErrorAcciones, () =>
                    updateAccion.mutateAsync({ id: idAccion, cantidad, precioCompra }),
                  )
                }}
                onDelete={(idAccion) => deleteAccion.mutate(idAccion, { onError: onErrorToast })}
              />
            </TypeSectionCard>
          )}

          {idMonedaUsd != null && (
            <TypeSectionCard>
              <PlazoFijoSection
                titulo="Plazo fijo (USD)"
                tooltip={SECCION_TOOLTIPS.plazoFijoUsd}
                moneda="USD"
                tenencias={detalle.plazosFijos.filter((pf) => pf.codigoMoneda === 'USD')}
                tipos={tiposPfUsd}
                isMutating={addPlazoFijo.isPending || updatePlazoFijo.isPending || deletePlazoFijo.isPending}
                error={errorPlazoFijoUsd}
                onAdd={(payload) =>
                  conCaptura(setErrorPlazoFijoUsd, () =>
                    addPlazoFijo.mutateAsync({ ...payload, idMoneda: idMonedaUsd }),
                  )
                }
                onUpdate={(idPortfolioPlazoFijo, payload) =>
                  conCaptura(setErrorPlazoFijoUsd, () =>
                    updatePlazoFijo.mutateAsync({ id: idPortfolioPlazoFijo, ...payload }),
                  )
                }
                onDelete={(idPortfolioPlazoFijo) =>
                  deletePlazoFijo.mutate(idPortfolioPlazoFijo, { onError: onErrorToast })
                }
              />
            </TypeSectionCard>
          )}
        </div>

        <div className="flex flex-col gap-5">
          <p className="text-[11px] font-bold tracking-[0.6px] text-currency-ars">ARS</p>

          {(bonosTenencias.length > 0 || bonosOpciones.length > 0) && (
            <TypeSectionCard>
              <CatalogoTenenciaSection
                titulo="Bonos"
                tooltip={SECCION_TOOLTIPS.bonos}
                pickLabel="Elegí un bono"
                addLabel="+ Agregar bono"
                cantidadLabel="Cantidad de lotes"
                cantidadTooltip={CANTIDAD_LOTES_TOOLTIP_BONO}
                emptyMessage={`No hay bonos disponibles para el perfil ${perfilLower} en este momento.`}
                tenencias={bonosTenencias}
                catalogo={bonosOpciones}
                isMutating={addBono.isPending || updateBono.isPending || deleteBono.isPending}
                error={errorBonos}
                onAdd={(idBono, cantidad, precioCompra) =>
                  conCaptura(setErrorBonos, () => addBono.mutateAsync({ idBono, cantidad, precioCompra }))
                }
                onUpdate={(idBono, cantidad) => {
                  const precioCompra = detalle.bonos.find((b) => b.idBono === idBono)?.precioCompra ?? 0
                  return conCaptura(setErrorBonos, () =>
                    updateBono.mutateAsync({ id: idBono, cantidad, precioCompra }),
                  )
                }}
                onDelete={(idBono) => deleteBono.mutate(idBono, { onError: onErrorToast })}
              />
            </TypeSectionCard>
          )}

          {(letrasTenencias.length > 0 || letrasOpciones.length > 0) && (
            <TypeSectionCard>
              <CatalogoTenenciaSection
                titulo="Letras"
                tooltip={SECCION_TOOLTIPS.letras}
                pickLabel="Elegí una letra"
                addLabel="+ Agregar letra"
                cantidadLabel="Cantidad de lotes"
                cantidadTooltip={CANTIDAD_LOTES_TOOLTIP_LETRA}
                emptyMessage={`No hay letras disponibles para el perfil ${perfilLower} en este momento.`}
                tenencias={letrasTenencias}
                catalogo={letrasOpciones}
                isMutating={addLetra.isPending || updateLetra.isPending || deleteLetra.isPending}
                error={errorLetras}
                onAdd={(idLetra, cantidad, precioCompra) =>
                  conCaptura(setErrorLetras, () => addLetra.mutateAsync({ idLetra, cantidad, precioCompra }))
                }
                onUpdate={(idLetra, cantidad) => {
                  const precioCompra = detalle.letras.find((l) => l.idLetra === idLetra)?.precioCompra ?? 0
                  return conCaptura(setErrorLetras, () =>
                    updateLetra.mutateAsync({ id: idLetra, cantidad, precioCompra }),
                  )
                }}
                onDelete={(idLetra) => deleteLetra.mutate(idLetra, { onError: onErrorToast })}
              />
            </TypeSectionCard>
          )}

          {idMonedaArs != null && (
            <TypeSectionCard>
              <PlazoFijoSection
                titulo="Plazo fijo (ARS)"
                tooltip={SECCION_TOOLTIPS.plazoFijoArs}
                moneda="ARS"
                tenencias={detalle.plazosFijos.filter((pf) => pf.codigoMoneda === 'ARS')}
                tipos={tiposPfArs}
                isMutating={addPlazoFijo.isPending || updatePlazoFijo.isPending || deletePlazoFijo.isPending}
                error={errorPlazoFijoArs}
                onAdd={(payload) =>
                  conCaptura(setErrorPlazoFijoArs, () =>
                    addPlazoFijo.mutateAsync({ ...payload, idMoneda: idMonedaArs }),
                  )
                }
                onUpdate={(idPortfolioPlazoFijo, payload) =>
                  conCaptura(setErrorPlazoFijoArs, () =>
                    updatePlazoFijo.mutateAsync({ id: idPortfolioPlazoFijo, ...payload }),
                  )
                }
                onDelete={(idPortfolioPlazoFijo) =>
                  deletePlazoFijo.mutate(idPortfolioPlazoFijo, { onError: onErrorToast })
                }
              />
            </TypeSectionCard>
          )}
        </div>
      </div>

      <div className="mt-5 rounded-xl border border-line bg-white p-6">
        <div className="mb-4 flex items-center justify-between">
          <p className="font-display text-[15px] font-semibold text-navy-950">Historial de simulaciones</p>
          <Link
            to="/simulaciones"
            className="text-[12.5px] font-semibold whitespace-nowrap text-navy-950 hover:underline"
          >
            Ver todo el historial
          </Link>
        </div>
        {!simulaciones || simulaciones.length === 0 ? (
          <p className="text-[13px] text-ink-soft">Todavía no corriste simulaciones para este portfolio.</p>
        ) : (
          <div className="flex flex-col gap-2">
            {simulaciones.slice(0, 5).map((s) => (
              <div key={s.idSimulacion} className="tenencia-row">
                <div className="min-w-0 flex-1 basis-32">
                  <p className="tenencia-row-title">{formatFecha(s.fechaEjecucion)}</p>
                  <p className="tenencia-row-subtitle">{s.horizonteMeses} meses</p>
                </div>
                <div className="tenencia-row-stats">
                  <div className="text-right">
                    <p className="stat-label">Valor esperado</p>
                    <p className="mt-0.5 stat-value">
                      <ValorPorMoneda
                        combinado={s.valorEsperado}
                        ars={s.valorEsperadoArs}
                        usd={s.valorEsperadoUsd}
                        formatCombinado={(v) => formatMoneda(v, detalle.codigoMonedaBase)}
                        formatArs={(v) => formatMoneda(v, 'ARS')}
                        formatUsd={(v) => formatMoneda(v, 'USD')}
                      />
                    </p>
                  </div>
                </div>
                <Link
                  to={`/simulaciones/${s.idSimulacion}`}
                  className="shrink-0 text-[12px] font-semibold whitespace-nowrap text-navy-950 hover:underline"
                >
                  Ver →
                </Link>
              </div>
            ))}
          </div>
        )}
      </div>

      <CreateEditPortfolioDialog open={editOpen} onOpenChange={setEditOpen} portfolio={detalle} />
      <DeletePortfolioDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        portfolio={detalle}
        onDeleted={() => navigate('/portfolios')}
      />
    </div>
  )
}

function TypeSectionCard({ children }: { children: ReactNode }) {
  return <div className="card">{children}</div>
}
