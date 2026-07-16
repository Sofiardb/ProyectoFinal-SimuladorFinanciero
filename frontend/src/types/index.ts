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

// ─── Referencia (catálogos de lookup) ─────────────────────────────────────────
export interface Moneda {
  idMoneda:  number
  codigoIso: string
  nombre:    string
  simbolo:   string
}

export interface PerfilRiesgo {
  idPerfilRiesgo: number
  nombre:         string
  descripcion?:   string
  sigmaMaxAccion: number
}

/** Cotización USD/ARS vigente y fecha del registro del que salió (docs/09, sección 6). */
export interface TipoCambio {
  valor: number
  fecha: string
}

// ─── Catálogo de instrumentos disponibles para agregar a un portfolio ────────
export interface AccionCatalogo {
  idAccion:               number
  ticker:                 string
  nombre:                 string
  sector?:                string
  muRetornoEsperado?:     number
  sigmaVolatilidad?:      number
  rhoCorrelacionIndice?:  number
  precioActual?:          number
  fechaPrecioActual?:     string
  fechaEstimacionParams?: string
}

export interface FlujoCaja {
  numeroCupon: number
  fechaPago:   string
  montoCupon:  number
  montoCapital: number
  montoTotal:  number
}

export interface BonoCatalogo {
  idBono:            number
  ticker:            string
  nombre:            string
  tipoBono:          'TASA_FIJA' | 'INDEXADO_INFLACION'
  tasaDescuento:     number
  fechaVencimiento:  string
  diasAlVencimiento: number
  precioActual?:     number
  fechaPrecioActual?: string
  flujos:            FlujoCaja[]
}

export interface LetraCatalogo {
  idLetra:           number
  ticker:            string
  nombre:            string
  tipoLetra:         'LECAP' | 'LECER'
  tasa:              number
  fechaVencimiento:  string
  diasAlVencimiento: number
  precioActual?:     number
  fechaPrecioActual?: string
}

export interface TipoPlazoFijo {
  idTipoPlazoFijo: number
  codigo:          string
  nombre:          string
  descripcion?:    string
}

// ─── Tenencias (instrumentos ya agregados a un portfolio) ────────────────────
export interface PortfolioAccion {
  idPortfolioAccion: number
  idAccion:          number
  ticker:            string
  nombre:            string
  sector?:           string
  muRetornoEsperado?: number
  sigmaVolatilidad?: number
  precioActual?:     number
  cantidad:          number
  precioCompra:      number
  muRetornoEsperadoCompra?:    number
  sigmaVolatilidadCompra?:     number
  rhoCorrelacionIndiceCompra?: number
}

export interface PortfolioBono {
  idPortfolioBono: number
  idBono:          number
  ticker:          string
  nombre:          string
  emisor?:         string
  precioActual?:   number
  cantidad:        number
  precioCompra:    number
  tasaDescuentoCompra: number
}

export interface PortfolioLetra {
  idPortfolioLetra: number
  idLetra:          number
  ticker:           string
  nombre:           string
  tasa:             number
  fechaVencimiento: string
  precioActual?:    number
  cantidad:         number
  precioCompra:     number
  tasaCompra:       number
}

export interface PortfolioPlazoFijo {
  idPortfolioPlazoFijo:     number
  idTipoPlazoFijo:          number
  nombreTipoPlazoFijo:      string
  idMoneda:                 number
  codigoMoneda:             string
  entidadFinanciera:        string
  montoInvertido:           number
  tnaPactada:                number
  fechaInicio:              string
  duracionDias:             number
  reinvertirAlVencimiento:  boolean
}

// ─── Portfolio ─────────────────────────────────────────────────────────────────
export type EstadoPortfolio = 'ACTIVO' | 'ARCHIVADO'

export interface PortfolioResumen {
  idPortfolio:        number
  nombre:             string
  descripcion?:       string
  idPerfilRiesgo:     number
  nombrePerfilRiesgo: string
  idMonedaBase:       number
  codigoMonedaBase:   string
  capitalInicial?:    number
  fechaCreacion:      string
  fechaModificacion:  string
  estado:             EstadoPortfolio
}

export interface PortfolioDetalle extends PortfolioResumen {
  acciones:    PortfolioAccion[]
  bonos:       PortfolioBono[]
  letras:      PortfolioLetra[]
  plazosFijos: PortfolioPlazoFijo[]
}

// ─── Preview de simulación (comparación original vs. mercado) ────────────────
export type EstadoPreviewInstrumento =
  | 'IGUAL'
  | 'ACTUALIZADO'
  | 'SIN_PRECIO'
  | 'VENCIDO'
  | 'PARCIALMENTE_VENCIDO'
  | 'ACTIVO'

export interface InstrumentoPreviewItem {
  id:                 string
  tipo:               string
  ticker?:            string
  nombre?:            string
  entidadFinanciera?: string
  codigoMoneda?:      string
  cantidad:           number
  precioOriginal:     number
  precioMercado?:     number
  montoOriginal:      number
  montoMercado?:      number
  estado:             EstadoPreviewInstrumento
  esValidoParaSimular: boolean
  flujosTotales?:     number
  flujosVigentes?:    number
  flujosVencidos?:    number
  fechaVencimiento?:  string
  mesesRestantes?:    number
  // Tasa/parámetros GBM: snapshot de la tenencia vs. catálogo actual (docs/09)
  estadoTasa?:        EstadoPreviewInstrumento
  tasaOriginal?:      number
  tasaMercado?:       number
  muOriginal?:        number
  muMercado?:         number
  sigmaOriginal?:     number
  sigmaMercado?:      number
  rhoOriginal?:       number
  rhoMercado?:        number
}

export interface SimulacionPreview {
  capitalInicial?:         number
  totalInvertidoOriginal:  number
  totalInvertidoMercado?:  number
  puedeSimular:            boolean
  tieneActualizaciones:    boolean
  instrumentos:            InstrumentoPreviewItem[]
}

// ─── Simulation ───────────────────────────────────────────────────────────────
export interface SimularRequest {
  horizonteMeses: number
}

export interface SimulacionResumen {
  idSimulacion:        number
  idPortfolio:         number
  fechaEjecucion:      string
  horizonteMeses:      number
  numTrayectorias:     number
  seedAleatoria:       number
  valorInicial:        number
  valorEsperado?:      number
  valorMinimo?:        number
  valorMaximo?:        number
  retornoEsperadoPct?: number
  rendimientoRealPct?: number
  desvioEstandar?:     number
  observaciones?:      string
}
