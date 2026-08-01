/** Limpia el error previo, ejecuta la mutación y, si falla, guarda el mensaje y relanza (para que el formulario que llama quede abierto). */
export async function conCaptura(
  setError: (mensaje: string | null) => void,
  fn: () => Promise<unknown>,
): Promise<void> {
  setError(null)
  try {
    await fn()
  } catch (error) {
    setError((error as Error).message)
    throw error
  }
}
