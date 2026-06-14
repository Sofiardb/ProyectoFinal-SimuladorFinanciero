-- =============================================================================
--  SIMULADOR FINANCIERO - ESQUEMA DE BASE DE DATOS
--  Autor: Sofía Rodríguez del Busto
--  Proyecto Final - Simulador de estrategias de inversión
-- =============================================================================
--  Convenciones:
--   * Nombres en español, snake_case, singular para tablas de entidad.
--   * Tablas de relación N:M en formato "entidad_a_entidad_b".
--   * Claves primarias de tipo BIGSERIAL (o BIGINT GENERATED ALWAYS).
--   * Timestamps con zona horaria (TIMESTAMPTZ).
--   * Valores monetarios: NUMERIC(20,6) para permitir precios de activos
--     con alta precisión decimal sin pérdida por flotante.
--   * Porcentajes / tasas: NUMERIC(10,8) expresados en forma decimal
--     (0.05 = 5%).
-- =============================================================================

BEGIN;

-- -----------------------------------------------------------------------------
-- 0. LIMPIEZA (opcional, solo desarrollo)
-- -----------------------------------------------------------------------------
DROP SCHEMA IF EXISTS simulador_financiero CASCADE;
CREATE SCHEMA simulador_financiero;
SET search_path TO simulador_financiero, public;


-- =============================================================================
-- 1. DOMINIO DE USUARIOS Y PERFILES
-- =============================================================================

CREATE TABLE usuario (
    id_usuario         BIGSERIAL PRIMARY KEY,
    username           VARCHAR(50)  UNIQUE NOT NULL,
    email              VARCHAR(150) UNIQUE NOT NULL,
    password_hash      VARCHAR(255) NOT NULL,
    nombre             VARCHAR(100),
    apellido           VARCHAR(100),
    fecha_registro     TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    fecha_ultimo_login TIMESTAMPTZ,
    activo             BOOLEAN      NOT NULL DEFAULT TRUE
);

COMMENT ON TABLE  usuario IS 'Usuarios registrados en el simulador.';
COMMENT ON COLUMN usuario.password_hash IS 'Hash de la contraseña (bcrypt/argon2). Nunca se almacena la clave en claro.';


-- Perfil de riesgo: conservador, moderado, agresivo.
CREATE TABLE perfil_riesgo (
    id_perfil_riesgo      SMALLSERIAL PRIMARY KEY,
    nombre                VARCHAR(50) NOT NULL UNIQUE,
    descripcion           TEXT,
    -- Restricción para validar el portfolio
    sigma_max_accion  NUMERIC(5,4) NOT NULL

);

COMMENT ON TABLE  perfil_riesgo IS 'Catálogo de perfiles de riesgo (conservador, moderado, agresivo).';
COMMENT ON COLUMN perfil_riesgo.sigma_max_accion IS 'Volatilidad anual máxima permitida (σ) para las acciones del portfolio bajo este perfil.';


-- =============================================================================
-- 2. DOMINIO DE REFERENCIA: MONEDAS E ÍNDICES DE MERCADO
-- =============================================================================

CREATE TABLE moneda (
    id_moneda  SMALLSERIAL PRIMARY KEY,
    codigo_iso CHAR(3)     NOT NULL UNIQUE,
    nombre     VARCHAR(50) NOT NULL,
    simbolo    VARCHAR(5)  NOT NULL
);

COMMENT ON TABLE moneda IS 'Monedas soportadas por el sistema (ARS, USD).';


CREATE TABLE tipo_cambio (
    id_tipo_cambio    BIGSERIAL PRIMARY KEY,
    id_moneda_origen  SMALLINT      NOT NULL REFERENCES moneda(id_moneda),
    id_moneda_destino SMALLINT      NOT NULL REFERENCES moneda(id_moneda),
    fecha             DATE          NOT NULL,
    valor             NUMERIC(20,8) NOT NULL CHECK (valor > 0),
    UNIQUE (id_moneda_origen, id_moneda_destino, fecha)
);

COMMENT ON TABLE tipo_cambio IS 'Cotizaciones históricas entre monedas (ej: USD→ARS).';


CREATE TABLE indice_mercado (
    id_indice_mercado SMALLSERIAL  PRIMARY KEY,
    codigo            VARCHAR(20)  NOT NULL UNIQUE,
    nombre            VARCHAR(100) NOT NULL,
    pais              VARCHAR(50),
    id_moneda         SMALLINT     NOT NULL REFERENCES moneda(id_moneda),
    descripcion       TEXT
);

COMMENT ON TABLE indice_mercado IS 'Índices de referencia utilizados para el modelo GBM (factor sistemático). El universo de acciones se limita al S&P 500 (SR-01).';


CREATE TABLE precio_historico_indice (
    id_precio_historico_indice BIGSERIAL PRIMARY KEY,
    id_indice_mercado          SMALLINT      NOT NULL REFERENCES indice_mercado(id_indice_mercado) ON DELETE CASCADE,
    fecha                      DATE          NOT NULL,
    valor_cierre               NUMERIC(20,6) NOT NULL,
    UNIQUE (id_indice_mercado, fecha)
);

CREATE INDEX idx_phi_indice_fecha ON precio_historico_indice(id_indice_mercado, fecha DESC);


-- =============================================================================
-- 3. INSTRUMENTOS FINANCIEROS DISPONIBLES (CATÁLOGO)
-- =============================================================================

-- 3.1 ACCIONES ---------------------------------------------------------------
-- Se modelan mediante Movimiento Browniano Geométrico (GBM).
-- Los parámetros μ, σ y ρ se estiman a partir de retornos logarítmicos
-- históricos y se persisten para evitar recalcularlos en cada simulación.
CREATE TABLE accion (
    id_accion               BIGSERIAL PRIMARY KEY,
    ticker                  VARCHAR(20)  NOT NULL UNIQUE,
    nombre                  VARCHAR(150) NOT NULL,
    sector                  VARCHAR(100),
    id_indice_mercado       SMALLINT     NOT NULL REFERENCES indice_mercado(id_indice_mercado),
    id_moneda               SMALLINT     NOT NULL REFERENCES moneda(id_moneda),
    -- Parámetros del modelo GBM (escala mensual)
    mu_retorno_esperado     NUMERIC(14,10),
    sigma_volatilidad       NUMERIC(14,10),
    rho_correlacion_indice  NUMERIC(8,6) CHECK (rho_correlacion_indice BETWEEN -1 AND 1),
    precio_actual           NUMERIC(20,6),
    fecha_precio_actual     TIMESTAMPTZ,
    fecha_estimacion_params TIMESTAMPTZ,
    activo                  BOOLEAN NOT NULL DEFAULT TRUE
);

COMMENT ON TABLE  accion IS 'Acciones disponibles para conformar portfolios. Limitadas al mercado estadounidense (S&P 500) según SR-01.';
COMMENT ON COLUMN accion.mu_retorno_esperado    IS 'Drift del GBM (μ): retorno logarítmico esperado mensual.';
COMMENT ON COLUMN accion.sigma_volatilidad      IS 'Volatilidad del GBM (σ): desvío estándar de los retornos logarítmicos mensuales.';
COMMENT ON COLUMN accion.rho_correlacion_indice IS 'Correlación (ρ) entre los retornos de la acción y su índice de referencia.';


CREATE TABLE precio_historico_accion (
    id_precio_historico_accion BIGSERIAL PRIMARY KEY,
    id_accion                  BIGINT        NOT NULL REFERENCES accion(id_accion) ON DELETE CASCADE,
    fecha                      DATE          NOT NULL,
    precio_apertura            NUMERIC(20,6),
    precio_cierre              NUMERIC(20,6) NOT NULL,
    precio_maximo              NUMERIC(20,6),
    precio_minimo              NUMERIC(20,6),
    precio_ajustado            NUMERIC(20,6),
    volumen                    BIGINT,
    UNIQUE (id_accion, fecha)
);

CREATE INDEX idx_pha_accion_fecha ON precio_historico_accion(id_accion, fecha DESC);

COMMENT ON TABLE precio_historico_accion IS 'Series de precios históricos diarios utilizadas para estimar μ, σ y ρ del modelo GBM.';


-- 3.2 BONOS ------------------------------------------------------------------
-- Tipos: tasa fija e indexados por inflación.
CREATE TABLE tipo_bono (
    id_tipo_bono SMALLSERIAL PRIMARY KEY,
    codigo       VARCHAR(30) NOT NULL UNIQUE,
    nombre       VARCHAR(80) NOT NULL,
    descripcion  TEXT
);

CREATE TABLE bono (
    id_bono                BIGSERIAL PRIMARY KEY,
    ticker                 VARCHAR(30)   NOT NULL UNIQUE,
    nombre                 VARCHAR(150)  NOT NULL,
    emisor                 VARCHAR(150),
    id_tipo_bono           SMALLINT      NOT NULL REFERENCES tipo_bono(id_tipo_bono),
    id_moneda              SMALLINT      NOT NULL REFERENCES moneda(id_moneda),
    valor_nominal          NUMERIC(20,6) NOT NULL CHECK (valor_nominal > 0),
    cupon                  NUMERIC(20,6) NOT NULL DEFAULT 0,
    frecuencia_cupon_meses SMALLINT      NOT NULL CHECK (frecuencia_cupon_meses > 0),
    tasa_descuento         NUMERIC(10,8) NOT NULL,
    fecha_emision          DATE          NOT NULL,
    fecha_vencimiento      DATE          NOT NULL,
    precio_actual          NUMERIC(20,6),
    fecha_precio_actual    TIMESTAMPTZ,
    activo                 BOOLEAN NOT NULL DEFAULT TRUE,
    CHECK (fecha_vencimiento > fecha_emision)
);

COMMENT ON TABLE  bono IS 'Bonos disponibles (tasa fija o indexados por inflación). Corresponden al mercado argentino (SR-02).';
COMMENT ON COLUMN bono.cupon          IS 'Monto del cupón periódico (C). En bonos indexados representa el cupón base antes del ajuste por inflación acumulada.';
COMMENT ON COLUMN bono.tasa_descuento IS 'r_d: tasa de descuento utilizada para valuar los flujos futuros descontados.';


-- Calendario de cupones y amortizaciones de cada bono.
CREATE TABLE flujo_bono (
    id_flujo_bono    BIGSERIAL PRIMARY KEY,
    id_bono          BIGINT        NOT NULL REFERENCES bono(id_bono) ON DELETE CASCADE,
    numero_cupon     SMALLINT      NOT NULL,
    fecha_pago       DATE          NOT NULL,
    monto_cupon      NUMERIC(20,6) NOT NULL DEFAULT 0,
    amortiza_capital BOOLEAN       NOT NULL DEFAULT FALSE,
    monto_capital    NUMERIC(20,6) NOT NULL DEFAULT 0,
    UNIQUE (id_bono, numero_cupon)
);

COMMENT ON TABLE flujo_bono IS 'Calendario de cupones y amortizaciones. Se genera al alta del bono y puede recalcularse ante cambios de parámetros.';


-- 3.3 LETRAS -----------------------------------------------------------------
CREATE TABLE tipo_letra (
    id_tipo_letra SMALLSERIAL PRIMARY KEY,
    codigo        VARCHAR(20) NOT NULL UNIQUE,
    nombre        VARCHAR(80) NOT NULL,
    descripcion   TEXT
);

CREATE TABLE letra (
    id_letra            BIGSERIAL PRIMARY KEY,
    ticker              VARCHAR(30)   NOT NULL UNIQUE,
    nombre              VARCHAR(150)  NOT NULL,
    emisor              VARCHAR(150),
    id_tipo_letra       SMALLINT      NOT NULL REFERENCES tipo_letra(id_tipo_letra),
    id_moneda           SMALLINT      NOT NULL REFERENCES moneda(id_moneda),
    valor_nominal       NUMERIC(20,6) NOT NULL CHECK (valor_nominal > 0),
    tasa                NUMERIC(10,8) NOT NULL,
    fecha_emision       DATE          NOT NULL,
    fecha_vencimiento   DATE          NOT NULL,
    precio_actual       NUMERIC(20,6),
    fecha_precio_actual TIMESTAMPTZ,
    activo              BOOLEAN NOT NULL DEFAULT TRUE,
    CHECK (fecha_vencimiento > fecha_emision)
);

COMMENT ON TABLE  letra IS 'Letras del Tesoro (cupón cero, corto plazo). Corresponden al mercado argentino (SR-02).';
COMMENT ON COLUMN letra.tasa IS 'Tasa de descuento o rendimiento. Para LECAP es fija; para LECER representa la tasa real sobre el coeficiente CER.';


-- 3.4 PLAZOS FIJOS -----------------------------------------------------------
CREATE TABLE tipo_plazo_fijo (
    id_tipo_plazo_fijo SMALLSERIAL PRIMARY KEY,
    codigo             VARCHAR(20) NOT NULL UNIQUE,
    nombre             VARCHAR(80) NOT NULL,
    descripcion        TEXT
);

COMMENT ON TABLE tipo_plazo_fijo IS 'Tipos de plazo fijo: TRADICIONAL (capitalización sobre TNA pactada) y UVA (capital ajustado por inflación más tasa real).';


-- =============================================================================
-- 4. PORTFOLIOS Y TENENCIAS
-- =============================================================================

CREATE TABLE portfolio (
    id_portfolio       BIGSERIAL PRIMARY KEY,
    id_usuario         BIGINT       NOT NULL REFERENCES usuario(id_usuario) ON DELETE CASCADE,
    id_perfil_riesgo   SMALLINT     NOT NULL REFERENCES perfil_riesgo(id_perfil_riesgo),
    id_moneda_base     SMALLINT     NOT NULL REFERENCES moneda(id_moneda),
    nombre             VARCHAR(100) NOT NULL,
    descripcion        TEXT,
    capital_inicial    NUMERIC(20,6) NOT NULL CHECK (capital_inicial > 0),
    horizonte_meses    SMALLINT      NOT NULL CHECK (horizonte_meses BETWEEN 1 AND 360),
    fecha_creacion     TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
    fecha_modificacion TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
    estado             VARCHAR(20)   NOT NULL DEFAULT 'ACTIVO'
                       CHECK (estado IN ('ACTIVO', 'ARCHIVADO')),
    UNIQUE (id_usuario, nombre)
);

CREATE INDEX idx_portfolio_usuario ON portfolio(id_usuario);

COMMENT ON TABLE portfolio IS 'Portfolio de inversión asociado a un usuario y un perfil de riesgo. Puede tener múltiples simulaciones históricas.';


-- 4.1 Tenencia de ACCIONES en portfolio
-- Una fila por acción: representa la posición total, no lotes independientes.
CREATE TABLE portfolio_accion (
    id_portfolio_accion BIGSERIAL PRIMARY KEY,
    id_portfolio        BIGINT        NOT NULL REFERENCES portfolio(id_portfolio) ON DELETE CASCADE,
    id_accion           BIGINT        NOT NULL REFERENCES accion(id_accion),
    cantidad            NUMERIC(20,6) NOT NULL CHECK (cantidad > 0),
    precio_compra       NUMERIC(20,6) NOT NULL,
    UNIQUE (id_portfolio, id_accion)
);

COMMENT ON COLUMN portfolio_accion.precio_compra IS 'Precio de referencia al incorporar la posición (base de costo). No interviene en el cálculo del GBM.';


-- 4.2 Tenencia de BONOS en portfolio
-- Una fila por bono: representa la posición total.
CREATE TABLE portfolio_bono (
    id_portfolio_bono BIGSERIAL PRIMARY KEY,
    id_portfolio      BIGINT        NOT NULL REFERENCES portfolio(id_portfolio) ON DELETE CASCADE,
    id_bono           BIGINT        NOT NULL REFERENCES bono(id_bono),
    cantidad          NUMERIC(20,6) NOT NULL CHECK (cantidad > 0),
    precio_compra     NUMERIC(20,6) NOT NULL,
    UNIQUE (id_portfolio, id_bono)
);

COMMENT ON COLUMN portfolio_bono.precio_compra IS 'Precio de referencia al incorporar la posición (base de costo). No interviene en la valuación por flujos descontados.';


-- 4.3 Tenencia de LETRAS en portfolio
-- Una fila por letra: representa la posición total.
CREATE TABLE portfolio_letra (
    id_portfolio_letra BIGSERIAL PRIMARY KEY,
    id_portfolio       BIGINT        NOT NULL REFERENCES portfolio(id_portfolio) ON DELETE CASCADE,
    id_letra           BIGINT        NOT NULL REFERENCES letra(id_letra),
    cantidad           NUMERIC(20,6) NOT NULL CHECK (cantidad > 0),
    precio_compra      NUMERIC(20,6) NOT NULL,
    UNIQUE (id_portfolio, id_letra)
);

COMMENT ON COLUMN portfolio_letra.precio_compra IS 'Precio de referencia al incorporar la posición (base de costo). No interviene en la valuación por descuento.';


-- 4.4 Depósitos a plazo fijo en portfolio
-- Cada fila es un contrato independiente de libre definición.
-- No existe restricción de unicidad: es válido tener dos depósitos en la
-- misma entidad con distintos montos, fechas o condiciones.
CREATE TABLE portfolio_plazo_fijo (
    id_portfolio_plazo_fijo   BIGSERIAL PRIMARY KEY,
    id_portfolio              BIGINT        NOT NULL REFERENCES portfolio(id_portfolio) ON DELETE CASCADE,
    id_tipo_plazo_fijo        SMALLINT      NOT NULL REFERENCES tipo_plazo_fijo(id_tipo_plazo_fijo),
    id_moneda                 SMALLINT      NOT NULL REFERENCES moneda(id_moneda),
    entidad_financiera        VARCHAR(150)  NOT NULL,
    monto_invertido           NUMERIC(20,6) NOT NULL CHECK (monto_invertido > 0),
    tna_pactada               NUMERIC(10,8) NOT NULL CHECK (tna_pactada >= 0),
    fecha_inicio              DATE          NOT NULL,
    duracion_meses            SMALLINT      NOT NULL CHECK (duracion_meses > 0),
    reinvertir_al_vencimiento BOOLEAN       NOT NULL DEFAULT FALSE
);

COMMENT ON TABLE  portfolio_plazo_fijo IS 'Depósitos a plazo fijo del portfolio. Cada fila es un contrato individual; entidad y TNA son ingresados libremente por el usuario.';
COMMENT ON COLUMN portfolio_plazo_fijo.tna_pactada               IS 'Tasa Nominal Anual acordada al momento de constituir el depósito.';
COMMENT ON COLUMN portfolio_plazo_fijo.reinvertir_al_vencimiento IS 'Si vence antes del horizonte T, indica si el capital más intereses se reinvierten automáticamente en un nuevo depósito equivalente.';


-- =============================================================================
-- 5. ESCENARIOS ECONÓMICOS Y DATOS MACRO
-- =============================================================================

CREATE TABLE tipo_escenario (
    id_tipo_escenario SMALLSERIAL PRIMARY KEY,
    codigo            VARCHAR(20) NOT NULL UNIQUE,
    nombre            VARCHAR(50) NOT NULL,
    descripcion       TEXT
);

COMMENT ON TABLE tipo_escenario IS 'Tipos de escenario económico (FAVORABLE, MODERADO, DESFAVORABLE) utilizados para estratificar las trayectorias Monte Carlo.';


-- Configuración paramétrica de rangos de inflación por tipo de escenario.
-- Soporta versiones históricas mediante vigente_desde / vigente_hasta.
CREATE TABLE escenario_economico (
    id_escenario_economico SMALLSERIAL PRIMARY KEY,
    id_tipo_escenario      SMALLINT      NOT NULL REFERENCES tipo_escenario(id_tipo_escenario),
    inflacion_mensual_min  NUMERIC(10,8) NOT NULL,
    inflacion_mensual_max  NUMERIC(10,8) NOT NULL,
    vigente_desde          DATE          NOT NULL DEFAULT CURRENT_DATE,
    vigente_hasta          DATE,
    CHECK (inflacion_mensual_min <= inflacion_mensual_max)
);

COMMENT ON TABLE escenario_economico IS 'Rangos de inflación mensual por escenario para el muestreo Monte Carlo estratificado. Los rangos pueden actualizarse sin perder el historial gracias a vigente_desde/hasta.';


-- Inflación histórica mensual para calibrar o validar los rangos de escenarios.
CREATE TABLE inflacion_historica (
    id_inflacion_historica BIGSERIAL PRIMARY KEY,
    id_moneda              SMALLINT      NOT NULL REFERENCES moneda(id_moneda),
    anio                   SMALLINT      NOT NULL,
    mes                    SMALLINT      NOT NULL CHECK (mes BETWEEN 1 AND 12),
    valor_mensual          NUMERIC(10,8) NOT NULL,
    UNIQUE (id_moneda, anio, mes)
);

COMMENT ON TABLE inflacion_historica IS 'Serie histórica de inflación mensual por moneda. Se utiliza para calibrar los rangos de escenario_economico.';


-- =============================================================================
-- 6. SIMULACIONES MONTE CARLO
-- =============================================================================

-- Cabecera de una corrida de simulación Monte Carlo sobre un portfolio.
CREATE TABLE simulacion (
    id_simulacion        BIGSERIAL PRIMARY KEY,
    id_portfolio         BIGINT        NOT NULL REFERENCES portfolio(id_portfolio) ON DELETE CASCADE,
    fecha_ejecucion      TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
    horizonte_meses      SMALLINT      NOT NULL CHECK (horizonte_meses BETWEEN 1 AND 360),
    num_trayectorias     INTEGER       NOT NULL CHECK (num_trayectorias > 0),
    seed_aleatoria       BIGINT        NOT NULL,
    -- Métricas agregadas sobre todas las trayectorias (para consultas rápidas)
    valor_inicial        NUMERIC(20,6) NOT NULL,
    valor_esperado       NUMERIC(20,6),
    valor_minimo         NUMERIC(20,6),
    valor_maximo         NUMERIC(20,6),
    retorno_esperado_pct NUMERIC(14,8),
    rendimiento_real_pct NUMERIC(14,8),
    desvio_estandar      NUMERIC(20,6),
    observaciones        TEXT
);

CREATE INDEX idx_simulacion_portfolio_fecha ON simulacion(id_portfolio, fecha_ejecucion DESC);

COMMENT ON TABLE  simulacion IS 'Cabecera de una corrida Monte Carlo. Las trayectorias mensuales no se persisten; se regeneran bajo demanda a partir de seed_aleatoria y simulacion_parametro_escenario (RF-16).';
COMMENT ON COLUMN simulacion.seed_aleatoria IS 'Semilla pseudoaleatoria que permite reproducir exactamente las trayectorias de la simulación (RF-16).';


-- Parámetros de inflación vigentes al momento de ejecutar cada simulación.
-- Garantiza reproducibilidad aunque escenario_economico sea modificado posteriormente.
CREATE TABLE simulacion_parametro_escenario (
    id_simulacion         BIGINT        NOT NULL REFERENCES simulacion(id_simulacion) ON DELETE CASCADE,
    id_tipo_escenario     SMALLINT      NOT NULL REFERENCES tipo_escenario(id_tipo_escenario),
    inflacion_mensual_min NUMERIC(10,8) NOT NULL,
    inflacion_mensual_max NUMERIC(10,8) NOT NULL,
    PRIMARY KEY (id_simulacion, id_tipo_escenario)
);

COMMENT ON TABLE simulacion_parametro_escenario IS 'Snapshot de los rangos de inflación utilizados en la simulación. Satisface RF-11 y garantiza reproducibilidad (RF-16) ante cambios futuros en escenario_economico.';


-- Una trayectoria = una realización completa bajo un único tipo de escenario.
CREATE TABLE trayectoria (
    id_trayectoria     BIGSERIAL PRIMARY KEY,
    id_simulacion      BIGINT        NOT NULL REFERENCES simulacion(id_simulacion) ON DELETE CASCADE,
    numero_trayectoria INTEGER       NOT NULL,
    id_tipo_escenario  SMALLINT      NOT NULL REFERENCES tipo_escenario(id_tipo_escenario),
    valor_final        NUMERIC(20,6) NOT NULL,
    rendimiento_nominal NUMERIC(14,8),
    rendimiento_real   NUMERIC(14,8),
    UNIQUE (id_simulacion, numero_trayectoria)
);

CREATE INDEX idx_trayectoria_simulacion ON trayectoria(id_simulacion);

COMMENT ON TABLE trayectoria IS 'Resultado final de cada trayectoria Monte Carlo. Almacena el valor final y los rendimientos para cálculo de métricas (VaR, percentiles). La evolución mes a mes se regenera desde la semilla cuando se solicita visualización.';


-- =============================================================================
-- 7. RESULTADOS DE SIMULACIÓN POR INSTRUMENTO
-- =============================================================================

-- Estadísticas temporales completas por instrumento (o portfolio_ars/portfolio_usd),
-- escenario y métrica. Elimina la necesidad de re-ejecutar el motor para visualizar.
CREATE TABLE resultado_simulacion (
    id_resultado  BIGSERIAL    PRIMARY KEY,
    id_simulacion BIGINT       NOT NULL REFERENCES simulacion(id_simulacion) ON DELETE CASCADE,
    -- 'portfolio_ars', 'portfolio_usd', o el id del instrumento (ej: 'accion_1')
    ambito        VARCHAR(50)  NOT NULL,
    -- 'global' | 'favorable' | 'moderado' | 'desfavorable'
    escenario     VARCHAR(20)  NOT NULL,
    -- 'patrimonio' | 'ganancias_nominales' | 'ganancias_reales'
    metrica       VARCHAR(30)  NOT NULL,
    -- { "media":[...], "mediana":[...], "p25":[...], "p75":[...], "minimo":[...], "maximo":[...] }
    -- Cada array tiene largo horizonte_meses + 1
    stats         JSONB        NOT NULL,
    UNIQUE (id_simulacion, ambito, escenario, metrica)
);

CREATE INDEX idx_resultado_simulacion ON resultado_simulacion(id_simulacion, ambito);

COMMENT ON TABLE  resultado_simulacion IS 'Estadísticas temporales (media, mediana, p25, p75, mín, máx) por instrumento o sub-portfolio, escenario y métrica. Una fila por combinación (simulacion, ambito, escenario, metrica).';
COMMENT ON COLUMN resultado_simulacion.ambito    IS 'portfolio_ars, portfolio_usd, o id del instrumento tal como llega en el JSON del motor.';
COMMENT ON COLUMN resultado_simulacion.escenario IS 'global | favorable | moderado | desfavorable';
COMMENT ON COLUMN resultado_simulacion.metrica   IS 'patrimonio | ganancias_nominales | ganancias_reales';
COMMENT ON COLUMN resultado_simulacion.stats     IS 'Vector de largo T+1 para cada estadístico. Índice 0 corresponde a t=0 (monto inicial).';


-- =============================================================================
-- 8. DATOS DE CATÁLOGO INICIALES
-- =============================================================================

INSERT INTO moneda (codigo_iso, nombre, simbolo) VALUES
    ('ARS', 'Peso argentino',       '$'  ),
    ('USD', 'Dólar estadounidense', 'US$');

INSERT INTO perfil_riesgo (nombre, descripcion, sigma_max_accion) VALUES
    ('Conservador', 'Prioriza preservación de capital y baja volatilidad.',  0.08),
    ('Moderado',    'Equilibrio entre estabilidad y crecimiento.',            0.15),
    ('Agresivo',    'Alta exposición a renta variable y mayor volatilidad.', 0.30);

INSERT INTO tipo_bono (codigo, nombre, descripcion) VALUES
    ('TASA_FIJA',          'Bono a tasa fija',            'Paga cupones constantes a lo largo del tiempo.'),
    ('INDEXADO_INFLACION', 'Bono indexado por inflación', 'Capital y/o cupones ajustan por inflación acumulada.');

INSERT INTO tipo_letra (codigo, nombre, descripcion) VALUES
    ('LECAP', 'Letra a tasa fija',           'Rendimiento determinado al momento de emisión.'),
    ('LECER', 'Letra indexada por inflación', 'Valor nominal ajustado por el coeficiente CER.');

INSERT INTO tipo_plazo_fijo (codigo, nombre, descripcion) VALUES
    ('TRADICIONAL', 'Plazo fijo tradicional', 'Capitalización compuesta sobre la TNA pactada.'),
    ('UVA',         'Plazo fijo UVA',         'Capital ajustado por inflación más interés real.');

INSERT INTO tipo_escenario (codigo, nombre, descripcion) VALUES
    ('FAVORABLE',    'Favorable',    'Contexto económico con inflación contenida y tasas estables.'),
    ('MODERADO',     'Moderado',     'Contexto económico neutro.'),
    ('DESFAVORABLE', 'Desfavorable', 'Contexto económico con inflación elevada y alta incertidumbre.');

INSERT INTO indice_mercado (codigo, nombre, pais, id_moneda) VALUES
    ('MERVAL', 'S&P Merval', 'Argentina',      (SELECT id_moneda FROM moneda WHERE codigo_iso = 'ARS')),
    ('SP500',  'S&P 500',    'Estados Unidos', (SELECT id_moneda FROM moneda WHERE codigo_iso = 'USD'));


COMMIT;

-- =============================================================================
-- FIN DEL SCRIPT
-- =============================================================================