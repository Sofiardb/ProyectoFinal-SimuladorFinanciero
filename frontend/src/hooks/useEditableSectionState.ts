import { useState } from 'react'

/**
 * Estado de edición/alta inline compartido por las secciones de tenencias (acciones, bonos,
 * letras, plazo fijo). 
 */
export function useEditableSectionState(onCancelar?: () => void) {
  const [editingId, setEditingId] = useState<number | null>(null)
  const [isAdding, setIsAdding] = useState(false)

  async function guardarYCerrar(accion: () => Promise<unknown>, cerrar: () => void) {
    try {
      await accion()
      cerrar()
    } catch {
      // Mantener la fila abierta: el error ya se muestra debajo de la sección.
    }
  }

  return {
    editingId,
    isAdding,
    editar: (id: number) => setEditingId(id),
    cancelarEdicion: () => {
      setEditingId(null)
      onCancelar?.()
    },
    empezarAgregar: () => setIsAdding(true),
    cancelarAgregar: () => {
      setIsAdding(false)
      onCancelar?.()
    },
    guardarEdicionYCerrar: (accion: () => Promise<unknown>) => guardarYCerrar(accion, () => setEditingId(null)),
    guardarAltaYCerrar: (accion: () => Promise<unknown>) => guardarYCerrar(accion, () => setIsAdding(false)),
  }
}
