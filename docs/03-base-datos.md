# Base de datos — Decisiones de diseño

**Archivo:** `db/01_schema.sql`  
**Motor:** PostgreSQL 15  
**Schema:** `simulador_financiero`

---

## Decisión 1: Tipo de dato para tasas e inflación — `NUMERIC(10,8)`

**Decisión:** las tasas, rendimientos y valores de inflación se almacenan como `NUMERIC(10,8)` expresados en forma decimal. Por ejemplo, una TNA del 42% se guarda como `0.42000000`.

**Justificación:** los tipos de punto flotante (`FLOAT`, `DOUBLE PRECISION`) no pueden representar exactamente ciertos valores decimales, lo que acumula error en cálculos financieros repetidos. `NUMERIC` es exacto (representación decimal interna), lo que garantiza que los parámetros del motor se recuperen con los mismos bits con los que se persistieron.

---

## Decisión 2: Portfolio de plazos fijos sin restricción UNIQUE

**Decisión:** `portfolio_plazo_fijo` no tiene restricción `UNIQUE (id_portfolio, id_tipo)`. Las tablas de acciones, bonos y letras sí tienen `UNIQUE (id_portfolio, id_instrumento)`.

**Justificación:** acciones, bonos y letras son instrumentos de catálogo identificados por su ticker. Agregar dos veces el mismo instrumento en un portfolio significaría duplicar la misma posición, que es semánticamente incorrecto — corresponde incrementar la `cantidad` existente.

Los plazos fijos son contratos de libre definición: cada fila es un contrato independiente con su propia entidad, TNA y plazo. Es perfectamente válido tener dos plazos fijos en la misma entidad con montos o fechas distintas. Una restricción UNIQUE en `(id_portfolio, entidad)` o `(id_portfolio, id_tipo_plazo_fijo)` rechazaría ese caso legítimo.

---

## Decisión 3: No persistir trayectorias mensuales

**Decisión:** las tablas `trayectoria_paso` y `trayectoria_instrumento_paso` (evolución mensual instrumento por instrumento) no existen en el schema. Solo se persiste el valor final de cada trayectoria y las estadísticas agregadas.

**Justificación — estadísticas completas en JSONB:** la visualización de simulaciones pasadas se resuelve leyendo directamente la tabla `resultado_simulacion`, que persiste las estadísticas completas (media, mediana, p25, p75, mín, máx) como JSONB. El backend no necesita reinvocar al motor para mostrar resultados históricos.

Persistir 1000 trayectorias × 24 meses × N instrumentos generaría volúmenes de datos muy grandes (millones de filas por simulación) sin valor adicional frente a persistir las estadísticas agregadas, que es todo lo que la UI necesita.

La semilla sigue persistiéndose en `simulacion.seed_aleatoria` como registro de auditoría, no como mecanismo de reproducibilidad. El diseño original (RF-16) preveía regenerar trayectorias desde la semilla; esa responsabilidad fue reemplazada por la tabla `resultado_simulacion`.

---

## Decisión 4: Tabla `simulacion_parametro_escenario` — snapshot de rangos de inflación

**Decisión:** se creó la tabla `simulacion_parametro_escenario` que almacena los rangos de inflación `[min, max]` vigentes en el momento de ejecutar cada simulación.

```sql
CREATE TABLE simulacion_parametro_escenario (
    id_simulacion         BIGINT   NOT NULL REFERENCES simulacion(id_simulacion),
    id_tipo_escenario     SMALLINT NOT NULL REFERENCES tipo_escenario(id_tipo_escenario),
    inflacion_mensual_min NUMERIC(10,8) NOT NULL,
    inflacion_mensual_max NUMERIC(10,8) NOT NULL,
    PRIMARY KEY (id_simulacion, id_tipo_escenario)
);
```

**Justificación:** los rangos de inflación pueden actualizarse con el tiempo a medida que cambia el contexto económico. Esta tabla permite mostrarle al usuario, al revisar una simulación pasada, qué se consideró como inflación baja, media y alta en el momento en que la ejecutó — contexto necesario para interpretar correctamente los resultados de cada escenario. Sin el snapshot, esa información se perdería al actualizar `escenario_economico`.

---

## Decisión 5: `simulacion.seed_aleatoria` NOT NULL

**Decisión:** la columna `simulacion.seed_aleatoria` tiene restricción `NOT NULL`.

**Justificación:** el motor siempre genera una semilla (si no la recibe como input, la genera internamente), por lo que no hay escenario válido en que una simulación registrada no tenga semilla. La semilla se persiste como registro de auditoría: permite conocer con qué secuencia aleatoria fue generada cada simulación.

La justificación original de esta restricción (RF-16: poder regenerar trayectorias para visualizar simulaciones pasadas) quedó obsoleta al introducir la tabla `resultado_simulacion`, que persiste las estadísticas completas como JSONB. La visualización de simulaciones históricas no requiere reinvocar al motor.

---

## Decisión 6: Tabla `resultado_simulacion` con estadísticas en JSONB

**Decisión:** se creó la tabla `resultado_simulacion` que almacena las estadísticas temporales completas (media, mediana, p25, p75, mínimo, máximo) como JSONB.

```sql
CREATE TABLE resultado_simulacion (
    id_resultado  BIGSERIAL   PRIMARY KEY,
    id_simulacion BIGINT      NOT NULL REFERENCES simulacion(id_simulacion),
    ambito        VARCHAR(50) NOT NULL,  -- 'portfolio_ars', 'portfolio_usd', o id del instrumento
    escenario     VARCHAR(20) NOT NULL,  -- 'global' | 'favorable' | 'moderado' | 'desfavorable'
    metrica       VARCHAR(30) NOT NULL,  -- 'patrimonio' | 'ganancias_nominales' | 'ganancias_reales'
    stats         JSONB       NOT NULL,  -- { "media":[...], "mediana":[...], "p25":[...], ... }
    UNIQUE (id_simulacion, ambito, escenario, metrica)
);
```

**Justificación:** persiste los arrays de estadísticas temporales del motor para eliminar la necesidad de re-ejecutar el motor cada vez que el usuario visualiza una simulación pasada. Una vez ejecutada la simulación, el backend almacena el output completo del motor en esta tabla; las consultas de visualización posterior leen directamente de PostgreSQL sin invocar al motor de Python.

**Por qué JSONB y no columnas separadas:** los arrays de estadísticas tienen largo variable (`T_meses + 1`). Representarlos en columnas relacionales requeriría una fila por mes por estadístico, lo que generaría tablas muy anchas o muy largas con accesos ineficientes. JSONB almacena el array completo en una sola celda, que PostgreSQL puede indexar y consultar eficientemente. La clave `(id_simulacion, ambito, escenario, metrica)` da acceso directo al vector de estadísticas de cualquier instrumento en cualquier escenario.

---

## Decisión 7: Restricción de instrumentos por perfil de riesgo

**Decisión:** la única restricción que impone el perfil de riesgo sobre los instrumentos es `perfil_riesgo.sigma_max_accion`. Todos los perfiles pueden incluir bonos, letras y plazos fijos sin limitación.

**Justificación:** el riesgo diferencial entre perfiles proviene de la exposición a renta variable, no del tipo de instrumento de renta fija. Un perfil conservador no queda más protegido por prohibirle ciertos bonos — queda protegido limitando la volatilidad de las acciones que puede incorporar. El backend verifica al armar el portfolio que `accion.sigma_volatilidad ≤ perfil.sigma_max_accion`; cualquier acción que supere ese umbral no está disponible para ese perfil.

---

## Decisión 8: Snapshot de instrumentos en `simulacion_instrumento`

**Decisión:** se creó la tabla `simulacion_instrumento` que almacena el JSON exacto enviado al motor para cada instrumento en una simulación.

```sql
CREATE TABLE simulacion_instrumento (
    id                BIGSERIAL    PRIMARY KEY,
    id_simulacion     BIGINT       NOT NULL REFERENCES simulacion(id_simulacion),
    ambito            VARCHAR(50)  NOT NULL,   -- 'accion_1', 'bono_2', 'plazo_fijo_7', etc.
    tipo              VARCHAR(30)  NOT NULL,
    id_accion         BIGINT,
    id_bono           BIGINT,
    id_letra          BIGINT,
    id_portfolio_plazo_fijo BIGINT,
    monto             NUMERIC(20,6) NOT NULL,
    parametros_json   JSONB        NOT NULL    -- el objeto instrumento enviado al motor
);
```

**Justificación:** almacena una copia exacta del objeto que fue enviado al motor, incluyendo `mu`, `sigma`, `rho` para acciones, flujos para bonos y TNA para letras, tal como existían en el momento de la simulación. Esto es necesario porque los parámetros del catálogo cambian con el tiempo (el job de refresco actualiza μ, σ, ρ diariamente). Sin este snapshot, no sería posible saber con qué parámetros exactos se corrió una simulación histórica.

Complementa a `simulacion_parametro_escenario`: ese snapshot captura las condiciones macroeconómicas; este captura las condiciones de cada instrumento.

---

## Decisión 9: Escenarios económicos — valores de referencia en el seed

**Decisión:** los rangos de inflación mensual se definen en el seed de `01_schema.sql` y quedan activos indefinidamente hasta que se inserte una nueva fila con `vigente_hasta` seteado en la fila anterior.

| Escenario | Inflación mensual min | Inflación mensual max | Aprox. anual |
|---|---|---|---|
| `favorable` | 0.01 (1%) | 0.025 (2.5%) | 12%–30% |
| `moderado` | 0.025 (2.5%) | 0.05 (5%) | 30%–60% |
| `desfavorable` | 0.05 (5%) | 0.10 (10%) | 60%–120% |

**Justificación de los rangos:** reflejan el contexto económico argentino al momento del desarrollo del sistema, distinguiendo entre períodos de inflación baja-moderada, media y alta. Los valores se almacenan como `NUMERIC(10,8)` en decimal (no como porcentaje) para ser usados directamente por el motor Python sin transformación.

La tabla `escenario_economico` tiene un diseño de tipo SCD (Slowly Changing Dimension): los rangos históricos se preservan con `vigente_hasta` no null, y la consulta al backend filtra `vigente_hasta IS NULL` para obtener los vigentes. Esto garantiza que el snapshot de cada simulación refleje los rangos de inflación que estaban activos en ese momento.

---

## Decisión 10: Parámetros GBM persistidos en la tabla `accion`

**Decisión:** las columnas `mu_retorno_esperado`, `sigma_volatilidad` y `rho_correlacion_indice` se almacenan directamente en la tabla `accion`.

```sql
mu_retorno_esperado     NUMERIC(14,10),
sigma_volatilidad       NUMERIC(14,10),
rho_correlacion_indice  NUMERIC(8,6) CHECK (rho_correlacion_indice BETWEEN -1 AND 1),
fecha_estimacion_params TIMESTAMPTZ
```

**Justificación:** los parámetros del modelo GBM se estiman a partir de series históricas de precios (tabla `precio_historico_accion`) y se recalculan periódicamente (por ejemplo, una vez por semana). Persistirlos en la tabla `accion` evita recalcularlos en cada simulación, que implicaría procesar hasta 2500 filas de precios históricos por acción para calcular retornos logarítmicos, media y desvío. La columna `fecha_estimacion_params` registra cuándo se estimaron por última vez, permitiendo al sistema saber cuándo corresponde actualizarlos.
