# Plazo fijo vencido: eliminar o renovar en vez de bloquear

> **Estado:** implementado.

---

## 1. El problema

Plazo fijo no depende de ninguna API externa — la TNA es pactada por el usuario al cargar la tenencia y
nunca queda "desactualizada" en el sentido de `docs/09-staleness-mercado.md`. Su problema es
puramente de fechas: `fecha_vencimiento` se deriva como `fecha_inicio + duracion_dias`.

En `SimulacionService.cs` (regla de instrumentos vencidos), si `fecha_inicio + duracion_dias <= hoy`
y `reinvertir_al_vencimiento = false`, la simulación completa se bloquea con `422` — igual que un bono o
letra totalmente vencidos. Esa parte de la regla **no cambió**: sigue siendo la forma correcta de
detener una simulación con datos que ya no representan la realidad. Lo que cambió es que ahora hay una
forma de resolverlo sin salir del flujo de edición de tenencias.

Si `reinvertir_al_vencimiento = true`, esto no bloquea nunca (el motor ya trata la reinversión como
crecimiento compuesto continuo — ver `docs/01-modelos-financieros.md`, sección "Plazo fijo tradicional").

## 2. Por qué no es el mismo patrón que docs/09

`docs/09-staleness-mercado.md` resuelve un problema estructuralmente distinto: una decisión **global de
portfolio** (mantener snapshot vs. actualizar), presentada en una pantalla dedicada ("Vista Comparativa")
porque el prototipo ya la tenía diseñada así y porque una sola decisión binaria para todo el portfolio es
más simple que N decisiones por instrumento.

Eliminar-vs-renovar un plazo fijo vencido no encaja en ese molde: es una decisión **por instrumento** (cada
plazo fijo vencido es independiente — renovar uno no implica nada sobre otro), y el CRUD para resolverla
ya existía en el detalle del portfolio (`PlazoFijoSection.tsx` — editar/eliminar por fila, incluyendo un
date picker que ya impedía elegir una fecha de inicio pasada). Por eso la resolución se implementó **en el
detalle del portfolio, no en una pantalla nueva ni en `NuevaSimulacionPage`**: el mensaje de bloqueo ahí
sigue siendo el mismo que para bono/letra vencidos, y sigue apuntando de vuelta al detalle del portfolio.

## 3. Fix de cálculo: capital devengado antes de vencer

El motor (`simular_plazo_fijo_tradicional` / `simular_plazo_fijo_uva_vectorizado`,
`motor-simulacion/app/simulacion/plazo_fijo.py`) arranca su reloj en `t=0 = hoy` y toma `monto` como
`V(0)` tal cual, sin saber nada de lo que pasó antes de "hoy". Antes de este fix, `MotorPayloadBuilder`
(`SimulacionService.cs`) mandaba `monto = pf.MontoInvertido` sin ajustar — cualquier plazo fijo cuya
`fecha_inicio` ya hubiera quedado en el pasado (algo que ocurre para *todo* depósito, apenas pasa un día
desde que se cargó) subestimaba el capital real disponible, porque ignoraba el interés ya devengado entre
`fecha_inicio` y hoy.

**Fix aplicado** (`MotorPayloadBuilder.Build`, plazo fijo): antes de armar el payload, el monto se
capitaliza mensualmente a la TNA/tasa pactada desde `fecha_inicio` hasta hoy —
`CapitalDevengado(montoInvertido, tasaAnual, mesesTranscurridos)`, misma convención que ya usa el motor
(`r_m = tasa/12`). Sin capping: los plazos fijos vencidos sin reinversión nunca llegan a
`MotorPayloadBuilder` (se bloquean antes, en la validación de instrumentos vencidos), así que todo
instrumento que sí llega ahí está, por construcción, dentro de su plazo original o con reinversión activa
— capitalizar sin tope es correcto en ambos casos. Este mismo `monto` corregido se usa también para el
snapshot de trazabilidad (`InstrumentoSimulacionSnapshot`), consistente con el principio de docs/09 §3.5
de que esa tabla debe reflejar fielmente lo que se usó en cada corrida.

No hizo falta tocar el motor ni la fórmula — es exactamente la misma capitalización mensual que ya hace
`plazo_fijo.py`, solo que aplicada retroactivamente al tramo `fecha_inicio → hoy` antes de invocarlo. Para
UVA, la corrección usa la tasa real pactada de la misma forma (no reconstruye inflación histórica real del
tramo ya transcurrido — igual simplificación que ya reconoce docs/01 para el rezago CER).

Test: `SimulacionServiceTests.MotorPayloadBuilder_PlazoFijoConFechaInicioPasada_SumaInteresDevengadoAlMonto`.

## 4. UI: badge, indicador pasivo y Renovar

Todo esto vive en `PlazoFijoSection.tsx` (detalle del portfolio) — no se tocó `NuevaSimulacionPage.tsx`
más allá de lo que ya existía.

- **Badge "Vencido"** en la fila (`ViewRow`), cuando `esVencido(tenencia)` — antes no había ningún
  indicador visual de esto en ningún lado del frontend; el usuario solo se enteraba por el mensaje
  genérico de bloqueo al intentar simular.
- **Indicador pasivo "Capital hoy"** en filas *no* vencidas cuya `fecha_inicio` ya quedó en el pasado —
  mismo espíritu de transparencia silenciosa que `TipoCambioIndicator` (docs/09 §6.2): no es una decisión,
  es información de cuánto vale hoy el depósito, coherente con el propósito educativo del simulador.
- **Botón "Renovar"** (solo en filas vencidas) — abre un diálogo que muestra el desglose (capital pactado
  + interés devengado durante el plazo original = capital renovado) antes de confirmar, en vez de aplicar
  el número en silencio. Al confirmar, llama al mismo `onUpdate` que ya usa la edición manual (reusa
  `ActualizarPlazoFijoAsync` sin cambios de contrato — **no se agregó ningún endpoint nuevo**), con
  `fechaInicio = hoy` y `montoInvertido = capital devengado hasta el vencimiento original` (capado ahí,
  a diferencia del indicador pasivo). No se ofrece la opción de renovar "sin" el interés — mantener el
  monto original sería fácticamente incorrecto (el capital ya creció), a diferencia de "mantener
  snapshot" en docs/09, que sí es una base de costo histórico legítima.

Helpers nuevos en `frontend/src/lib/plazoFijo.ts` (`mesesEntre`, `fechaVencimiento`, `esVencido`,
`capitalDevengado`, `capitalHoy`, `capitalAlVencimiento`) — misma convención de capitalización mensual que
el backend, reimplementada en el cliente porque el desglose se muestra *antes* de confirmar, sin ida y
vuelta al servidor.

**De paso, fix de formato encontrado al tocar estas filas:** el "Monto" de plazo fijo se mostraba como
`${moneda} ${montoInvertido}` crudo (sin redondear — `monto_invertido` es `NUMERIC(20,6)`), tanto en
`PlazoFijoSection.tsx` como en `plazoFijoPreview` (`lib/tenenciaDisplay.ts`, usado en el resumen de
"Nueva simulación"). Se cambiaron ambos a `formatMoneda`, que ya era el helper usado para el resto de los
montos (Vista Comparativa, el indicador "Capital hoy" nuevo). De paso se auditó todo `.toFixed(` del
frontend: `formatPorcentaje` (TNA, tasas de bono/letra, μ/σ/ρ de Vista Comparativa) redondeaba a 1
decimal, se llevó a 2 para ser consistente con `formatMoneda`. No se tocó el `.toFixed(4)` de μ/σ/ρ en el
panel de admin (`AdminPage.tsx`) — es una vista de diagnóstico para verificar el resultado de un refresh de
catálogo, no un monto de cara al usuario, y redondear esos valores (típicamente decimales chicos, ej.
`0.0234`) a 2 decimales les haría perder la precisión que esa pantalla necesita mostrar.

## 5. Fuera de alcance

- El total "invertido" que muestra `GET /portfolios/{id}/simular/preview` (`MontoOriginal` en
  `InstrumentoPreviewItem`) sigue mostrando `monto_invertido` sin el ajuste de interés devengado — el fix
  de la sección 3 solo toca lo que efectivamente se envía al motor. Extender el ajuste a los totales de
  preview/resumen del portfolio es un problema separado, no bloqueante para esta iteración.
- No se reconstruye inflación histórica real para el tramo `fecha_inicio → hoy` en plazo fijo UVA (ver
  nota en sección 3).
