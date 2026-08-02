# Base de datos

**Archivo:** `db/01_schema.sql`
**Motor:** PostgreSQL 15
**Schema:** `simulador_financiero`

---

## 1. Tipos de datos numéricos

Las tasas, rendimientos y valores de inflación se almacenan como `NUMERIC(10,8)` expresados en forma decimal — una TNA del 42% se guarda como `0.42000000` — en lugar de tipos de punto flotante. `FLOAT`/`DOUBLE PRECISION` no pueden representar exactamente ciertos valores decimales, lo que acumula error en cálculos financieros repetidos, mientras que `NUMERIC` tiene representación decimal interna exacta y garantiza que los parámetros del motor se recuperen con los mismos bits con los que se persistieron.

Los parámetros del modelo GBM de cada acción se almacenan con precisión acorde a su rol: `mu_retorno_esperado` y `sigma_volatilidad` como `NUMERIC(14,10)`, y `rho_correlacion_indice` como `NUMERIC(8,6)` con la restricción `CHECK (rho_correlacion_indice BETWEEN -1 AND 1)`, reflejando su naturaleza de coeficiente de correlación. Estos parámetros se estiman a partir de series históricas de precios (tabla `precio_historico_accion`) y se recalculan periódicamente; persistirlos en la tabla `accion` junto con `fecha_estimacion_params` evita recalcularlos en cada simulación, lo que implicaría procesar hasta 2500 filas de precios históricos por acción para obtener retornos logarítmicos, media y desvío, y permite al sistema saber cuándo corresponde actualizarlos.

## 2. Modelado de tenencias por tipo de instrumento

Acciones, bonos y letras son instrumentos de catálogo identificados por su ticker, y sus tablas de tenencia (`portfolio_accion`, `portfolio_bono`, `portfolio_letra`) tienen restricción `UNIQUE (id_portfolio, id_instrumento)`: agregar dos veces el mismo instrumento a un portfolio significaría duplicar la misma posición, que es semánticamente incorrecto — corresponde incrementar la `cantidad` existente en su lugar.

`portfolio_plazo_fijo` no tiene esa restricción, porque los plazos fijos son contratos de libre definición: cada fila es un contrato independiente con su propia entidad, TNA y plazo, y es perfectamente válido tener dos plazos fijos en la misma entidad con montos o fechas distintas. Una restricción `UNIQUE` en `(id_portfolio, entidad)` o `(id_portfolio, id_tipo_plazo_fijo)` rechazaría ese caso legítimo.

## 3. Persistencia de resultados de simulación: estadísticas en vez de trayectorias

Las tablas `trayectoria_paso` y `trayectoria_instrumento_paso` — que hubieran almacenado la evolución mensual instrumento por instrumento de cada una de las 1000 trayectorias — no existen en el esquema; solo se persiste el resultado agregado de cada corrida. La visualización de simulaciones pasadas se resuelve leyendo directamente la tabla `resultado_simulacion`, que persiste las estadísticas completas (media, mediana, p25, p75, mínimo, máximo) como JSONB, sin que el backend necesite reinvocar al motor. Persistir 1000 trayectorias × 24 meses × N instrumentos generaría volúmenes de datos muy grandes — millones de filas por simulación — sin valor adicional frente a persistir las estadísticas agregadas, que es todo lo que la interfaz necesita (ver también la sección de estadísticas agregadas en `docs/02-orquestador-montecarlo.md`).

La tabla `resultado_simulacion` guarda un registro por combinación de ámbito, escenario y métrica:

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

Se eligió JSONB en lugar de columnas separadas porque los arrays de estadísticas tienen largo variable (`T_meses + 1`): representarlos en columnas relacionales requeriría una fila por mes por estadístico, generando tablas muy anchas o muy largas con accesos ineficientes. JSONB almacena el array completo en una sola celda, indexable y consultable eficientemente por PostgreSQL, y la clave `(id_simulacion, ambito, escenario, metrica)` da acceso directo al vector de estadísticas de cualquier instrumento en cualquier escenario.

La columna `simulacion.seed_aleatoria` es `NOT NULL`, porque el motor siempre genera una semilla — no hay escenario válido en que una simulación registrada carezca de ella —, pero se persiste únicamente como registro de auditoría, que permite conocer con qué secuencia aleatoria fue generada cada simulación. La justificación original de esta columna (RF-16: poder regenerar trayectorias para visualizar simulaciones pasadas) quedó desplazada al introducir `resultado_simulacion`: la visualización de simulaciones históricas ya no requiere reinvocar al motor (ver la sección sobre generación de aleatoriedad y semilla en `docs/02-orquestador-montecarlo.md`).

## 4. Snapshots para reproducibilidad de auditoría

Aunque las trayectorias ya no se regeneran, dos tablas preservan el contexto exacto con el que se ejecutó cada simulación, de modo que sus resultados sigan siendo interpretables aun cuando los datos de referencia cambien con el tiempo.

`simulacion_parametro_escenario` almacena los rangos de inflación `[min, max]` vigentes en el momento de ejecutar cada simulación:

```sql
CREATE TABLE simulacion_parametro_escenario (
    id_simulacion         BIGINT   NOT NULL REFERENCES simulacion(id_simulacion),
    id_tipo_escenario     SMALLINT NOT NULL REFERENCES tipo_escenario(id_tipo_escenario),
    inflacion_mensual_min NUMERIC(10,8) NOT NULL,
    inflacion_mensual_max NUMERIC(10,8) NOT NULL,
    PRIMARY KEY (id_simulacion, id_tipo_escenario)
);
```

Los rangos de inflación pueden actualizarse con el tiempo a medida que cambia el contexto económico; esta tabla permite mostrarle al usuario, al revisar una simulación pasada, qué se consideró como inflación baja, media y alta en el momento en que la ejecutó — contexto necesario para interpretar correctamente los resultados de cada escenario. Sin el snapshot, esa información se perdería al actualizar `escenario_economico`.

`simulacion_instrumento` cumple el mismo rol para los instrumentos: almacena el JSON exacto enviado al motor para cada instrumento de la simulación, incluyendo `mu`, `sigma`, `rho` para acciones, flujos para bonos y TNA para letras, tal como existían en ese momento.

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

Esto es necesario porque los parámetros del catálogo cambian con el tiempo — el job de refresco actualiza μ, σ, ρ diariamente —; sin este snapshot no sería posible saber con qué parámetros exactos se corrió una simulación histórica. `simulacion_parametro_escenario` captura las condiciones macroeconómicas de la corrida y `simulacion_instrumento` captura las condiciones de cada instrumento; entre ambas reconstruyen el contexto completo bajo el cual se generó cualquier resultado pasado.

## 5. Perfiles de riesgo y restricción de instrumentos

La única restricción que impone el perfil de riesgo sobre los instrumentos es `perfil_riesgo.sigma_max_accion`; todos los perfiles pueden incluir bonos, letras y plazos fijos sin limitación. El riesgo diferencial entre perfiles proviene de la exposición a renta variable, no del tipo de instrumento de renta fija: un perfil conservador no queda más protegido por prohibirle ciertos bonos, sino limitando la volatilidad de las acciones que puede incorporar. El backend verifica al armar el portfolio que `accion.sigma_volatilidad ≤ perfil.sigma_max_accion`; cualquier acción que supere ese umbral no está disponible para ese perfil.

## 6. Escenarios económicos: valores de referencia y vigencia histórica

Los rangos de inflación mensual por escenario se cargan como seed en `01_schema.sql` y reflejan el contexto económico argentino al momento del desarrollo del sistema:

| Escenario | Inflación mensual min | Inflación mensual max | Aprox. anual |
|---|---|---|---|
| `favorable` | 0.01 (1%) | 0.025 (2.5%) | 12%–30% |
| `moderado` | 0.025 (2.5%) | 0.05 (5%) | 30%–60% |
| `desfavorable` | 0.05 (5%) | 0.10 (10%) | 60%–120% |

Los valores se almacenan en decimal (no como porcentaje), listos para ser usados directamente por el motor Python sin transformación. La tabla `escenario_economico` sigue un diseño de tipo Slowly Changing Dimension: los rangos históricos se preservan con `vigente_hasta` no nulo, y la consulta del backend filtra `vigente_hasta IS NULL` para obtener los vigentes. Esto garantiza que el snapshot de cada simulación (sección 4) refleje los rangos de inflación que estaban activos en el momento en que se ejecutó, incluso si `escenario_economico` se actualiza después.
