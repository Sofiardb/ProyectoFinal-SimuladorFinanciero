export type TipoInstrumento = 'accion' | 'bono' | 'letra' | 'pf'

export interface InstrumentoRef {
  tipo: TipoInstrumento
  id:   number
}

const TIPOS: TipoInstrumento[] = ['accion', 'bono', 'letra', 'pf']

export function instrumentoRefKey(ref: InstrumentoRef): string {
  return `${ref.tipo}-${ref.id}`
}

export function instrumentoAnchorId(ref: InstrumentoRef): string {
  return `tenencia-${instrumentoRefKey(ref)}`
}

export function parseInstrumentoRefKey(key: string | null | undefined): InstrumentoRef | null {
  if (!key) return null
  const separador = key.lastIndexOf('-')
  if (separador === -1) return null
  const tipo = key.slice(0, separador) as TipoInstrumento
  const id = Number(key.slice(separador + 1))
  if (!TIPOS.includes(tipo) || !Number.isFinite(id)) return null
  return { tipo, id }
}
