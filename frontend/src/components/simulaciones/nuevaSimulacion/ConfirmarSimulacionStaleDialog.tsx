import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'

export default function ConfirmarSimulacionStaleDialog({
  open,
  onOpenChange,
  nombrePortfolio,
  isPending,
  onVerComparacion,
  onConfirmar,
}: {
  open:             boolean
  onOpenChange:     (open: boolean) => void
  nombrePortfolio:  string
  isPending:        boolean
  onVerComparacion: () => void
  onConfirmar:      () => void
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Vas a simular con datos desactualizados</DialogTitle>
          <DialogDescription>
            {nombrePortfolio} tiene instrumentos con datos de mercado más recientes que el snapshot con el
            que fue armado, y todavía no revisaste la comparación. Podés ver qué cambió antes de decidir,
            o simular igual con los valores del snapshot actual.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={onVerComparacion}>
            Ver comparación
          </Button>
          <Button onClick={onConfirmar} disabled={isPending}>
            Simular con el snapshot actual
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
