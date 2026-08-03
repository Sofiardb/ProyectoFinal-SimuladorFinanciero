import InfoTooltip from '@/components/portfolios/InfoTooltip'
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { formatFechaCorta, formatMoneda, hoyISO } from '@/lib/format'
import { CRONOGRAMA_CER_TOOLTIP, CRONOGRAMA_FLUJOS_TOOLTIP } from '@/lib/tooltips'
import type { FlujoCaja } from '@/types'

export default function CronogramaFlujos({
  flujos,
  cantidadLotes,
  esCer,
}: {
  flujos?: FlujoCaja[]
  cantidadLotes?: number
  esCer?: boolean
}) {
  const hoy = hoyISO()
  const futuros = (flujos ?? []).filter((f) => f.fechaPago > hoy)
  if (futuros.length === 0) return null

  const escala = cantidadLotes && cantidadLotes > 0 ? cantidadLotes : null

  return (
    <Accordion className="mt-2 border-t pt-1">
      <AccordionItem value="cronograma" className="border-b-0">
        <AccordionTrigger className="py-2 text-sm">
          <span className="inline-flex items-center gap-1">
            Cronograma de pagos
            <InfoTooltip term="Cronograma de pagos" definition={CRONOGRAMA_FLUJOS_TOOLTIP} />
          </span>
        </AccordionTrigger>
        <AccordionContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Fecha de pago</TableHead>
                <TableHead className="text-right">Cupón</TableHead>
                <TableHead className="text-right">Capital</TableHead>
                <TableHead className="text-right">Total</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {futuros.map((f) => {
                const cupon = escala ? f.montoCupon * escala : f.montoCupon
                const capital = escala ? f.montoCapital * escala : f.montoCapital
                const total = escala ? f.montoTotal * escala : f.montoTotal
                return (
                  <TableRow key={f.numeroCupon}>
                    <TableCell>{formatFechaCorta(f.fechaPago)}</TableCell>
                    <TableCell className="text-right">{formatMoneda(cupon, 'ARS')}</TableCell>
                    <TableCell className="text-right">{capital > 0 ? formatMoneda(capital, 'ARS') : '—'}</TableCell>
                    <TableCell className="text-right font-medium">{formatMoneda(total, 'ARS')}</TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
          <p className="mt-2 text-xs text-muted-foreground">
            {escala
              ? `Montos reales para ${escala.toLocaleString('es-AR')} lote${escala === 1 ? '' : 's'} (VN ${(escala * 100).toLocaleString('es-AR')}).`
              : 'Montos por cada $100 de valor nominal (VN 100) — ingresá una cantidad para ver el monto real que cobrarías.'}
          </p>
          {esCer && (
            <p className="mt-1 flex items-start gap-1 text-xs text-muted-foreground">
              Ajusta por inflación (CER)
              <InfoTooltip term="Ajusta por inflación (CER)" definition={CRONOGRAMA_CER_TOOLTIP} />
            </p>
          )}
        </AccordionContent>
      </AccordionItem>
    </Accordion>
  )
}
