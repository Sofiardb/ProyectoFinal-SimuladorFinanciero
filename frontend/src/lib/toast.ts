import { toast } from 'sonner'

/** Handler `onError` estándar para mutaciones de React Query: muestra el mensaje de error en un toast. */
export function onErrorToast(error: Error) {
  toast.error(error.message)
}

/** Handler `onSuccess` estándar para mutaciones cuya respuesta trae un campo `mensaje` para mostrar tal cual. */
export function onSuccessToastMensaje(data: { mensaje: string }) {
  toast.success(data.mensaje)
}
