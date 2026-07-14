import { useState, type ReactNode } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { toast } from 'sonner'
import { Skeleton } from '@/components/ui/skeleton'
import PerfilBadge from '@/components/portfolios/PerfilBadge'
import PreviewBanner from '@/components/portfolios/PreviewBanner'
import CreateEditPortfolioDialog from '@/components/portfolios/CreateEditPortfolioDialog'
import DeletePortfolioDialog from '@/components/portfolios/DeletePortfolioDialog'
import CatalogoTenenciaSection, {
  type CatalogoOpcion,
  type TenenciaItem,
} from '@/components/portfolios/tenencias/CatalogoTenenciaSection'
import PlazoFijoSection from '@/components/portfolios/tenencias/PlazoFijoSection'
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
} from '@/api/hooks'
import {
  accionPreview,
  accionSubtitulo,
  accionHeldPreview,
  accionCatalogoPorId,
  bonoPreview,
  bonoSubtitulo,
  bonoHeldPreview,
  bonoCatalogoPorId,
  letraPreview,
  letraSubtitulo,
  letraHeldPreview,
  letraCatalogoPorId,
} from '@/lib/tenenciaDisplay'
import { formatFecha } from '@/lib/format'

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
      <div className="mx-auto max-w-[1080px] space-y-4 px-4 pt-8 pb-16 sm:px-6 lg:px-8 lg:pt-9">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-40 w-full" />
        <Skeleton className="h-40 w-full" />
      </div>
    )
  }

  if (!detalle) {
    return (
      <div className="mx-auto max-w-[1080px] px-4 pt-8 pb-16 text-center sm:px-6 lg:px-8 lg:pt-9">
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
        onError: (error) => toast.error(error.message),
      },
    )
  }

  // ─── Acciones ────────────────────────────────────────────────────────────
  const accionesTenencias: TenenciaItem[] = detalle.acciones.map((a) => ({
    idCatalogo: a.idAccion,
    titulo: `${a.ticker} · ${a.nombre}`,
    subtitulo: accionSubtitulo({ sector: a.sector }),
    previewFields: accionHeldPreview(a, accionesPorId),
  }))
  const accionesOpciones: CatalogoOpcion[] = (accionesCatalogo ?? [])
    .filter((a) => !detalle.acciones.some((existing) => existing.idAccion === a.idAccion))
    .filter((a) => sigmaMaxAccion == null || a.sigmaVolatilidad == null || a.sigmaVolatilidad <= sigmaMaxAccion)
    .map((a) => ({
      id: a.idAccion,
      etiqueta: `${a.ticker} - ${a.nombre}`,
      previewFields: accionPreview(a),
      precioActual: a.precioActual ?? 0,
    }))

  // ─── Bonos ───────────────────────────────────────────────────────────────
  const bonosTenencias: TenenciaItem[] = detalle.bonos.map((b) => ({
    idCatalogo: b.idBono,
    titulo: `${b.ticker} · ${b.nombre}`,
    subtitulo: bonosPorId.get(b.idBono) ? bonoSubtitulo(bonosPorId.get(b.idBono)!) : (b.emisor ?? ''),
    previewFields: bonoHeldPreview(b, bonosPorId),
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
    titulo: `${l.ticker} · ${l.nombre}`,
    subtitulo: letraSubtitulo({ fechaVencimiento: l.fechaVencimiento }),
    previewFields: letraHeldPreview(l, letrasPorId),
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
    <div className="mx-auto max-w-[1080px] px-4 pt-8 pb-16 sm:px-6 lg:px-8 lg:pt-9">
      <div className="mb-[18px] flex flex-wrap items-center gap-1.5 text-[12.5px] text-ink-soft">
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
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => navigate(`/portfolios/${idPortfolio}/simular`)}
            disabled={archivado}
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

      <PreviewBanner idPortfolio={idPortfolio} fechaModificacion={detalle.fechaModificacion} />

      <div className="flex flex-col gap-5">
        <div className="flex flex-col gap-5">
          <p className="text-[11px] font-bold tracking-[0.6px] text-blue-brand">USD</p>

          {(accionesTenencias.length > 0 || accionesOpciones.length > 0) && (
            <TypeSectionCard>
              <CatalogoTenenciaSection
                titulo="Acciones"
                tooltip="Participaciones de una empresa cotizante. Su valor sube o baja con el mercado; sin vencimiento."
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
                    updateAccion.mutateAsync({ idAccion, cantidad, precioCompra }),
                  )
                }}
                onDelete={(idAccion) =>
                  deleteAccion.mutate(idAccion, { onError: (error) => toast.error(error.message) })
                }
              />
            </TypeSectionCard>
          )}

          {idMonedaUsd != null && (
            <TypeSectionCard>
              <PlazoFijoSection
                titulo="Plazo fijo (USD)"
                tooltip="Depósito a plazo en dólares con tasa fija (TNA) pactada de antemano, a devolver al vencimiento."
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
                    updatePlazoFijo.mutateAsync({ idPortfolioPlazoFijo, ...payload }),
                  )
                }
                onDelete={(idPortfolioPlazoFijo) =>
                  deletePlazoFijo.mutate(idPortfolioPlazoFijo, {
                    onError: (error) => toast.error(error.message),
                  })
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
                tooltip="Deuda emitida por el Estado o una empresa. Puede tener tasa fija o ajustar por CER (inflación)."
                pickLabel="Elegí un bono"
                addLabel="+ Agregar bono"
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
                  return conCaptura(setErrorBonos, () => updateBono.mutateAsync({ idBono, cantidad, precioCompra }))
                }}
                onDelete={(idBono) =>
                  deleteBono.mutate(idBono, { onError: (error) => toast.error(error.message) })
                }
              />
            </TypeSectionCard>
          )}

          {(letrasTenencias.length > 0 || letrasOpciones.length > 0) && (
            <TypeSectionCard>
              <CatalogoTenenciaSection
                titulo="Letras"
                tooltip="Deuda de corto plazo emitida por el Tesoro. Puede tener tasa fija o ajustar por CER (inflación)."
                pickLabel="Elegí una letra"
                addLabel="+ Agregar letra"
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
                    updateLetra.mutateAsync({ idLetra, cantidad, precioCompra }),
                  )
                }}
                onDelete={(idLetra) =>
                  deleteLetra.mutate(idLetra, { onError: (error) => toast.error(error.message) })
                }
              />
            </TypeSectionCard>
          )}

          {idMonedaArs != null && (
            <TypeSectionCard>
              <PlazoFijoSection
                titulo="Plazo fijo (ARS)"
                tooltip="Depósito a plazo en pesos. Puede ser a tasa fija (monto conocido de antemano) o UVA (ajusta por inflación más una tasa real)."
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
                    updatePlazoFijo.mutateAsync({ idPortfolioPlazoFijo, ...payload }),
                  )
                }
                onDelete={(idPortfolioPlazoFijo) =>
                  deletePlazoFijo.mutate(idPortfolioPlazoFijo, {
                    onError: (error) => toast.error(error.message),
                  })
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
        <p className="text-[13px] text-ink-soft">Todavía no corriste simulaciones para este portfolio.</p>
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
