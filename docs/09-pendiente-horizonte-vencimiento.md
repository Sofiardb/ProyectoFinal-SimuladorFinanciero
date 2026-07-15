# Pendiente — Vencimiento de bonos/letras vs. horizonte de la simulación

> **Estado:** sin investigar / sin implementar. Este documento es el punto de partida para la próxima sesión de trabajo, no una decisión ya tomada sobre el código.

---

## 1. El problema

Un portfolio tiene un `horizonte_meses` (duración de la simulación). Un bono o letra tiene su propia
`fecha_vencimiento`, independiente del horizonte del portfolio. Estas dos fechas pueden no coincidir:

- La letra/bono vence **antes** de que termine el horizonte de la simulación.
- La letra/bono vence **después** de que termine el horizonte de la simulación.

Hoy no sabemos con certeza cómo se comporta el motor en el segundo caso, ni si el primero está
completamente resuelto. Hay que investigarlo antes de decidir si hace falta un cambio.

## 2. Lo que NO es esta regla (decisión ya tomada esta sesión)

- **No es una validación bloqueante.** No se debe impedir agregar un bono/letra a un portfolio,
  ni impedir crear/editar el portfolio, por una diferencia entre `fecha_vencimiento` y `horizonte_meses`
  en cualquier dirección. No hay que tocar `PortfolioService.AgregarBonoAsync`/`AgregarLetraAsync` ni
  `ActualizarPortfolioAsync` para esto.
- **No es la misma regla que ya existe en `docs/07-portfolio-reglas-negocio.md` sección 7** ("Regla de
  re-simulación: instrumentos activos"). Esa regla bloquea la simulación completa con `422` cuando un
  instrumento ya está **totalmente agotado** (`fecha_vencimiento <= hoy` para letras, todos los flujos
  con `fecha_pago <= hoy` para bonos). Esa regla sigue vigente y no cambia. Lo pendiente acá es un caso
  distinto: el instrumento sigue vivo (vence en el futuro), pero su vencimiento cae después del final
  del horizonte simulado.

## 3. Lo que SÍ debería pasar (principio a validar/aplicar)

El motor debe estimar el valor de cada instrumento **solo hasta `min(fecha_vencimiento, hoy + horizonte_meses)`**,
sin asumir ni proyectar qué pasa con ese instrumento después de ese punto (ni un pago al vencimiento
que todavía no ocurrió dentro de la ventana simulada, ni una reinversión hipotética, ni nada).

Ejemplo: una letra vence en el mes 18, el portfolio tiene horizonte de 12 meses → la simulación debe
devolver el valor de esa letra tal como está el mes 12 (devengando su TNA hasta ahí), sin fingir que
llegó a vencimiento.

## 4. Dónde investigar

**Backend (.NET) — construcción del payload del motor:**
- `backend/SimuladorFinanciero.Api/Services/SimulacionService.cs`, clase interna `MotorPayloadBuilder` —
  ahí se calcula `t_venc_meses`/`tVenc` para cada instrumento (letras: `MesesEntre(today, l.FechaVencimiento)`;
  bonos: se derivan de las fechas de los flujos futuros). Ver también el parámetro `tMeses`
  (el horizonte del portfolio) que se recibe en `Build(...)` — confirmar si/cómo se cruza con el
  vencimiento de cada instrumento antes de armar el payload.

**Motor (Python) — simulación por instrumento:**
- `motor-simulacion/app/simulacion/letras.py` — `simular_letra_lecap` recibe `t_venc_meses` como
  parámetro independiente de `T_meses` (el horizonte). Confirmar qué devuelve cuando `t_venc_meses > T_meses`
  y si el resultado es compatible en forma con la matriz de trayectorias del resto del portfolio.
- `motor-simulacion/app/simulacion/bonos.py` — `simular_bono_tasa_fija`/`simular_bono_indexado_vectorizado`
  derivan `t_venc = int(meses.max())` de las fechas de los flujos (vencimiento real del bono), no del
  horizonte. Confirmar cómo `orquestador.py` combina una trayectoria de longitud `t_venc+1` con el resto
  de la matriz, sizeada a `T_meses+1`, cuando `t_venc != T_meses`.
- `motor-simulacion/app/simulacion/orquestador.py` — punto donde se arma `matrices_trayectorias` por
  instrumento y se agregan al portfolio (`_agregar_portfolio`). Ahí es donde un mismatch de forma entre
  instrumentos con distinto `t_venc` se manifestaría (error, broadcasting silencioso incorrecto, o
  truncamiento correcto — hay que confirmar cuál de los tres pasa hoy).

**Contexto adicional ya relevado esta sesión** (no repetir la investigación, ya está resuelta):
- El campo `Cantidad` en `portfolio_bono`/`portfolio_letra` representa lotes de VN100, y
  `monto = Cantidad × PrecioCompra` ya se calcula correctamente en `SimulacionService.cs`.
- Los flujos de bonos (`flujo_bono`) ya se escalan por `Cantidad` al construir el payload
  (`SimulacionService.cs`, corregido en esta sesión) — antes no se escalaban.

## 5. Próximos pasos sugeridos

1. Reproducir el caso concreto: crear un portfolio con horizonte corto (ej. 6 meses) y agregar una letra
   o bono que venza mucho después (ej. 18 meses), correr una simulación y observar el resultado real
   (¿error 500? ¿ignora el instrumento? ¿trunca correctamente? ¿algo más?).
2. Según lo que se observe, decidir si hace falta un cambio en `letras.py`/`bonos.py`/`orquestador.py`
   (truncar explícitamente a `T_meses`) o si el comportamiento actual ya es correcto y solo falta
   documentarlo.
3. Actualizar `docs/01-modelos-financieros.md` y/o `docs/02-orquestador-montecarlo.md` con la conclusión,
   y borrar este archivo una vez resuelto.
