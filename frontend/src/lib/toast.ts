import { toast } from 'sonner'

export function onErrorToast(error: Error) {
  toast.error(error.message)
}

export function onSuccessToastMensaje(data: { mensaje: string }) {
  toast.success(data.mensaje)
}
