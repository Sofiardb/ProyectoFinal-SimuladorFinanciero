import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { toast } from 'sonner'
import { useTour } from '@/contexts/TourContext'
import { Skeleton } from '@/components/ui/skeleton'
import { SlowLoadingHint } from '@/components/ui/slow-loading-hint'
import CreateEditPortfolioDialog from '@/components/portfolios/CreateEditPortfolioDialog'
import DeletePortfolioDialog from '@/components/portfolios/DeletePortfolioDialog'
import HistorialSimulacionesCard from '@/components/portfolios/HistorialSimulacionesCard'
import PortfolioDetalleHeader from '@/components/portfolios/PortfolioDetalleHeader'
import PresupuestoBoxes from '@/components/portfolios/PresupuestoBoxes'
import DeleteSimulacionDialog from '@/components/simulaciones/DeleteSimulacionDialog'
import AccionesSection from '@/components/portfolios/tenencias/AccionesSection'
import BonosSection from '@/components/portfolios/tenencias/BonosSection'
import LetrasSection from '@/components/portfolios/tenencias/LetrasSection'
import PlazoFijoTypeSection from '@/components/portfolios/tenencias/PlazoFijoTypeSection'
import {
  usePortfolio,
  usePerfilesRiesgo,
  useMonedas,
  useAccionesCatalogo,
  useBonosCatalogo,
  useLetrasCatalogo,
  useTiposPlazoFijo,
  useUpdatePortfolio,
  useSimulacionesPortfolio,
} from '@/api/hooks'
import { useTienePortfolioInstrumentos } from '@/hooks/usePortfolioInstrumentos'
import { formatFecha } from '@/lib/format'
import { onErrorToast } from '@/lib/toast'
import type { SimulacionResumen } from '@/types'

export default function PortfolioDetallePage() {
  const { id } = useParams<{ id: string }>()
  const idPortfolio = Number(id)
  const navigate = useNavigate()

  const { data: detalle, isLoading } = usePortfolio(idPortfolio)
  const tieneInstrumentos = useTienePortfolioInstrumentos(detalle)
  const { avanzarSiEsperando } = useTour()
  const { data: simulaciones } = useSimulacionesPortfolio(idPortfolio)
  const { data: perfiles } = usePerfilesRiesgo()
  const { data: monedas } = useMonedas()
  const { data: accionesCatalogo } = useAccionesCatalogo()
  const { data: bonosCatalogo } = useBonosCatalogo()
  const { data: letrasCatalogo } = useLetrasCatalogo()
  const { data: tiposPlazoFijo } = useTiposPlazoFijo()
  const updatePortfolio = useUpdatePortfolio(idPortfolio)

  const [editOpen, setEditOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [simulacionAEliminar, setSimulacionAEliminar] = useState<SimulacionResumen | null>(null)

  const idMonedaArs = monedas?.find((m) => m.codigoIso === 'ARS')?.idMoneda

  useEffect(() => {
    if (tieneInstrumentos) avanzarSiEsperando('agregar-instrumento-form')
  }, [tieneInstrumentos, avanzarSiEsperando])

  // El botón "+ Agregar plazo fijo (ARS)" que apunta el tour recién existe una vez que se resuelve
  // idMonedaArs (además de la carga del portfolio) — esperamos eso, no solo el cambio de ruta.
  useEffect(() => {
    if (idMonedaArs != null) avanzarSiEsperando('crear-portfolio-form')
  }, [idMonedaArs, avanzarSiEsperando])

  if (isLoading) {
    return (
      <div className="page-shell max-w-[1080px] space-y-4">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-40 w-full" />
        <Skeleton className="h-40 w-full" />
        <SlowLoadingHint isLoading={isLoading} />
      </div>
    )
  }

  if (!detalle) {
    return (
      <div className="page-shell max-w-[1080px] text-center">
        <p className="text-ink-muted">No se encontró el portfolio.</p>
        <Link to="/portfolios" className="link-back-fallback">
          Volver a mis portfolios
        </Link>
      </div>
    )
  }

  const sigmaMaxAccion = perfiles?.find((p) => p.idPerfilRiesgo === detalle.idPerfilRiesgo)?.sigmaMaxAccion
  const idMonedaUsd = monedas?.find((m) => m.codigoIso === 'USD')?.idMoneda
  const archivado = detalle.estado === 'ARCHIVADO'
  const perfilLower = detalle.nombrePerfilRiesgo.toLowerCase()

  const handleToggleArchivado = () => {
    updatePortfolio.mutate(
      { estado: archivado ? 'ACTIVO' : 'ARCHIVADO' },
      {
        onSuccess: () => toast.success(archivado ? 'Portfolio reactivado.' : 'Portfolio archivado.'),
        onError: onErrorToast,
      },
    )
  }

  return (
    <div className="page-shell fade-in-content max-w-[1080px]">
      <PortfolioDetalleHeader
        detalle={detalle}
        idPortfolio={idPortfolio}
        tieneInstrumentos={tieneInstrumentos}
        archivado={archivado}
        isTogglingArchivado={updatePortfolio.isPending}
        onToggleArchivado={handleToggleArchivado}
        onEdit={() => setEditOpen(true)}
        onDelete={() => setDeleteOpen(true)}
      />

      <PresupuestoBoxes detalle={detalle} />

      <div className="flex flex-col gap-5">
        <div className="flex flex-col gap-5">
          <p className="text-[11px] font-bold tracking-[0.6px] text-currency-usd">USD</p>
          <AccionesSection
            idPortfolio={idPortfolio}
            detalle={detalle}
            accionesCatalogo={accionesCatalogo}
            sigmaMaxAccion={sigmaMaxAccion}
            perfilLower={perfilLower}
          />
          {idMonedaUsd != null && (
            <PlazoFijoTypeSection
              idPortfolio={idPortfolio}
              detalle={detalle}
              moneda="USD"
              idMoneda={idMonedaUsd}
              tiposPlazoFijo={tiposPlazoFijo}
            />
          )}
        </div>

        <div className="flex flex-col gap-5">
          <p className="text-[11px] font-bold tracking-[0.6px] text-currency-ars">ARS</p>
          <BonosSection
            idPortfolio={idPortfolio}
            detalle={detalle}
            bonosCatalogo={bonosCatalogo}
            perfilLower={perfilLower}
          />
          <LetrasSection
            idPortfolio={idPortfolio}
            detalle={detalle}
            letrasCatalogo={letrasCatalogo}
            perfilLower={perfilLower}
          />
          {idMonedaArs != null && (
            <PlazoFijoTypeSection
              idPortfolio={idPortfolio}
              detalle={detalle}
              moneda="ARS"
              idMoneda={idMonedaArs}
              tiposPlazoFijo={tiposPlazoFijo}
              addButtonDataTour="tour-agregar-instrumento"
            />
          )}
        </div>
      </div>

      <HistorialSimulacionesCard
        simulaciones={simulaciones}
        codigoMonedaBase={detalle.codigoMonedaBase}
        onEliminar={setSimulacionAEliminar}
      />

      <CreateEditPortfolioDialog open={editOpen} onOpenChange={setEditOpen} portfolio={detalle} />
      <DeletePortfolioDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        portfolio={detalle}
        onDeleted={() => navigate('/portfolios')}
      />
      {simulacionAEliminar && (
        <DeleteSimulacionDialog
          open
          onOpenChange={(open) => !open && setSimulacionAEliminar(null)}
          idSimulacion={simulacionAEliminar.idSimulacion}
          descripcion={`${formatFecha(simulacionAEliminar.fechaEjecucion)} · ${simulacionAEliminar.horizonteMeses} meses`}
          onDeleted={() => setSimulacionAEliminar(null)}
        />
      )}
    </div>
  )
}
