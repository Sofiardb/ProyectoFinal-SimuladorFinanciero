# Portfolio — Modelo de dominio y reglas de negocio

Este documento describe el modelo de datos del portfolio, las reglas que gobiernan su ciclo de vida y las restricciones que el sistema aplica para mantener la consistencia del dominio.

---

## 1. Estructura del portfolio

Un portfolio tiene dos capas: una cabecera (tabla `portfolio`) y su composición (cuatro tablas de tenencias).

La cabecera guarda la identidad y configuración del portfolio:

| Campo | Tipo | Descripción |
|---|---|---|
| `id_portfolio` | BIGSERIAL | Identificador único |
| `id_usuario` | BIGINT | Propietario — todas las operaciones filtran por este campo |
| `nombre` | VARCHAR(100) | Nombre descriptivo del portfolio |
| `descripcion` | VARCHAR(500) | Descripción opcional |
| `id_perfil_riesgo` | SMALLINT | Perfil de riesgo asociado (conservador / moderado / agresivo) |
| `id_moneda_base` | SMALLINT | Moneda base del portfolio (ARS, USD) |
| `capital_inicial` | NUMERIC | Capital total del portfolio al momento de la creación |
| `estado` | VARCHAR | `ACTIVO` o `ARCHIVADO` |
| `fecha_creacion` | TIMESTAMPTZ | Fecha de creación (inmutable) |
| `fecha_modificacion` | TIMESTAMPTZ | Última modificación (actualizado por cada mutación de tenencia) |

La composición es mutable — se pueden agregar, modificar y eliminar instrumentos en cualquier momento mientras el portfolio esté activo — y vive en cuatro tablas, una por tipo de instrumento:

| Tabla | Instrumento | Unicidad |
|---|---|---|
| `portfolio_accion` | Acciones del mercado estadounidense | UNIQUE `(id_portfolio, id_accion)` |
| `portfolio_bono` | Bonos soberanos | UNIQUE `(id_portfolio, id_bono)` |
| `portfolio_letra` | Letras del Tesoro (LECAP/LECER) | UNIQUE `(id_portfolio, id_letra)` |
| `portfolio_plazo_fijo` | Plazos fijos (contratos libres) | Sin restricción UNIQUE |

Las mutaciones de tenencias actualizan `portfolio.fecha_modificacion` en la misma transacción de base de datos.

El horizonte de simulación no es un campo del portfolio: `horizonte_meses` se pide como parámetro requerido de cada corrida (`SimularRequest.HorizonteMeses`), no al crear o editar el portfolio, de modo que el mismo portfolio puede simularse con distintos horizontes en distintas corridas. El vencimiento de cada bono o letra es independiente de ese horizonte; si un instrumento vence después del horizonte elegido, el motor trunca su valuación en el horizonte en vez de proyectarlo hasta el vencimiento real (ver la sección sobre tratamiento de vencimientos fuera del horizonte en `docs/02-orquestador-montecarlo.md`).

## 2. Reglas de unicidad por tipo de instrumento

Acciones, bonos y letras son instrumentos de catálogo identificados por su ticker, y agregar el mismo instrumento dos veces en un portfolio es semánticamente incorrecto: representaría duplicar la posición cuando lo correcto es aumentar la `cantidad` de la fila existente. Por eso las tablas `portfolio_accion`, `portfolio_bono` y `portfolio_letra` tienen restricción `UNIQUE (id_portfolio, id_instrumento)`, y un intento de duplicar devuelve `409 Conflict`.

Los plazos fijos, en cambio, son contratos de libre definición: cada fila es un contrato independiente con su propia entidad bancaria, TNA y plazo, y es perfectamente válido tener dos plazos fijos en el mismo banco con distintos montos o vencimientos. La tabla `portfolio_plazo_fijo` no tiene restricción UNIQUE, y sus tenencias se identifican en la API por `idPortfolioPlazoFijo` (el ID de la fila de tenencia) en lugar del tipo de instrumento.

## 3. Perfil de riesgo y restricciones de volatilidad

Cada perfil de riesgo tiene un límite de volatilidad mensual (`sigma_max_accion`) que aplica a todas las acciones del portfolio, definido en el seed de la tabla `perfil_riesgo`:

| Perfil | `sigma_max_accion` (mensual) |
|---|---|
| Conservador | 0.20 |
| Moderado | 0.50 |
| Agresivo | sin límite |

El servicio verifica que la `sigma` de la acción no supere `sigma_max_accion` del perfil en dos momentos: al agregar una acción (`POST /portfolios/{id}/acciones`), donde una acción que exceda el límite devuelve `422 Unprocessable Entity`; y al cambiar el perfil de riesgo del portfolio (`PUT /portfolios/{id}`), donde si alguna acción existente supera el nuevo `sigma_max_accion` también se devuelve `422` y el perfil no se actualiza hasta que todas las acciones sean compatibles.

## 4. Nombre único por usuario y perfil

El nombre del portfolio debe ser único dentro del mismo usuario y el mismo perfil de riesgo: la combinación `(id_usuario, nombre, id_perfil_riesgo)` no puede repetirse. Esta regla evita confusión entre portfolios similares, sin impedir el mismo nombre en distintos perfiles — "Mi portfolio" conservador y "Mi portfolio" moderado son portfolios distintos y válidos.

## 5. Ownership: aislamiento por usuario

Todas las operaciones sobre portfolios y simulaciones filtran por `id_usuario`, extraído del JWT; no existe ningún endpoint que permita al usuario A ver o modificar un portfolio del usuario B. Intentarlo devuelve `404 Not Found`, no `403 Forbidden`, para no revelar la existencia de recursos ajenos. Este aislamiento se implementa en la capa de repositorios: todas las queries hacen JOIN con la tabla `portfolio` filtrando por `id_usuario`.

## 6. Separación entre composición y corridas de simulación

```
portfolio (cabecera)          ← mutable
├── portfolio_accion
├── portfolio_bono
├── portfolio_letra
└── portfolio_plazo_fijo

simulacion (cabecera)         ← inmutable tras la ejecución
├── simulacion_parametro_escenario  ← snapshot de inflación por escenario
├── simulacion_instrumento          ← snapshot de cada instrumento en el momento de la corrida
└── resultado_simulacion            ← stats JSONB (nunca se modifican)
```

La composición del portfolio puede cambiar después de una simulación, pero las corridas son snapshots históricos: registran exactamente con qué composición e inflación se corrió cada simulación (ver la sección de snapshots para auditoría en `docs/03-base-datos.md`), lo que permite consultar el historial de simulaciones aunque el portfolio haya cambiado desde entonces.

## 7. Regla de re-simulación: instrumentos activos

Para ejecutar una nueva simulación, todos los instrumentos del portfolio deben estar activos y con datos vigentes:

| Instrumento | Condición de bloqueo |
|---|---|
| Acción | `mu`, `sigma` o `rho` son `null` (el catálogo no tiene GBM estimado) |
| Letra | `fecha_vencimiento <= hoy` |
| Bono | Todos los flujos de caja tienen `fecha_pago <= hoy` |
| Plazo fijo (sin reinversión) | `fecha_inicio + duracion_dias <= hoy` |

Si algún instrumento bloquea la simulación, el endpoint `POST /portfolios/{id}/simular` devuelve `422` con el detalle de cuáles son; el endpoint `GET /portfolios/{id}/simular/preview` permite consultar el estado de cada instrumento antes de intentar simular. El usuario puede ver el historial de simulaciones pasadas en cualquier momento, independientemente del estado actual de los instrumentos.

## 8. Estado del portfolio: ACTIVO y ARCHIVADO

Un portfolio en estado `ARCHIVADO` es de solo lectura: no se pueden agregar, modificar ni eliminar tenencias, aunque sí se puede consultar el detalle y el historial de simulaciones. El archivado es reversible mediante `PUT /portfolios/{id}` con `{ "estado": "ACTIVO" }`. No existe un mecanismo de archivado automático por vencimiento de instrumentos: es siempre una acción explícita del usuario.

## 9. Comparación entre portfolios: sin restricción por perfil de riesgo

RF-08 especifica "comparar visualmente dos o más portfolios dentro del mismo perfil de riesgo", pero `CompararPage` en el frontend no impone esa restricción — `SelectorSimulacion` permite elegir cualquier par de simulaciones del usuario, sin filtrar ni validar que pertenezcan al mismo perfil. El alcance de RF-08 se amplió deliberadamente para permitir comparar portfolios de perfiles de riesgo distintos (por ejemplo, un portfolio Conservador contra uno Agresivo), y no solo portfolios del mismo perfil, porque limitar la comparación al mismo perfil excluiría el caso de uso de contrastar composiciones de riesgo diferentes sobre montos de capital comparables — precisamente el tipo de análisis que necesita un usuario evaluando qué perfil adoptar. La restricción original habría sido más una limitación técnica heredada del enunciado que una regla de negocio necesaria.
