# Portfolio — Modelo de dominio y reglas de negocio

Este documento describe el modelo de datos del portfolio, las reglas que gobiernan su ciclo de vida y las restricciones que el sistema aplica para mantener la consistencia del dominio.

---

## 1. Estructura del portfolio

Un portfolio tiene dos capas:

### 1.1 Cabecera (tabla `portfolio`)

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

### 1.2 Composición (cuatro tablas de tenencias)

La composición es **mutable**: se pueden agregar, modificar y eliminar instrumentos en cualquier momento, siempre que el portfolio esté activo.

| Tabla | Instrumento | Unicidad |
|---|---|---|
| `portfolio_accion` | Acciones del mercado estadounidense | UNIQUE `(id_portfolio, id_accion)` |
| `portfolio_bono` | Bonos soberanos | UNIQUE `(id_portfolio, id_bono)` |
| `portfolio_letra` | Letras del Tesoro (LECAP/LECER) | UNIQUE `(id_portfolio, id_letra)` |
| `portfolio_plazo_fijo` | Plazos fijos (contratos libres) | Sin restricción UNIQUE |

Las mutaciones de tenencias actualizan `portfolio.fecha_modificacion` en la misma transacción de base de datos.

**El horizonte de simulación no es un campo del portfolio.** `horizonte_meses` se pide como parámetro
requerido de cada corrida (`SimularRequest.HorizonteMeses`), no al crear o editar el portfolio — el mismo
portfolio puede simularse con distintos horizontes en distintas corridas. El vencimiento de cada bono/letra
es independiente de ese horizonte; si un instrumento vence después del horizonte elegido, el motor trunca
su valuación en el horizonte en vez de proyectarlo hasta el vencimiento real (ver
`docs/02-orquestador-montecarlo.md`, Decisión 7).

---

## 2. Reglas de unicidad por tipo de instrumento

### Acciones, bonos y letras

Son instrumentos de catálogo identificados por su ticker. Agregar el mismo instrumento dos veces en un portfolio es semánticamente incorrecto: representaría duplicar la posición cuando lo correcto es aumentar la `cantidad` de la fila existente.

Por eso las tablas `portfolio_accion`, `portfolio_bono` y `portfolio_letra` tienen una restricción `UNIQUE (id_portfolio, id_instrumento)`. Un intento de duplicar devuelve `409 Conflict`.

### Plazos fijos

Los plazos fijos son contratos de libre definición. Cada fila es un contrato independiente con su propia entidad bancaria, TNA y plazo. Es perfectamente válido tener dos plazos fijos en el mismo banco con distintos montos o vencimientos. La tabla `portfolio_plazo_fijo` **no tiene restricción UNIQUE**.

Como consecuencia, las tenencias de plazos fijos se identifican en la API por `idPortfolioPlazoFijo` (el ID de la fila de tenencia), no por el tipo de instrumento.

---

## 3. Perfil de riesgo y restricciones de volatilidad

Cada perfil de riesgo tiene un límite de volatilidad (`sigma_max_accion`) que aplica a todas las acciones del portfolio:

| Perfil | `sigma_max_accion` (mensual) |
|---|---|
| Conservador | 0.20 |
| Moderado | 0.50 |
| Agresivo | sin límite |

*(Los valores exactos se definen en el seed de la tabla `perfil_riesgo`.)*

El servicio verifica que `sigma` de la acción ≤ `sigma_max_accion` del perfil en dos momentos:

1. **Al agregar una acción** (`POST /portfolios/{id}/acciones`): si la acción supera el límite → `422 Unprocessable Entity`.
2. **Al cambiar el perfil de riesgo** (`PUT /portfolios/{id}`): si alguna acción existente supera el nuevo `sigma_max_accion` → `422`. El perfil no se actualiza hasta que todas las acciones sean compatibles.

---

## 4. Nombre único por usuario y perfil

El nombre del portfolio debe ser único dentro del mismo usuario y el mismo perfil de riesgo. La combinación `(id_usuario, nombre, id_perfil_riesgo)` no puede repetirse.

Esta regla evita confusión entre portfolios similares pero no impide tener el mismo nombre en distintos perfiles (por ejemplo, "Mi portfolio" conservador y "Mi portfolio" moderado son distintos).

---

## 5. Ownership: aislamiento por usuario

Todas las operaciones sobre portfolios y simulaciones filtran por `id_usuario` extraído del JWT. No existe ningún endpoint que permita al usuario A ver o modificar un portfolio del usuario B. Intentarlo devuelve `404 Not Found` (no `403 Forbidden`) para no revelar la existencia de recursos ajenos.

Este aislamiento se implementa en la capa de repositorios: todas las queries JOIN con la tabla `portfolio` filtrando por `id_usuario`.

---

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

La composición del portfolio puede cambiar después de una simulación. Las corridas son snapshots históricos: registran exactamente con qué composición e inflación se corrió cada simulación. Esto permite consultar el historial de simulaciones aunque el portfolio haya cambiado.

---

## 7. Regla de re-simulación: instrumentos activos

Para ejecutar una nueva simulación, **todos los instrumentos del portfolio deben estar activos y con datos vigentes**:

| Instrumento | Condición de bloqueo |
|---|---|
| Acción | `mu`, `sigma` o `rho` son `null` (el catálogo no tiene GBM estimado) |
| Letra | `fecha_vencimiento <= hoy` |
| Bono | Todos los flujos de caja tienen `fecha_pago <= hoy` |
| Plazo fijo (sin reinversión) | `fecha_inicio + duracion_dias <= hoy` |

Si algún instrumento bloquea la simulación, el endpoint `POST /portfolios/{id}/simular` devuelve `422` con el detalle de cuáles son. El endpoint `GET /portfolios/{id}/simular/preview` permite consultar el estado de cada instrumento antes de intentar simular.

El usuario puede ver el historial de simulaciones pasadas en cualquier momento, independientemente del estado actual de los instrumentos.

---

## 8. Estado del portfolio: ACTIVO y ARCHIVADO

Un portfolio en estado `ARCHIVADO` es de solo lectura: no se pueden agregar, modificar ni eliminar tenencias. Sí se puede consultar el detalle y el historial de simulaciones.

El archivado es reversible: `PUT /portfolios/{id}` con `{ "estado": "ACTIVO" }` lo reactiva.

No existe un mecanismo de archivado automático por vencimiento de instrumentos; es una acción explícita del usuario.
