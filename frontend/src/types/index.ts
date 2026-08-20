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

export interface ResultadoSimulacion {
  semilla:      number
  instrumentos: Record<string, ResultadoInstrumento>
  portfolio_ars: ResultadoInstrumento
  portfolio_usd: ResultadoInstrumento
}

export type TipoInstrumento =
  | 'accion'
  | 'lecap'
  | 'lecer'
  | 'bono_tasa_fija'
  | 'bono_indexado'
  | 'plazo_fijo_tradicional'
  | 'plazo_fijo_uva'

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

export interface TipoEscenario {
  idTipoEscenario: number
  nombre:          string
}

/** Rangos de inflación mensual vigentes por escenario económico (config global de admin, docs/09 §4 — sin override por corrida). */
export interface EscenarioEconomico {
  idEscenarioEconomico:  number
  idTipoEscenario:       number
  nombreEscenario:       string
  inflacionMensualMin:   number
  inflacionMensualMax:   number
  inflacionMensualMinUsd: number
  inflacionMensualMaxUsd: number
}

/** Cotización USD/ARS vigente y fecha del registro del que salió (docs/09, sección 6). */
export interface TipoCambio {
  valor: number
  fecha: string
}

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
  /** Valor inicial/esperado/mínimo/máximo y retornos por moneda, siempre poblados por separado.
   * Los campos combinados de arriba (valorEsperado, etc.) quedan undefined cuando el portfolio invierte
   * en ARS y USD a la vez, porque combinarlos requeriría proyectar el tipo de cambio a T meses. */
  valorInicialArs?:        number
  valorInicialUsd?:        number
  valorEsperadoArs?:       number
  valorEsperadoUsd?:       number
  valorMinimoArs?:         number
  valorMinimoUsd?:         number
  valorMaximoArs?:         number
  valorMaximoUsd?:         number
  retornoEsperadoPctArs?:  number
  retornoEsperadoPctUsd?:  number
  rendimientoRealPctArs?:  number
  rendimientoRealPctUsd?:  number
}

/** Rango de inflación mensual efectivamente usado en una corrida puntual (snapshot histórico, no el vigente). */
export interface SimulacionParametroEscenario {
  idTipoEscenario:        number
  nombreTipoEscenario:    string
  inflacionMensualMin:    number
  inflacionMensualMax:    number
  inflacionMensualMinUsd: number
  inflacionMensualMaxUsd: number
}

export interface SimulacionDetalle extends SimulacionResumen {
  parametrosEscenario: SimulacionParametroEscenario[]
}

/** Instrumento de una simulación con su mes de vencimiento dentro del horizonte (GET /simulaciones/{id}/instrumentos).
 * tVencMeses es null si no hay vencimiento que marcar: acciones, instrumentos que vencen después
 * del horizonte, o plazo fijo con reinvertir=true.
 * ticker/nombre (accion/bono/letra) salen del catálogo maestro, que nunca se borra, así que
 * siguen resolviendo aunque la tenencia del portfolio ya no exista. entidadFinanciera/
 * nombreTipoPlazoFijo/codigoMoneda (plazo fijo) en cambio solo resuelven mientras la tenencia
 * siga viva: no hay catálogo maestro de plazos fijos. */
export interface InstrumentoSimulacion {
  ambito:               string
  tipo:                 string
  monto:                number
  tVencMeses:           number | null
  ticker?:              string | null
  nombre?:              string | null
  entidadFinanciera?:   string | null
  nombreTipoPlazoFijo?: string | null
  codigoMoneda?:        string | null
}

export type EscenarioNombre = 'global' | 'favorable' | 'moderado' | 'desfavorable'
export type MetricaResultado =
  | 'patrimonio'
  | 'ganancias_nominales'
  | 'ganancias_reales'
  | 'inflacion_acumulada'
  | 'inflacion_acumulada_usd'
  | 'inflacion_mensual'
  | 'inflacion_mensual_usd'

/** Fila cruda de GET /simulaciones/{id}/resultados — ambito es "portfolio_ars"/"portfolio_usd"/id de instrumento/"global". */
export interface ResultadoSimulacionRow {
  idResultado:  number
  idSimulacion: number
  ambito:       string
  escenario:    EscenarioNombre
  metrica:      MetricaResultado
  stats:        StatsVector
}
