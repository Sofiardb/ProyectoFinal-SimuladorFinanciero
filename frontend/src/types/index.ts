// ─── Auth ──────────────────────────────────────────────────────────────────────
export interface Usuario {
  email:     string
  username:  string
  nombre?:   string
  apellido?: string
  esAdmin:   boolean
}

export interface AuthResponse {
  token:      string
  expiresAt:  string
  email?:     string
  username?:  string
  nombre?:    string
  apellido?:  string
  esAdmin:    boolean
}

// ─── Stats vector returned by the motor ───────────────────────────────────────
export interface StatsVector {
  media:   number[]
  mediana: number[]
  p25:     number[]
  p75:     number[]
  minimo:  number[]
  maximo:  number[]
}

export interface MetricaEscenarios {
  global:       StatsVector
  favorable:    StatsVector
  moderado:     StatsVector
  desfavorable: StatsVector
}

export interface ResultadoInstrumento {
  patrimonio:          MetricaEscenarios
  ganancias_nominales: MetricaEscenarios
  ganancias_reales:    MetricaEscenarios
}

// ─── Simulation result ────────────────────────────────────────────────────────
export interface ResultadoSimulacion {
  semilla:      number
  instrumentos: Record<string, ResultadoInstrumento>
  portfolio_ars: ResultadoInstrumento
  portfolio_usd: ResultadoInstrumento
}

// ─── Portfolio & instruments ──────────────────────────────────────────────────
export type TipoInstrumento =
  | 'accion'
  | 'lecap'
  | 'lecer'
  | 'bono_tasa_fija'
  | 'bono_indexado'
  | 'plazo_fijo_tradicional'
  | 'plazo_fijo_uva'

export interface Instrumento {
  id:    string
  tipo:  TipoInstrumento
  monto: number
  [key: string]: unknown
}

export interface Portfolio {
  id:           string
  nombre:       string
  descripcion?: string
  instrumentos: Instrumento[]
  creadoEn:     string
}

// ─── Simulation ───────────────────────────────────────────────────────────────
export interface Simulacion {
  id:          string
  portfolioId: string
  tMeses:      number
  estado:      'pendiente' | 'completada' | 'error'
  creadoEn:    string
}
