import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import { useDeleteSimulacion } from '@/api/hooks'
import { onErrorToast } from '@/lib/toast'

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  idSimulacion: number
  descripcion: string
  onDeleted?: () => void
}

export default function DeleteSimulacionDialog({ open, onOpenChange, idSimulacion, descripcion, onDeleted }: Props) {
  const deleteSimulacion = useDeleteSimulacion()

  const handleDelete = () => {
    deleteSimulacion.mutate(idSimulacion, {
      onSuccess: () => {
        toast.success('Simulación eliminada.')
        onOpenChange(false)
        onDeleted?.()
      },
      onError: onErrorToast,
    })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Eliminar simulación</DialogTitle>
          <DialogDescription>
            Vas a eliminar la corrida <strong>{descripcion}</strong> y todos sus resultados. Esta
            acción no se puede deshacer.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button variant="destructive" onClick={handleDelete} disabled={deleteSimulacion.isPending}>
            {deleteSimulacion.isPending ? 'Eliminando…' : 'Eliminar'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
