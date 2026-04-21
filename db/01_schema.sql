-- =============================================================================
--  SIMULADOR FINANCIERO - ESQUEMA DE BASE DE DATOS
--  Motor: PostgreSQL 15+
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
DROP SCHEMA IF EXISTS simulador CASCADE;
CREATE SCHEMA simulador;
SET search_path TO simulador, public;


-- =============================================================================
-- 1. DOMINIO DE USUARIOS Y PERFILES
-- =============================================================================

CREATE TABLE usuario (
    id_usuario         BIGSERIAL PRIMARY KEY,
    username           VARCHAR(50)  UNIQUE,
    email              VARCHAR(150) UNIQUE,
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
    -- Restricciones para validar el portfolio
    sigma_max_accion  NUMERIC(5,4) NOT NULL CHECK (pct_renta_variable_max BETWEEN 0 AND 1),

);

COMMENT ON TABLE perfil_riesgo IS 'Catálogo de perfiles (conservador, moderado, agresivo).';


-- =============================================================================
-- 2. DOMINIO DE REFERENCIA: MONEDAS E ÍNDICES DE MERCADO
-- =============================================================================

CREATE TABLE moneda (
    id_moneda   SMALLSERIAL PRIMARY KEY,
    codigo_iso  CHAR(3)      NOT NULL UNIQUE,  
    nombre      VARCHAR(50)  NOT NULL,
    simbolo     VARCHAR(5)   NOT NULL
);

COMMENT ON TABLE moneda IS 'Monedas soportadas por el sistema (ARS, USD).';


CREATE TABLE tipo_cambio (
    id_tipo_cambio     BIGSERIAL PRIMARY KEY,
    id_moneda_origen   SMALLINT NOT NULL REFERENCES moneda(id_moneda),
    id_moneda_destino  SMALLINT NOT NULL REFERENCES moneda(id_moneda),
    fecha              DATE     NOT NULL,
    valor              NUMERIC(20,8) NOT NULL CHECK (valor > 0),
    UNIQUE (id_moneda_origen, id_moneda_destino, fecha)
);

COMMENT ON TABLE tipo_cambio IS 'Cotizaciones históricas entre monedas (ej: USD→ARS).';


CREATE TABLE indice_mercado (
    id_indice_mercado  SMALLSERIAL PRIMARY KEY,
    codigo             VARCHAR(20) NOT NULL UNIQUE,   -- MERVAL, SP500
    nombre             VARCHAR(100) NOT NULL,
    pais               VARCHAR(50),
    id_moneda          SMALLINT NOT NULL REFERENCES moneda(id_moneda),
    descripcion        TEXT
);

COMMENT ON TABLE indice_mercado IS 'Índices de referencia utilizados para el modelo GBM (factor sistemático).';


CREATE TABLE precio_historico_indice (
    id_precio_historico_indice  BIGSERIAL PRIMARY KEY,
    id_indice_mercado           SMALLINT NOT NULL REFERENCES indice_mercado(id_indice_mercado) ON DELETE CASCADE,
    fecha                       DATE     NOT NULL,
    valor_cierre                NUMERIC(20,6) NOT NULL,
    UNIQUE (id_indice_mercado, fecha)
);

CREATE INDEX idx_phi_indice_fecha ON precio_historico_indice(id_indice_mercado, fecha DESC);


-- =============================================================================
-- 3. INSTRUMENTOS FINANCIEROS DISPONIBLES (CATÁLOGO)
-- =============================================================================

-- 3.1 ACCIONES --------------------------------------------------------------
-- Se modelan mediante Movimiento Browniano Geométrico (GBM).
-- Se persisten los parámetros estimados (μ, σ, ρ) para evitar recalcularlos
-- en cada simulación. Se refrescan periódicamente a partir de datos históricos.
CREATE TABLE accion (
    id_accion                BIGSERIAL PRIMARY KEY,
    ticker                   VARCHAR(20) NOT NULL UNIQUE,
    nombre                   VARCHAR(150) NOT NULL,
    sector                   VARCHAR(100),
    id_indice_mercado        SMALLINT NOT NULL REFERENCES indice_mercado(id_indice_mercado),
    id_moneda                SMALLINT NOT NULL REFERENCES moneda(id_moneda),
    -- Parámetros del modelo GBM (mensuales)
    mu_retorno_esperado      NUMERIC(14,10),   
    sigma_volatilidad        NUMERIC(14,10),   
    rho_correlacion_indice   NUMERIC(8,6) CHECK (rho_correlacion_indice BETWEEN -1 AND 1),
    precio_actual            NUMERIC(20,6),
    fecha_precio_actual      TIMESTAMPTZ,
    fecha_estimacion_params  TIMESTAMPTZ,
    activo                   BOOLEAN NOT NULL DEFAULT TRUE
);

COMMENT ON TABLE accion IS 'Acciones disponibles para conformar portfolios. Los parámetros μ, σ y ρ se estiman a partir de retornos logarítmicos históricos.';
COMMENT ON COLUMN accion.mu_retorno_esperado IS 'Retorno esperado (drift del GBM).';
COMMENT ON COLUMN accion.sigma_volatilidad   IS 'Desvío estándar de los retornos logarítmicos.';
COMMENT ON COLUMN accion.rho_correlacion_indice IS 'Correlación entre la acción y su índice de mercado de referencia.';


CREATE TABLE precio_historico_accion (
    id_precio_historico_accion BIGSERIAL PRIMARY KEY,
    id_accion                  BIGINT NOT NULL REFERENCES accion(id_accion) ON DELETE CASCADE,
    fecha                      DATE   NOT NULL,
    precio_apertura            NUMERIC(20,6),
    precio_cierre              NUMERIC(20,6) NOT NULL,
    precio_maximo              NUMERIC(20,6),
    precio_minimo              NUMERIC(20,6),
    precio_ajustado            NUMERIC(20,6),
    volumen                    BIGINT,
    UNIQUE (id_accion, fecha)
);

CREATE INDEX idx_pha_accion_fecha ON precio_historico_accion(id_accion, fecha DESC);

COMMENT ON TABLE precio_historico_accion IS 'Series de precios históricos utilizadas para estimar μ, σ y ρ.';


-- 3.2 BONOS ----------------------------------------------------------------
-- Tipos: tasa fija e indexados por inflación (ver sección 4.2.2 del documento).
CREATE TABLE tipo_bono (
    id_tipo_bono SMALLSERIAL PRIMARY KEY,
    codigo       VARCHAR(30) NOT NULL UNIQUE,   -- TASA_FIJA, INDEXADO_INFLACION
    nombre       VARCHAR(80) NOT NULL,
    descripcion  TEXT
);

CREATE TABLE bono (
    id_bono                 BIGSERIAL PRIMARY KEY,
    ticker                  VARCHAR(30) NOT NULL UNIQUE,
    nombre                  VARCHAR(150) NOT NULL,
    emisor                  VARCHAR(150),
    id_tipo_bono            SMALLINT NOT NULL REFERENCES tipo_bono(id_tipo_bono),
    id_moneda               SMALLINT NOT NULL REFERENCES moneda(id_moneda),
    valor_nominal           NUMERIC(20,6) NOT NULL CHECK (valor_nominal > 0),
    cupon                   NUMERIC(20,6) NOT NULL DEFAULT 0,           -- pago periódico (C)
    frecuencia_cupon_meses  SMALLINT NOT NULL CHECK (frecuencia_cupon_meses > 0),
    tasa_descuento          NUMERIC(10,8) NOT NULL,                     -- r_d
    fecha_emision           DATE NOT NULL,
    fecha_vencimiento       DATE NOT NULL,
    precio_actual           NUMERIC(20,6),
    fecha_precio_actual     TIMESTAMPTZ,
    activo                  BOOLEAN NOT NULL DEFAULT TRUE,
    CHECK (fecha_vencimiento > fecha_emision)
);

COMMENT ON TABLE bono IS 'Bonos disponibles (tasa fija o indexados por inflación).';
COMMENT ON COLUMN bono.tasa_descuento IS 'r_d: tasa de descuento usada para valuar los flujos futuros.';


-- Flujos de fondos pronosticados (opcional, útil para precalcular la valuación).
CREATE TABLE flujo_bono (
    id_flujo_bono   BIGSERIAL PRIMARY KEY,
    id_bono         BIGINT NOT NULL REFERENCES bono(id_bono) ON DELETE CASCADE,
    numero_cupon    SMALLINT NOT NULL,
    fecha_pago      DATE     NOT NULL,
    monto_cupon     NUMERIC(20,6) NOT NULL DEFAULT 0,
    amortiza_capital BOOLEAN  NOT NULL DEFAULT FALSE,
    monto_capital   NUMERIC(20,6) NOT NULL DEFAULT 0,
    UNIQUE (id_bono, numero_cupon)
);

COMMENT ON TABLE flujo_bono IS 'Calendario de cupones y amortizaciones. Puede generarse al alta del bono o recalcularse.';


-- 3.3 LETRAS ---------------------------------------------------------------
CREATE TABLE tipo_letra (
    id_tipo_letra SMALLSERIAL PRIMARY KEY,
    codigo        VARCHAR(20) NOT NULL UNIQUE,   -- LECAP, LECER
    nombre        VARCHAR(80) NOT NULL,
    descripcion   TEXT
);

CREATE TABLE letra (
    id_letra             BIGSERIAL PRIMARY KEY,
    ticker               VARCHAR(30) NOT NULL UNIQUE,
    nombre               VARCHAR(150) NOT NULL,
    emisor               VARCHAR(150),
    id_tipo_letra        SMALLINT NOT NULL REFERENCES tipo_letra(id_tipo_letra),
    id_moneda            SMALLINT NOT NULL REFERENCES moneda(id_moneda),
    valor_nominal        NUMERIC(20,6) NOT NULL CHECK (valor_nominal > 0),
    tasa                 NUMERIC(10,8) NOT NULL,   -- tasa de descuento / rendimiento
    fecha_emision        DATE NOT NULL,
    fecha_vencimiento    DATE NOT NULL,
    precio_actual        NUMERIC(20,6),
    fecha_precio_actual  TIMESTAMPTZ,
    activo               BOOLEAN NOT NULL DEFAULT TRUE,
    CHECK (fecha_vencimiento > fecha_emision)
);

COMMENT ON TABLE letra IS 'Letras (cupón cero, corto plazo). LECAP: tasa fija. LECER: indexada por inflación (CER).';


-- 3.4 PLAZOS FIJOS ---------------------------------------------------------
CREATE TABLE tipo_plazo_fijo (
    id_tipo_plazo_fijo SMALLSERIAL PRIMARY KEY,
    codigo             VARCHAR(20) NOT NULL UNIQUE,   -- TRADICIONAL, UVA
    nombre             VARCHAR(80) NOT NULL,
    descripcion        TEXT
);

-- Producto ofrecido por una entidad financiera (plantilla).
-- El monto y fecha reales quedan en portfolio_plazo_fijo (ver sección 4).
CREATE TABLE plazo_fijo_producto (
    id_plazo_fijo_producto BIGSERIAL PRIMARY KEY,
    entidad_financiera     VARCHAR(150) NOT NULL,
    id_tipo_plazo_fijo     SMALLINT NOT NULL REFERENCES tipo_plazo_fijo(id_tipo_plazo_fijo),
    id_moneda              SMALLINT NOT NULL REFERENCES moneda(id_moneda),
    tna                    NUMERIC(10,8) NOT NULL CHECK (tna >= 0),   -- Tasa Nominal Anual
    plazo_min_dias         SMALLINT NOT NULL CHECK (plazo_min_dias > 0),
    plazo_max_dias         SMALLINT NOT NULL CHECK (plazo_max_dias >= plazo_min_dias),
    fecha_actualizacion    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    activo                 BOOLEAN NOT NULL DEFAULT TRUE
);

COMMENT ON TABLE plazo_fijo_producto IS 'Catálogo de productos de plazo fijo ofrecidos (por entidad y tipo).';


-- 3.5 Tipos de instrumentos permitidos por perfil (restricciones)
-- Útil para asegurar la coherencia perfil ↔ instrumento.
CREATE TABLE perfil_instrumento_permitido (
    id_perfil_riesgo     SMALLINT NOT NULL REFERENCES perfil_riesgo(id_perfil_riesgo) ON DELETE CASCADE,
    tipo_instrumento     VARCHAR(20) NOT NULL,   -- ACCION, BONO, LETRA, PLAZO_FIJO
    pct_maximo           NUMERIC(5,4) NOT NULL CHECK (pct_maximo BETWEEN 0 AND 1),
    PRIMARY KEY (id_perfil_riesgo, tipo_instrumento)
);

COMMENT ON TABLE perfil_instrumento_permitido IS 'Porcentaje máximo permitido de cada tipo de instrumento por perfil (ej: CONSERVADOR puede tener máx 20% en acciones).';


-- =============================================================================
-- 4. PORTFOLIOS Y TENENCIAS
-- =============================================================================

CREATE TABLE portfolio (
    id_portfolio         BIGSERIAL PRIMARY KEY,
    id_usuario           BIGINT   NOT NULL REFERENCES usuario(id_usuario) ON DELETE CASCADE,
    id_perfil_riesgo     SMALLINT NOT NULL REFERENCES perfil_riesgo(id_perfil_riesgo),
    id_moneda_base       SMALLINT NOT NULL REFERENCES moneda(id_moneda),
    nombre               VARCHAR(100) NOT NULL,
    descripcion          TEXT,
    capital_inicial      NUMERIC(20,6) NOT NULL CHECK (capital_inicial > 0),
    horizonte_meses      SMALLINT NOT NULL CHECK (horizonte_meses BETWEEN 1 AND 360),
    fecha_creacion       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    fecha_modificacion   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    estado               VARCHAR(20) NOT NULL DEFAULT 'ACTIVO', -- ACTIVO, ARCHIVADO
    UNIQUE (id_usuario, nombre)
);

CREATE INDEX idx_portfolio_usuario ON portfolio(id_usuario);

COMMENT ON TABLE portfolio IS 'Portfolio (estrategia de inversión) asociado a un usuario y un perfil de riesgo.';


-- 4.1 Tenencia de ACCIONES en portfolio
CREATE TABLE portfolio_accion (
    id_portfolio_accion  BIGSERIAL PRIMARY KEY,
    id_portfolio         BIGINT NOT NULL REFERENCES portfolio(id_portfolio) ON DELETE CASCADE,
    id_accion            BIGINT NOT NULL REFERENCES accion(id_accion),
    cantidad             NUMERIC(20,6) NOT NULL CHECK (cantidad > 0),
    precio_compra        NUMERIC(20,6) NOT NULL,
    fecha_compra         DATE NOT NULL DEFAULT CURRENT_DATE,
    UNIQUE (id_portfolio, id_accion, fecha_compra)
);

-- 4.2 Tenencia de BONOS en portfolio
CREATE TABLE portfolio_bono (
    id_portfolio_bono    BIGSERIAL PRIMARY KEY,
    id_portfolio         BIGINT NOT NULL REFERENCES portfolio(id_portfolio) ON DELETE CASCADE,
    id_bono              BIGINT NOT NULL REFERENCES bono(id_bono),
    cantidad             NUMERIC(20,6) NOT NULL CHECK (cantidad > 0),
    precio_compra        NUMERIC(20,6) NOT NULL,
    fecha_compra         DATE NOT NULL DEFAULT CURRENT_DATE,
    UNIQUE (id_portfolio, id_bono, fecha_compra)
);

-- 4.3 Tenencia de LETRAS en portfolio
CREATE TABLE portfolio_letra (
    id_portfolio_letra   BIGSERIAL PRIMARY KEY,
    id_portfolio         BIGINT NOT NULL REFERENCES portfolio(id_portfolio) ON DELETE CASCADE,
    id_letra             BIGINT NOT NULL REFERENCES letra(id_letra),
    cantidad             NUMERIC(20,6) NOT NULL CHECK (cantidad > 0),
    precio_compra        NUMERIC(20,6) NOT NULL,
    fecha_compra         DATE NOT NULL DEFAULT CURRENT_DATE,
    UNIQUE (id_portfolio, id_letra, fecha_compra)
);

-- 4.4 Tenencia de PLAZOS FIJOS en portfolio
CREATE TABLE portfolio_plazo_fijo (
    id_portfolio_plazo_fijo   BIGSERIAL PRIMARY KEY,
    id_portfolio              BIGINT NOT NULL REFERENCES portfolio(id_portfolio) ON DELETE CASCADE,
    id_plazo_fijo_producto    BIGINT NOT NULL REFERENCES plazo_fijo_producto(id_plazo_fijo_producto),
    monto_invertido           NUMERIC(20,6) NOT NULL CHECK (monto_invertido > 0),
    tna_pactada               NUMERIC(10,8) NOT NULL CHECK (tna_pactada >= 0),
    fecha_inicio              DATE NOT NULL,
    duracion_meses            SMALLINT NOT NULL CHECK (duracion_meses > 0),
    reinvertir_al_vencimiento BOOLEAN NOT NULL DEFAULT FALSE
);

COMMENT ON COLUMN portfolio_plazo_fijo.reinvertir_al_vencimiento IS
    'Si el plazo fijo vence antes de T, define la estrategia: reinversión total o no reinversión (sección 4.2.4.3).';


-- =============================================================================
-- 5. ESCENARIOS ECONÓMICOS Y DATOS MACRO
-- =============================================================================

CREATE TABLE tipo_escenario (
    id_tipo_escenario SMALLSERIAL PRIMARY KEY,
    codigo            VARCHAR(20) NOT NULL UNIQUE,   -- FAVORABLE, MODERADO, DESFAVORABLE
    nombre            VARCHAR(50) NOT NULL,
    descripcion       TEXT
);


-- Configuración paramétrica de cada tipo de escenario.
-- Permite modificar los rangos de inflación sin cambiar código.
CREATE TABLE escenario_economico (
    id_escenario_economico  SMALLSERIAL PRIMARY KEY,
    id_tipo_escenario       SMALLINT NOT NULL REFERENCES tipo_escenario(id_tipo_escenario),
    inflacion_mensual_min   NUMERIC(10,8) NOT NULL,
    inflacion_mensual_max   NUMERIC(10,8) NOT NULL,
    vigente_desde           DATE NOT NULL DEFAULT CURRENT_DATE,
    vigente_hasta           DATE,
    CHECK (inflacion_mensual_min <= inflacion_mensual_max)
);

COMMENT ON TABLE escenario_economico IS 'Rangos por escenario utilizados para generar aleatoriamente variables macroeconómicas (Monte Carlo estratificado).';


-- Inflación histórica (para validar o calibrar rangos de escenarios).
CREATE TABLE inflacion_historica (
    id_inflacion_historica BIGSERIAL PRIMARY KEY,
    id_moneda              SMALLINT NOT NULL REFERENCES moneda(id_moneda),
    anio                   SMALLINT NOT NULL,
    mes                    SMALLINT NOT NULL CHECK (mes BETWEEN 1 AND 12),
    valor_mensual          NUMERIC(10,8) NOT NULL,
    UNIQUE (id_moneda, anio, mes)
);


-- =============================================================================
-- 6. SIMULACIONES MONTE CARLO
-- =============================================================================

-- Cabecera de una corrida de simulación sobre un portfolio.
CREATE TABLE simulacion (
    id_simulacion          BIGSERIAL PRIMARY KEY,
    id_portfolio           BIGINT NOT NULL REFERENCES portfolio(id_portfolio) ON DELETE CASCADE,
    fecha_ejecucion        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    horizonte_meses        SMALLINT NOT NULL CHECK (horizonte_meses BETWEEN 1 AND 360),
    num_trayectorias       INTEGER NOT NULL CHECK (num_trayectorias > 0),
    seed_aleatoria         BIGINT,
    -- Métricas agregadas resultantes (para consultas rápidas)
    valor_inicial          NUMERIC(20,6) NOT NULL,
    valor_esperado         NUMERIC(20,6),
    valor_minimo           NUMERIC(20,6),
    valor_maximo           NUMERIC(20,6),
    retorno_esperado_pct   NUMERIC(14,8),
    rendimiento_real_pct   NUMERIC(14,8),
    desvio_estandar        NUMERIC(20,6),
    estado                 VARCHAR(20) NOT NULL DEFAULT 'COMPLETADA',  -- EN_PROCESO, COMPLETADA, ERROR
    observaciones          TEXT
);

CREATE INDEX idx_simulacion_portfolio_fecha ON simulacion(id_portfolio, fecha_ejecucion DESC);

COMMENT ON TABLE simulacion IS 'Ejecución de Monte Carlo sobre un portfolio. Guarda métricas agregadas y referencia trayectorias (tabla hija).';


-- Una trayectoria = una realización completa del escenario económico.
CREATE TABLE trayectoria (
    id_trayectoria       BIGSERIAL PRIMARY KEY,
    id_simulacion        BIGINT NOT NULL REFERENCES simulacion(id_simulacion) ON DELETE CASCADE,
    numero_trayectoria   INTEGER NOT NULL,
    id_tipo_escenario    SMALLINT NOT NULL REFERENCES tipo_escenario(id_tipo_escenario),
    valor_final          NUMERIC(20,6) NOT NULL,
    rendimiento_nominal  NUMERIC(14,8),
    rendimiento_real     NUMERIC(14,8),
    UNIQUE (id_simulacion, numero_trayectoria)
);

CREATE INDEX idx_trayectoria_simulacion ON trayectoria(id_simulacion);

COMMENT ON TABLE trayectoria IS 'Cada trayectoria corresponde a un único tipo de escenario mantenido durante todo el horizonte (estratificación).';


-- Evolución mensual del portfolio en cada trayectoria.
CREATE TABLE trayectoria_paso (
    id_trayectoria_paso BIGSERIAL PRIMARY KEY,
    id_trayectoria      BIGINT NOT NULL REFERENCES trayectoria(id_trayectoria) ON DELETE CASCADE,
    mes                 SMALLINT NOT NULL CHECK (mes >= 0),
    valor_portfolio     NUMERIC(20,6) NOT NULL,
    inflacion_mes       NUMERIC(10,8),
    z_indice            NUMERIC(14,8),     -- shock sistemático del mercado (ver 4.2.1.2)
    UNIQUE (id_trayectoria, mes)
);

CREATE INDEX idx_trayectoria_paso ON trayectoria_paso(id_trayectoria, mes);


-- (Opcional) Valor de cada instrumento del portfolio en cada paso de cada trayectoria.
-- Permite desagregar el aporte de cada activo. Puede ser costoso en espacio:
-- desactivar para volúmenes grandes.
CREATE TABLE trayectoria_instrumento_paso (
    id_trayectoria_instrumento_paso BIGSERIAL PRIMARY KEY,
    id_trayectoria      BIGINT   NOT NULL REFERENCES trayectoria(id_trayectoria) ON DELETE CASCADE,
    mes                 SMALLINT NOT NULL CHECK (mes >= 0),
    tipo_instrumento    VARCHAR(20) NOT NULL,  -- ACCION, BONO, LETRA, PLAZO_FIJO
    id_instrumento      BIGINT   NOT NULL,     -- id_portfolio_accion / _bono / _letra / _plazo_fijo
    valor               NUMERIC(20,6) NOT NULL,
    UNIQUE (id_trayectoria, mes, tipo_instrumento, id_instrumento)
);

COMMENT ON TABLE trayectoria_instrumento_paso IS
    'Valor simulado de cada tenencia en cada mes. Útil para análisis de contribución por activo. Se recomienda particionar por id_simulacion si crece mucho.';


-- Métricas adicionales extensibles (VaR, Sharpe, Sortino, percentiles...).
CREATE TABLE metrica_simulacion (
    id_metrica_simulacion BIGSERIAL PRIMARY KEY,
    id_simulacion         BIGINT NOT NULL REFERENCES simulacion(id_simulacion) ON DELETE CASCADE,
    id_tipo_escenario     SMALLINT REFERENCES tipo_escenario(id_tipo_escenario), -- NULL = agregada total
    nombre_metrica        VARCHAR(50) NOT NULL,
    valor                 NUMERIC(20,8) NOT NULL,
    UNIQUE (id_simulacion, id_tipo_escenario, nombre_metrica)
);

COMMENT ON TABLE metrica_simulacion IS 'Métricas adicionales calculadas por simulación o por tipo de escenario.';


-- =============================================================================
-- 7. SEGURIDAD Y AUDITORÍA (básico)
-- =============================================================================

CREATE TABLE sesion_usuario (
    id_sesion          BIGSERIAL PRIMARY KEY,
    id_usuario         BIGINT NOT NULL REFERENCES usuario(id_usuario) ON DELETE CASCADE,
    token              VARCHAR(255) NOT NULL UNIQUE,
    ip_origen          INET,
    user_agent         TEXT,
    fecha_creacion     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    fecha_expiracion   TIMESTAMPTZ NOT NULL,
    revocada           BOOLEAN NOT NULL DEFAULT FALSE
);


-- =============================================================================
-- 8. SEMILLAS / DATOS DE CATÁLOGO
-- =============================================================================

INSERT INTO moneda (codigo_iso, nombre, simbolo) VALUES
    ('ARS', 'Peso argentino',  '$'),
    ('USD', 'Dólar estadounidense', 'US$');

INSERT INTO perfil_riesgo (codigo, nombre, descripcion, pct_renta_variable_max, pct_renta_fija_min, volatilidad_max_anual) VALUES
    ('CONSERVADOR', 'Conservador', 'Prioriza preservación de capital y baja volatilidad.', 0.2000, 0.7000, 0.08),
    ('MODERADO',    'Moderado',    'Equilibrio entre estabilidad y crecimiento.',          0.5000, 0.4000, 0.15),
    ('AGRESIVO',    'Agresivo',    'Alta exposición a renta variable y mayor volatilidad.', 1.0000, 0.0000, 0.30);

INSERT INTO tipo_bono (codigo, nombre, descripcion) VALUES
    ('TASA_FIJA',          'Bono a tasa fija',         'Paga cupones constantes a lo largo del tiempo.'),
    ('INDEXADO_INFLACION', 'Bono indexado por inflación', 'Capital y/o cupones ajustan por inflación acumulada.');

INSERT INTO tipo_letra (codigo, nombre, descripcion) VALUES
    ('LECAP', 'Letra a tasa fija',          'Rendimiento determinado al momento de emisión.'),
    ('LECER', 'Letra indexada por inflación','Valor nominal ajustado por el coeficiente CER.');

INSERT INTO tipo_plazo_fijo (codigo, nombre, descripcion) VALUES
    ('TRADICIONAL', 'Plazo fijo tradicional', 'Capitalización compuesta sobre la TNA pactada.'),
    ('UVA',         'Plazo fijo UVA',         'Capital ajustado por inflación, más interés real.');

INSERT INTO tipo_escenario (codigo, nombre, descripcion) VALUES
    ('FAVORABLE',    'Favorable',    'Contexto económico con inflación contenida y tasas estables.'),
    ('MODERADO',     'Moderado',     'Contexto económico neutro.'),
    ('DESFAVORABLE', 'Desfavorable', 'Contexto económico con inflación elevada y alta incertidumbre.');

INSERT INTO indice_mercado (codigo, nombre, pais, id_moneda) VALUES
    ('MERVAL', 'S&P Merval',   'Argentina',     (SELECT id_moneda FROM moneda WHERE codigo_iso = 'ARS')),
    ('SP500',  'S&P 500',      'Estados Unidos',(SELECT id_moneda FROM moneda WHERE codigo_iso = 'USD'));

-- Restricciones de composición por perfil (valores iniciales orientativos).
INSERT INTO perfil_instrumento_permitido (id_perfil_riesgo, tipo_instrumento, pct_maximo)
SELECT pr.id_perfil_riesgo, x.tipo, x.pct
FROM perfil_riesgo pr
CROSS JOIN LATERAL (VALUES
    ('ACCION',      CASE pr.codigo WHEN 'CONSERVADOR' THEN 0.20 WHEN 'MODERADO' THEN 0.50 ELSE 1.00 END),
    ('BONO',        CASE pr.codigo WHEN 'CONSERVADOR' THEN 0.60 WHEN 'MODERADO' THEN 0.60 ELSE 0.40 END),
    ('LETRA',       CASE pr.codigo WHEN 'CONSERVADOR' THEN 0.80 WHEN 'MODERADO' THEN 0.60 ELSE 0.30 END),
    ('PLAZO_FIJO',  CASE pr.codigo WHEN 'CONSERVADOR' THEN 0.80 WHEN 'MODERADO' THEN 0.50 ELSE 0.20 END)
) AS x(tipo, pct);


COMMIT;

-- =============================================================================
-- FIN DEL SCRIPT
-- =============================================================================
