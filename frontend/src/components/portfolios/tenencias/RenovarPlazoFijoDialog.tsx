import { useState } from 'react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import { formatFecha, formatMoneda, formatPorcentaje, hoyISO } from '@/lib/format'
import { capitalAlVencimiento, fechaVencimiento, tasaLabelPara } from '@/lib/plazoFijo'
import type { EditarPlazoFijo } from '@/components/portfolios/tenencias/plazoFijoForm'
import type { PortfolioPlazoFijo } from '@/types'

interface Props {
  tenencia: PortfolioPlazoFijo
  moneda: string
  isMutating: boolean
  onConfirm: (payload: EditarPlazoFijo) => Promise<void>
}

export default function RenovarPlazoFijoDialog({ tenencia, moneda, isMutating, onConfirm }: Props) {
  const [open, setOpen] = useState(false)
  const tasaLabel = tasaLabelPara(tenencia.nombreTipoPlazoFijo === 'Plazo fijo UVA' ? 'UVA' : undefined)
  const fv = fechaVencimiento(tenencia)
  const capitalRenovado = capitalAlVencimiento(tenencia)
  const interesDevengado = capitalRenovado - tenencia.montoInvertido

  async function handleConfirmar() {
    try {
      await onConfirm({
        entidadFinanciera: tenencia.entidadFinanciera,
        montoInvertido: capitalRenovado,
        tnaPactada: tenencia.tnaPactada,
        fechaInicio: hoyISO(),
        duracionDias: tenencia.duracionDias,
        reinvertirAlVencimiento: tenencia.reinvertirAlVencimiento,
      })
      setOpen(false)
    } catch {
      // Mantener el diálogo abierto: el error ya se muestra debajo de la sección.
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="h-7 shrink-0 rounded-md border border-warning-border bg-warning-bg px-2.5 text-[11px] font-semibold whitespace-nowrap text-warning-title"
      >
        Renovar
      </button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Renovar plazo fijo vencido</DialogTitle>
            <DialogDescription>
              Este plazo fijo venció el {formatFecha(fv)}. El capital pactado ({formatMoneda(tenencia.montoInvertido, moneda)})
              {' '}más el interés devengado durante el plazo original a la {tasaLabel.toLowerCase()} pactada (
              {formatPorcentaje(tenencia.tnaPactada * 100)}) asciende a{' '}
              <strong className="text-navy-950">{formatMoneda(capitalRenovado, moneda)}</strong> (
              {formatMoneda(interesDevengado, moneda)} de interés). Al renovar, se abre un nuevo plazo desde hoy por{' '}
              {tenencia.duracionDias} días con ese capital.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleConfirmar} disabled={isMutating}>
              Confirmar renovación
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
