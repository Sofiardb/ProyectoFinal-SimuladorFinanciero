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
import { useDeletePortfolio } from '@/api/hooks'
import type { PortfolioResumen } from '@/types'

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  portfolio: PortfolioResumen
  onDeleted?: () => void
}

export default function DeletePortfolioDialog({ open, onOpenChange, portfolio, onDeleted }: Props) {
  const deletePortfolio = useDeletePortfolio()

  const handleDelete = () => {
    deletePortfolio.mutate(portfolio.idPortfolio, {
      onSuccess: () => {
        toast.success('Portfolio eliminado.')
        onOpenChange(false)
        onDeleted?.()
      },
      onError: (error) => toast.error(error.message),
    })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Eliminar portfolio</DialogTitle>
          <DialogDescription>
            Vas a eliminar <strong>{portfolio.nombre}</strong> y todos sus instrumentos. Esta
            acción no se puede deshacer.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button variant="destructive" onClick={handleDelete} disabled={deletePortfolio.isPending}>
            {deletePortfolio.isPending ? 'Eliminando…' : 'Eliminar'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
