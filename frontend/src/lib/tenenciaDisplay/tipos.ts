export interface CampoPreview {
  label:    string
  value:    string
  tooltip?: string
}

export interface TenenciaRowCore {
  titulo:        string
  subtitulo:     string
  previewFields: CampoPreview[]
}

export interface CardDisplay {
  id:       string
  title:    string
  subtitle: string
  stat:     string
}

export interface AmbitoInfo {
  label:  string
  /** Identificador corto (ticker, o entidad financiera para plazo fijo) — para chips/marcadores*/
  corto:  string
  moneda: 'ARS' | 'USD'
}
