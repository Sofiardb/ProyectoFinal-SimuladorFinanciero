import { toast } from 'sonner'

export function onErrorToast(error: Error) {
  toast.error(error.message)
}
