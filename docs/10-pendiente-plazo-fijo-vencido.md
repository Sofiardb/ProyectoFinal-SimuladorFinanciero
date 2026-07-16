# Pendiente — Plazo fijo vencido: eliminar o renovar en vez de bloquear

> **Estado:** diseño conversado, sin implementar. Punto de partida para la próxima sesión, no una
> decisión de implementación cerrada.

---

## 1. El problema

Plazo fijo no depende de ninguna API externa — la TNA es pactada por el usuario al cargar la tenencia y
nunca queda "desactualizada" en el sentido de `docs/09-staleness-mercado.md`. Su problema es
puramente de fechas: `fecha_vencimiento` se deriva como `fecha_inicio + duracion_dias`.

Hoy, en `SimulacionService.cs` (regla de instrumentos vencidos), si `fecha_inicio + duracion_dias <= hoy`
y `reinvertir_al_vencimiento = false`, la simulación completa se bloquea con `422` — igual que un bono o
letra totalmente vencidos. No hay forma de resolverlo salvo eliminar la tenencia o editarla a mano con una
`fecha_inicio` distinta.

Si `reinvertir_al_vencimiento = true`, esto no bloquea nunca (el motor ya trata la reinversión como
crecimiento compuesto continuo — ver `docs/01-modelos-financieros.md`, sección "Plazo fijo tradicional").

## 2. Lo que NO es este problema

- **No es la misma feature que `docs/09-staleness-mercado.md`.** Esa es sobre datos de mercado
  desactualizados (bonos/letras/acciones); esta es sobre una fecha derivada que ya quedó en el pasado.
- **No es el caso de vencimiento posterior al horizonte.** Ese caso (`fecha_inicio + duracion_dias` en el
  futuro, más allá del horizonte elegido para la simulación) ya funciona correctamente sin cambios — el
  motor trunca la trayectoria en el horizonte igual que con bonos/letras (ver
  `docs/02-orquestador-montecarlo.md`, Decisión 7). Confirmado en esta sesión, no requiere más trabajo.

## 3. Lo que SÍ debería pasar (dirección acordada, con un punto abierto importante)

Cuando `fecha_inicio + duracion_dias <= hoy` y `reinvertir_al_vencimiento = false`, en vez de bloquear la
simulación entera con `422`, el usuario debería poder elegir:

- **Eliminar la tenencia** (camino ya soportado hoy — `EliminarPlazoFijoAsync`).
- **"Renovarla"** — actualizar `fecha_inicio` para que `fecha_inicio + duracion_dias` vuelva a caer en el
  futuro, dejando el instrumento válido para simular de nuevo.

**Punto abierto — qué pasa con el monto al renovar.** Si el depósito ya venció realmente en `fv` (fecha
real de vencimiento), el capital disponible en `fv` no es `monto_invertido` sino `monto_invertido` más
todo el interés devengado durante el plazo original. Renovar solo la fecha sin ajustar el monto
subestimaría el capital real disponible para la nueva colocación. Esto es la misma clase de problema
señalado de forma más general en la discusión de `docs/09`: **el modelo de plazo fijo nunca suma el
interés ya devengado entre la fecha de inicio real y "hoy"** — usa `monto_invertido` tal cual como `V(0)`
en la simulación, incluso cuando ya pasó tiempo real desde `fecha_inicio`. Vale la pena resolver esto como
un fix de cálculo independiente de la decisión eliminar/renovar, porque afecta también a plazos fijos
todavía vigentes (no vencidos) cuya `fecha_inicio` ya quedó en el pasado.

## 4. Dónde investigar

**Backend:**
- `backend/SimuladorFinanciero.Api/Services/SimulacionService.cs` — bloque de "instrumentos vencidos"
  (regla de plazo fijo, ~líneas 69-74) y `MotorPayloadBuilder` (construcción del payload de plazo fijo,
  ~líneas 299-335) — ahí es donde `monto = pf.MontoInvertido` se pasa tal cual sin sumar interés
  devengado.
- `backend/SimuladorFinanciero.Api/Services/PortfolioService.cs` — `ActualizarPlazoFijoAsync`, para ver
  si la "renovación" debería reusar ese mismo camino (edición de tenencia) o necesita uno nuevo.
- `motor-simulacion/app/simulacion/plazo_fijo.py` — confirmar que ningún cambio de fórmula es necesario
  si el ajuste de monto se resuelve en el backend antes de armar el payload (probablemente sí: el motor
  ya recibe `monto` como dato, no necesita saber si incluye interés pre-devengado o no).

## 5. Próximos pasos sugeridos

1. Decidir si el fix de "sumar interés ya devengado" se hace primero, de forma independiente, para todos
   los plazos fijos vigentes (no solo los vencidos) — probablemente conviene resolverlo antes que la
   decisión eliminar/renovar, ya que la renovación depende de ese cálculo para no subestimar el capital.
2. Diseñar el endpoint/flujo de "renovar" (¿reusa `ActualizarPlazoFijoAsync` con una nueva `fecha_inicio`
   calculada por el backend, o el usuario la edita a mano?).
3. Decidir si esta decisión (eliminar vs. renovar) se presenta en el mismo momento que la de
   `docs/09-staleness-mercado.md` (al iniciar una simulación) o en otro punto del flujo — dado
   que ambas terminan resolviéndose en la misma pantalla de "nueva simulación", conviene pensarlas juntas
   a nivel de UX aunque sean features separadas a nivel de backend.
