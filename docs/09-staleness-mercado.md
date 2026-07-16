# Staleness de datos de mercado al simular

Este documento describe cómo el sistema maneja instrumentos cuyo precio o tasa de mercado quedó
desactualizado respecto al catálogo, y por qué se llegó al diseño final — incluyendo un enfoque que se
consideró primero y se descartó al revisar los prototipos de UI ya existentes.

---

## 1. El problema

`precio_compra` (bonos/letras/acciones) es un hecho histórico: lo que el usuario efectivamente pagó. Las
tasas que alimentan al motor (`bono.tasa_descuento`, `letra.tasa`, `accion.mu_retorno_esperado` /
`sigma_volatilidad` / `rho_correlacion_indice`) vienen del catálogo, que se sincroniza mediante refrescos
administrativos manuales (`AdminController.cs` — `refresh/letras`, `refresh/bonos/yields`,
`refresh/bonos/flujos`, `refresh/acciones`; deshabilitados como jobs automáticos en dev por el límite de
requests de las suscripciones actuales).

Antes de esta feature, la única comparación que existía era puramente informativa —
`SimulacionRepository.EstadoPrecio` + `InstrumentoPreviewItem`, expuesta por
`GET /portfolios/{id}/simular/preview` — comparaba `precio_actual` vs. `precio_compra`, no cubría tasa ni
GBM, y no le daba al usuario ninguna decisión real que tomar.

**Tipo de cambio** (cotización USD/ARS) no sigue el mismo mecanismo que esta feature — su staleness se
maneja distinto, ver sección 6.

**No es la misma regla que la de instrumentos vencidos** (`docs/07-portfolio-reglas-negocio.md`, sección
de re-simulación): esa regla bloquea con `422` cuando un instrumento ya agotó todos sus flujos y sigue
vigente sin cambios. Tampoco es el caso de plazo fijo vencido (`docs/10-pendiente-plazo-fijo-vencido.md`)
— plazo fijo no tiene API externa ni tasa que pueda quedar desactualizada, su problema es puramente de
fechas.

---

## 2. Enfoque descartado: override por instrumento, sin persistir

El primer diseño que se planteó calcaba el patrón ya usado con `horizonte_meses`
(`docs/07-portfolio-reglas-negocio.md`, sección 1): "mantener" u "refrescar" sería un parámetro exclusivo
de `SimularRequest`, elegido **por instrumento**, que nunca tocaría la tenencia — cada simulación decide
sus propios parámetros, el portfolio sigue guardando solo el hecho histórico.

Este enfoque tenía sentido en el papel, pero se descartó al revisar `prototipos-UI/` ("Nueva Simulación",
"Vista Comparativa"), que ya tenían esta pantalla diseñada con una mecánica distinta: una **decisión
global del portfolio** (no por instrumento) que **persiste** en la tenencia. Se adoptó el diseño del
prototipo en lugar del propuesto originalmente, por dos razones:

- Es más simple de implementar y de entender para el usuario — una sola decisión por portfolio en vez de
  N decisiones, una por cada instrumento con datos desactualizados.
- Ya estaba diseñado visualmente (breadcrumb, banner de contexto, comparación fila por fila, footer con
  las tres acciones), lo que evitaba inventar una UI nueva para un flujo que en el prototipo original ya
  tenía copy y layout resueltos.

La contrapartida de este cambio es que `precio_compra` deja de ser "un hecho histórico que nunca se
actualiza automáticamente" a secas — ver sección 4.1.

---

## 3. Diseño final

### 3.1 Snapshot de tasa en la tenencia

Antes de esta feature, `portfolio_bono` / `portfolio_letra` / `portfolio_accion` solo persistían
`cantidad` y `precio_compra` — la tasa/GBM se leía siempre en vivo desde el catálogo vía JOIN
(`SimulacionRepository.ObtenerTenenciasParaSimulacionAsync`). Es decir, no existía ningún mecanismo de
"mantener": toda simulación usaba siempre lo último del catálogo.

Se agregó una columna `_compra` por tasa/parámetro GBM, poblada automáticamente con el valor del catálogo
al momento del alta (`AgregarBonoAsync` / `AgregarLetraAsync` / `AgregarAccionAsync`) — igual que ya
ocurre con `precio_compra`:

| Tabla | Columna nueva |
|---|---|
| `portfolio_bono` | `tasa_descuento_compra` |
| `portfolio_letra` | `tasa_compra` |
| `portfolio_accion` | `mu_retorno_esperado_compra`, `sigma_volatilidad_compra`, `rho_correlacion_indice_compra` |

**Por qué no se re-snapshotea al editar la tenencia** (`ActualizarBonoAsync` / etc.): editar solo
`cantidad`/`precio_compra` (por ejemplo, comprar más unidades) no debería cambiar silenciosamente la tasa
de referencia de la posición — eso sería un efecto colateral inesperado de una edición no relacionada. El
snapshot de tasa solo cambia en el alta, o mediante la acción explícita de la sección 3.2.

`ObtenerTenenciasParaSimulacionAsync` pasa a leer siempre estas columnas `_compra` en vez del valor vivo
del catálogo — cambio de comportamiento intencional: toda simulación usa el snapshot de la tenencia salvo
que el usuario haya elegido explícitamente actualizarlo.

### 3.2 Decisión global de portfolio: tres acciones

Al iniciar una simulación nueva (`NuevaSimulacionPage.tsx`), si `GET /simular/preview` indica
`tieneActualizaciones`, aparece un banner con un link "Ver comparación" hacia una pantalla nueva,
**Vista Comparativa** (`ComparacionMercadoPage.tsx`, ruta `/portfolios/:id/comparar-mercado`), que lista
cada instrumento con precio y/o tasa/GBM cambiado (snapshot vs. catálogo actual) y ofrece tres acciones
sobre el portfolio completo:

| Acción | Efecto |
|---|---|
| Mantener como snapshot | No-op. Vuelve a "Nueva simulación" sin tocar nada. |
| Actualizar pero sin simular | `POST /portfolios/{id}/refrescar-mercado`, vuelve al detalle del portfolio. |
| Actualizar y continuar a simular | `POST /portfolios/{id}/refrescar-mercado`, vuelve a "Nueva simulación" (ya sin el banner) para elegir horizonte y lanzar. |

`PortfolioRepository.RefrescarTenenciasMercadoAsync` reescribe, para **todas** las tenencias del
portfolio, `precio_compra` (← `precio_actual` del catálogo) **y** la columna `_compra` de tasa/GBM
correspondiente, en la misma operación. Esto amplía el alcance de "refrescar": ya no es solo la tasa, es
precio + tasa + GBM juntos, como una única foto de "poner el portfolio al día". `precio_compra` pasa a
poder refrescarse — pero únicamente mediante esta acción explícita del usuario, nunca en una escritura
silenciosa.

Como consecuencia, el banner de comparación de precio que existía antes de forma aislada
(`PreviewBanner.tsx`, permanente en `PortfolioDetallePage.tsx`) se eliminó: el comparador
snapshot-vs-mercado (precio + tasa + GBM, unificado) vive únicamente dentro del flujo
"Nueva simulación" → "Vista Comparativa". Nunca aparece como indicador permanente del portfolio.

**El lanzamiento de la simulación sigue siendo un único punto de disparo**: "Vista Comparativa" nunca
llama a `POST /simular` directamente, solo refresca y navega de vuelta a `NuevaSimulacionPage.tsx`, que es
la única pantalla que dispara la corrida.

### 3.3 Preview extendido

`GET /portfolios/{id}/simular/preview` ya comparaba precio (`EstadoPrecio`). Se sumó la misma comparación
para tasa/GBM:

- `InstrumentoPreviewItem` gana `EstadoTasa`, `TasaOriginal`/`TasaMercado` (bono/letra),
  `MuOriginal`/`MuMercado`/`SigmaOriginal`/`SigmaMercado`/`RhoOriginal`/`RhoMercado` (acción).
- `SimulacionPreviewResponse` gana `TieneActualizaciones` (bool, precio y/o tasa) — el frontend lo usa
  para decidir si mostrar el banner de "Ver comparación".

Para acciones, `EstadoTasa` es `"ACTUALIZADO"` si `mu`, `sigma` o `rho` difieren del snapshot más allá de
un umbral (0.1%, mismo criterio que `EstadoPrecio`) — no hay tres flags independientes en el backend; el
frontend decide qué parámetro individual mostrar comparando los valores crudos que ya recibe.

### 3.4 Copy de μ/σ/ρ en Vista Comparativa

Mostrar "μ", "σ", "ρ" crudos no es legible para un usuario sin formación financiera/estadística. Vista
Comparativa usa etiquetas legibles + tooltip (`InfoTooltip`, ya existente en el proyecto) que explican
*por qué* importa el valor, no que "es un parámetro del modelo GBM":

| Parámetro | Etiqueta | Tooltip |
|---|---|---|
| μ | Retorno esperado | Tendencia de retorno mensual observada históricamente para este ticker — hacia dónde tendió a moverse el precio en el pasado. |
| σ | Volatilidad | Cuánto tendió a oscilar el precio históricamente. A mayor volatilidad, mayor el rango de resultados posibles en la simulación. |
| ρ | Correlación con su índice de referencia | Qué tan de la mano se movió este ticker con su índice de referencia en el pasado. |

Además, la sección incluye una aclaración breve: *"Estos valores son una referencia histórica de cómo se
comportó el ticker en el pasado — rendimientos pasados no garantizan resultados futuros."*

### 3.5 Trazabilidad

No hizo falta ninguna infraestructura nueva para saber qué valores se usaron en cada corrida:
`simulacion_instrumento.parametros` (JSONB, ver `docs/03-base-datos.md`) ya serializa exactamente el
objeto enviado al motor por instrumento (`MotorPayloadBuilder`, ver `docs/08-integracion-motor.md`). Como
el valor "vigente" para el motor pasa a ser siempre el snapshot de la tenencia, esta tabla sigue
funcionando sin cambios — cada fila de `simulacion_instrumento` refleja fielmente si esa corrida usó el
snapshot mantenido o el valor recién refrescado.

---

## 4. Fuera de alcance

Los prototipos de "Nueva Simulación" también muestran dos features que no tienen diseño de backend y
quedan fuera de esta iteración, sin stub ni placeholder:

- **Rangos de inflación editables por escenario** (favorable/moderado/desfavorable) por corrida —
  hoy `escenario_economico` es una tabla de configuración global de admin, sin mecanismo de override
  por simulación.
- **Excluir instrumento / extender horizonte** ante un aviso de vencimiento cercano al horizonte elegido
  — hoy esa situación no bloquea (el motor trunca en el horizonte, ver
  `docs/02-orquestador-montecarlo.md`, Decisión 7), por lo que no hay urgencia de UX adicional.

**Tipo de cambio** no sigue este mismo mecanismo (snapshot + Vista Comparativa) — tiene su propia decisión
de diseño e implementación, ver sección 6.

---

## 5. Referencia — archivos tocados

**Backend:**
- `db/01_schema.sql` — columnas `_compra` en `portfolio_bono`/`portfolio_letra`/`portfolio_accion`.
- `Repositories/PortfolioRepository.cs` — snapshot al alta; `RefrescarTenenciasMercadoAsync` (nuevo).
- `Services/PortfolioService.cs` — `RefrescarTenenciasMercadoAsync` (validación ownership + estado activo).
- `Controllers/PortfolioController.cs` — `POST /portfolios/{id}/refrescar-mercado`.
- `Repositories/SimulacionRepository.cs` — `ObtenerTenenciasParaSimulacionAsync` lee snapshot;
  `ObtenerPreviewAsync` extendido con `EstadoTasa`.
- `DTOs/Portfolio/TenenciaResponses.cs`, `DTOs/Simulacion/SimulacionPreviewResponse.cs` — campos nuevos.

**Frontend:**
- `pages/simulaciones/NuevaSimulacionPage.tsx` — construida (antes stub).
- `pages/simulaciones/ComparacionMercadoPage.tsx` — nueva, ruta `/portfolios/:id/comparar-mercado`.
- `components/portfolios/PreviewBanner.tsx` — eliminado.
- `api/hooks/useSimulacion.ts` — `useRefrescarMercado`, `useLanzarSimulacion` (nuevos).

---

## 6. Tipo de cambio — implementado

### 6.1 Por qué no es el mismo mecanismo que tasa/precio

El patrón de la sección 3 (snapshot `_compra` + Vista Comparativa + `RefrescarTenenciasMercadoAsync`)
resuelve staleness para datos que **alimentan al motor de simulación** (tasa, μ/σ/ρ) o que son **el costo
histórico de una tenencia puntual** (`precio_compra`). El tipo de cambio (`tipo_cambio`, cotización
USD/ARS) no encaja en ninguno de los dos casos:

- **No alimenta al motor.** `MotorPayloadBuilder` (`docs/08-integracion-motor.md`) nunca lo usa — el motor
  trabaja `portfolio_ars`/`portfolio_usd` como resultados separados, sin conversión entre sí.
- **No tiene snapshot por portfolio.** Su único uso hoy es `PortfolioService.ValidarPresupuestoAsync`,
  que llama a `ITipoCambioService.ObtenerCotizacionUsdArsAsync` para convertir el total ya invertido a la
  moneda base del portfolio y compararlo contra `capital_inicial`. No existe ni existió nunca un "tipo de
  cambio de referencia congelado en el portfolio" del cual este valor pudiera divergir — a diferencia de
  `precio_compra`/tasa, que sí tenían ese concepto (o se le agregó, en el caso de tasa).
- **Su propio mecanismo de refresco ya es distinto** al de letra/bono/acción. `TipoCambioService.cs`
  cachea por día en `tipo_cambio`: la primera llamada del día dispara una consulta live al BCRA y la
  persiste; llamadas posteriores el mismo día reutilizan ese valor. Si el BCRA falla, cae al último valor
  conocido (que puede ser de días atrás). `RefrescarAsync` (admin) fuerza una consulta live ignorando el
  caché de hoy, pero es un *override* manual, no el único mecanismo — a diferencia de letra/bono/acción,
  donde el refresh de admin es la única forma en que el valor cambia (sin fallback automático diario).

Es decir: la staleness relevante acá no es "¿el portfolio quedó desactualizado respecto al catálogo?"
(no hay tal snapshot), sino "¿el valor cacheado globalmente en `tipo_cambio` está viejo respecto al tipo
de cambio real?" — un problema de una sola variable global, no por-portfolio ni por-instrumento.

### 6.2 Decisión: aplicación silenciosa + timestamp visible

Dado que el tipo de cambio solo participa como guardarraíl de presupuesto (bloquea o permite una compra),
no como insumo analítico de la simulación, quedar desactualizado no cambia ningún resultado simulado —
como mucho corre dónde cae la línea de presupuesto. Eso es un riesgo mucho menor que el de tasa/μ/σ, que si
está vieja cambia directamente el resultado de la corrida Monte Carlo. Construir un flujo paralelo tipo
Vista Comparativa para esto sería una complejidad desproporcionada para el riesgo real.

Se decidió:

- **Seguir aplicando el tipo de cambio en silencio** — `ValidarPresupuestoAsync` sigue usando siempre el
  valor vivo cacheado, sin pedirle al usuario que elija nada.
- **Mostrar de forma visible cuándo se actualizó por última vez**, dondequiera que el tipo de cambio se
  use o se muestre (ej. el formulario de alta de tenencia, el resumen de presupuesto del portfolio) — algo
  como *"TC: $X (actualizado hace N días)"* — para que el usuario tenga conciencia pasiva de la
  antigüedad del dato sin que se le fuerce una decisión.

### 6.3 Cómo se implementó

`ITipoCambioService.ObtenerCotizacionUsdArsAsync` devolvía solo `decimal`. Se cambió su firma a
`Task<(decimal Valor, DateOnly Fecha)>` — cuando la cotización sale del caché del día, `Fecha` es hoy;
cuando sale del fallback (`ITipoCambioRepository.ObtenerUltimaCotizacionAsync`, que también pasó a
devolver `(decimal Valor, DateOnly Fecha)?` en vez de `decimal?`), `Fecha` es la del último registro
persistido. `ValidarPresupuestoAsync` sigue leyendo solo `.Valor` — el comportamiento de validación de
presupuesto no cambió, solo se sumó la fecha al contrato para quien la necesite mostrar.

Se agregó `GET /referencia/tipo-cambio` (`ReferenciaController.cs`) devolviendo `TipoCambioResponse(Valor,
Fecha)`, que expone exactamente ese par sin ningún cálculo adicional.

En el frontend, `TipoCambioIndicator.tsx` (componente nuevo, reusable) consume `useTipoCambio()`
(`api/hooks/useReferencia.ts`) y renderiza *"TC: $X USD/ARS · actualizado {hace N días / ayer / hoy}"*
(`formatDiasDesde`, nuevo helper en `lib/format.ts`). Se ubicó en dos lugares:

- `CreateEditPortfolioDialog.tsx`, junto al campo "Presupuesto" — es donde se define la moneda base y el
  presupuesto que después se convierte contra tenencias en otra moneda.
- `PortfolioDetallePage.tsx`, en el encabezado — solo si el portfolio tiene `capitalInicial` definido (si
  no hay presupuesto, `ValidarPresupuestoAsync` nunca convierte nada, así que no hay nada que mostrar).

No hizo falta tocar schema, motor, `SimulacionRepository` ni `SimulacionService` — el alcance fue
puramente de exposición de un dato que ya existía (`tipo_cambio.fecha`) donde antes no se mostraba.
