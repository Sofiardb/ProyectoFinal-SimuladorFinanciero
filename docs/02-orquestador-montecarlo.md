# Orquestador Monte Carlo

**Archivo:** `motor-simulacion/app/simulacion/orquestador.py`
**Función principal:** `simular_portfolio(parametros: dict) -> dict`
**Tests:** `motor-simulacion/tests/test_orquestador.py`

---

## 1. Propósito y alcance

El orquestador es el módulo central del motor de simulación: es el único componente que genera aleatoriedad (a través de `numpy.random.default_rng`), conoce la composición completa del portfolio (todos los instrumentos simultáneamente), aplica los escenarios macroeconómicos, agrega las trayectorias individuales en la trayectoria del portfolio y calcula las estadísticas finales.

Las funciones de instrumento (`simular_accion_vectorizado`, `simular_bono_tasa_fija`, etc., documentadas en `docs/01-modelos-financieros.md`) son puras: reciben sus inputs y devuelven una trayectoria, sin conocer el contexto del portfolio ni generar aleatoriedad propia. El orquestador actúa como director de la simulación; cada función de instrumento resuelve un cálculo puntual.

## 2. Flujo de ejecución

```
parametros (dict)
    │
    ▼
[1] Extraer T_meses, escenarios, instrumentos
[2] Resolver semilla → crear RNG determinístico
[3] Pre-generar TODA la aleatoriedad:
        inflacion      (N, T) — Uniform por escenario
        z_indice       (N, T) — N(0,1) shock de mercado
        z_propios      {id: (N, T)} — N(0,1) por acción
        factor_acum_matrix (N, T+1) — inflación acumulada
[4] Para cada instrumento:
        → construir z_accion (solo acciones)
        → llamar función vectorizada del instrumento
        → padding si t_venc < T
        → guardar en matrices_trayectorias[id]
[5] Agregar matrices → matriz_ars, matriz_usd
[6] Calcular estadísticas por escenario
[7] Retornar dict con semilla + stats por instrumento + stats de portfolios
```

## 3. Generación de aleatoriedad: semilla y pre-generación upfront

El motor resuelve la semilla al inicio de cada corrida y construye a partir de ella un único generador aleatorio (`rng = np.random.default_rng(semilla)`) que gobierna toda la simulación:

```python
semilla = int(np.random.default_rng().integers(0, 2**31))
rng = np.random.default_rng(semilla)
```

El motor siempre genera su propia semilla y la retorna en el output; no lee ninguna semilla del payload de entrada, aunque el backend envíe una (`MotorPayloadBuilder` arma un campo `"semilla"` en el request por compatibilidad con el contrato original, pero el motor lo ignora). El diseño inicial preveía que la reproducibilidad de simulaciones pasadas se lograra regenerando las trayectorias desde la semilla almacenada (`simulacion.seed_aleatoria`), invocando al motor con `"semilla": <seed guardada>` para obtener resultados idénticos. Esa vía quedó obsoleta cuando se decidió persistir las estadísticas completas en `resultado_simulacion` como JSONB: el backend lee esa tabla directamente para visualizar simulaciones pasadas y no necesita reinvocar al motor, por lo que el soporte de semilla entrante se simplificó y se quitó del código. La semilla se sigue persistiendo en la base de datos como registro de auditoría — permite saber con qué secuencia aleatoria se generó cada simulación — pero no es el mecanismo de reproducibilidad principal ni un input funcional del motor.

La semilla se mantiene en rango `int32` (`2**31`) pese a que `numpy.random.default_rng` acepta enteros de hasta 128 bits, para evitar conversiones o truncamientos frente a la columna `BIGINT` de PostgreSQL y el tipo `long` de .NET. Se usa `default_rng` en vez de `np.random.seed` porque el primero crea un generador con estado local, sin modificar estado global: `np.random.seed` interferiría entre requests simultáneos al motor, ya que Flask puede atender varias solicitudes en paralelo.

Toda la aleatoriedad de la corrida (inflación, shocks de mercado, shocks idiosincráticos) se genera en una única pasada, antes del loop principal de instrumentos, por tres razones. Primero, estabilidad de la reproducibilidad ante cambios en el portfolio: la semilla controla el estado interno del RNG de forma secuencial, y si la generación estuviera intercalada con la lógica de cada instrumento, agregar o quitar un instrumento alteraría los números aleatorios de los instrumentos restantes. Generando upfront y por tipo de variable, agregar un instrumento solo agrega columnas nuevas al final de `z_propios`, sin tocar los números ya generados para los demás. Segundo, rendimiento: `rng.standard_normal((3000, T))` produce 3000×T valores en una sola llamada a código C compilado, mientras que el equivalente con un loop Python haría 3000×T llamadas al intérprete. Tercero, claridad estructural: queda explícito qué variables están determinadas por azar (generadas antes del loop) y cuáles son calculadas (derivadas durante el loop), lo que facilita la lectura y el debugging.

## 4. Estratificación por escenario

Las 3000 simulaciones por defecto (`RNF-01`) se reparten en tres grupos iguales:

```python
N_SIMULACIONES = 3000
n_favorable    = N_SIMULACIONES // 3        # 1000
n_moderado     = N_SIMULACIONES // 3        # 1000
n_desfavorable = N_SIMULACIONES - n_favorable - n_moderado  # 1000
```

Si `N` no es divisible por 3, el sobrante se asigna a `n_desfavorable`, el escenario de mayor riesgo — sobredimensionar el escenario adverso es preferible desde el punto de vista del análisis de riesgo. Con el valor por defecto actual la división es exacta (1000/1000/1000) y esta regla no entra en juego, pero sigue siendo relevante si `N_SIMULACIONES` cambia a un valor no múltiplo de 3.

Los grupos se ordenan de forma contigua — primero todas las favorables, luego las moderadas, luego las desfavorables — en vez de intercalados, porque simplifica la extracción de estadísticas por escenario a un slice contiguo sobre el eje 0 de la matriz, la operación más eficiente que ofrece NumPy para este propósito (sin reindexado ni máscaras booleanas):

```python
corte_favorable    = slice(0, n_favorable)
corte_moderado     = slice(n_favorable, n_favorable + n_moderado)
corte_desfavorable = slice(n_favorable + n_moderado, N_SIMULACIONES)
```

## 5. Modelo de inflación

Para cada simulación y cada mes, la inflación mensual se sortea de forma independiente de una distribución uniforme en el rango `[min, max]` que define el escenario correspondiente:

```python
inflacion = np.vstack([
    rng.uniform(esc_favorable["inflacion_mensual_min"],
                esc_favorable["inflacion_mensual_max"],
                (n_favorable, T_meses)),
    rng.uniform(esc_moderado["inflacion_mensual_min"],
                esc_moderado["inflacion_mensual_max"],
                (n_moderado, T_meses)),
    rng.uniform(esc_desfavorable["inflacion_mensual_min"],
                esc_desfavorable["inflacion_mensual_max"],
                (n_desfavorable, T_meses)),
])
```

Se eligió la distribución uniforme porque la propuesta especifica que los escenarios definen rangos `[min, max]` de inflación mensual, y la uniforme es la más conservadora: asigna igual probabilidad a cualquier valor dentro del rango, sin suponer una forma particular de la distribución real de inflación. Alternativas más precisas (Normal truncada, Beta) requerirían calibrar parámetros adicionales sin datos suficientes para justificarlos en el contexto del trabajo final.

No se modela autocorrelación entre meses: es una simplificación explícita, ya que introducirla requeriría un proceso AR(1) o ARIMA, fuera del alcance definido en la propuesta. Tampoco se modela correlación entre la inflación argentina y el mercado estadounidense: los shocks `z_indice` y `z_propios` son completamente independientes del escenario de inflación, de modo que una simulación "favorable" (inflación 2–3%) puede tener retornos bursátiles negativos, y viceversa.

## 6. Modelo de mercado: índice único y correlación por factor

El motor genera un único shock de mercado `z_indice`, que representa al S&P 500. El campo `"mercado"` existe en la estructura de cada instrumento para extensiones futuras, pero hoy todas las acciones usan el mismo `z_indice`. La versión original contemplaba dos índices — `z_indice_arg` (MERVAL) y `z_indice_usd` (S&P 500) —, pero se eliminó el primero porque el universo de acciones del simulador se limita al S&P 500 (`SR-01`): la disponibilidad de datos históricos con profundidad y calidad suficiente para estimar `μ`, `σ` y `ρ` existe de forma confiable solo para el índice americano.

El shock de cada acción se construye como combinación lineal del shock sistemático (compartido, el índice de mercado) y el shock idiosincrático (exclusivo de la acción):

```python
z_accion = rho * z_indice + np.sqrt(1 - rho**2) * z_propio
```

Si `Z_indice ~ N(0,1)` y `Z_propio ~ N(0,1)` son independientes, `Z_accion = ρ·Z_indice + √(1-ρ²)·Z_propio` cumple que `Z_accion ~ N(0,1)` (la distribución del shock es estándar), `Corr(Z_accion, Z_indice) = ρ` (correlación exacta con el índice), y para dos acciones A y B, `Corr(Z_A, Z_B) = ρ_A · ρ_B` (la correlación entre acciones se deriva del índice compartido). En términos de portfolio, esto implica que acciones con `ρ` alto (≈1) se mueven muy correlacionadas entre sí y con el mercado — el riesgo no se reduce al combinarlas —, mientras que acciones con `ρ` bajo (≈0) tienen comportamiento casi independiente y aportan diversificación real.

Se descartó modelar correlaciones mediante descomposición de Cholesky sobre una matriz de correlaciones `N×N` entre acciones. El modelo de factor único es una aproximación de primer orden ampliamente usada en la práctica (es la base del CAPM) que captura la mayor parte de la varianza con un solo parámetro por acción (`ρ`), estimable directamente de datos históricos, sin necesidad de construir ni invertir la matriz completa.

## 7. Tratamiento de vencimientos fuera del horizonte de simulación

Letras y bonos devuelven trayectorias de largo `t_venc + 1`, calculado contra el vencimiento **real** del instrumento — independiente del horizonte de simulación `T`, que se elige por simulación y no al armar el portfolio (ver `docs/07-portfolio-reglas-negocio.md`). El vencimiento real puede caer antes o después de `T`, y el orquestador ajusta la trayectoria en ambos casos:

```python
if len(trayectoria) > T_meses + 1:
    trayectoria = trayectoria[:T_meses + 1]
elif len(trayectoria) < T_meses + 1:
    trayectoria = trayectoria + [trayectoria[-1]] * (T_meses + 1 - len(trayectoria))
```

Cuando el instrumento vence antes de `T` (`t_venc < T`), se repite el último valor (`V(t_venc)`) desde `t_venc + 1` hasta `T_meses`: el capital cobrado al vencimiento queda disponible como efectivo para el resto del período, sin rendimiento adicional. Cuando vence después (`t_venc > T`), la trayectoria se trunca a `T_meses + 1`: el motor sigue calculando la valuación contra el vencimiento real (para descontar correctamente cuánto falta), pero solo emite los valores hasta `T`, sin proyectar el instrumento como si hubiera llegado a vencimiento. Para los instrumentos indexados por CER (`lecer`, `bono_indexado`) el truncado es además necesario estructuralmente, porque `factor_cer_matrix` solo contiene inflación simulada hasta `T_meses + 1`.

En ambos casos, la decisión responde al mismo criterio: la reinversión al vencimiento implicaría elegir en qué instrumento reinvertir y a qué condiciones, y proyectar más allá del horizonte implicaría asumir que el instrumento efectivamente llega a cobrarse — ambas son decisiones del usuario, no del simulador. El simulador muestra qué pasó con el capital invertido en los instrumentos elegidos, tal como están, hasta el horizonte elegido, ni más allá ni asumiendo qué pasa después. Se descartó modelar el cash post-vencimiento como un plazo fijo a tasa de referencia del mercado, porque requeriría un parámetro adicional (tasa vigente en el período de reinversión) y haría implícita una decisión financiera que debería ser explícita del usuario.

## 8. Estadísticas agregadas por escenario

```python
def calcular_estadisticas(matriz):
    p25, p50, p75 = np.percentile(matriz, [25, 50, 75], axis=0)
    return {
        "media":   np.mean(matriz, axis=0).tolist(),
        "mediana": p50.tolist(),
        "p25":     p25.tolist(),
        "p75":     p75.tolist(),
        "minimo":  np.min(matriz, axis=0).tolist(),
        "maximo":  np.max(matriz, axis=0).tolist(),
    }
```

Por cada instrumento y cada portfolio, el motor calcula media, mediana (p50), p25, p75, mínimo y máximo en cuatro vistas: global, favorable, moderado y desfavorable. Los cuartiles se calculan en una sola llamada (`np.percentile(matriz, [25, 50, 75])`, una única pasada sobre la matriz en vez de tres) porque, junto con mínimo y máximo, forman el resumen de cinco números necesario para construir los gráficos definidos, y cubren los modos de visualización del frontend. Se descartaron percentiles extremos (p5/p95) porque los box-whisker usan cuartiles por convención y p25–p75 ya comunica la dispersión central de forma reconocible. La vista `global` es la estadística sobre las 3000 simulaciones completas, sin condicionar por escenario — no es el promedio de los tres escenarios, sino la estadística sobre la totalidad de las trayectorias — y permite ver el comportamiento marginal del instrumento antes de filtrar.

RF-06 especifica que el sistema debe "ejecutar simulaciones Monte Carlo estratificadas por escenario y devolver las trayectorias generadas". El orquestador calcula las matrices `(3000, T+1)` completas por instrumento y por portfolio, pero no las serializa en el output: se descartan una vez calculadas las estadísticas anteriores. La tabla `trayectoria` existe en el esquema (`db/01_schema.sql`) pero no se usa — no hay ningún `INSERT` sobre ella en el backend. Se optó por exponer solo el resumen estadístico por mes en lugar de las 3000 trayectorias individuales por costo-beneficio: para un usuario que se está iniciando en inversión, los valores agregados (mediana, banda p25–p75) tienen un significado directo e interpretable, mientras que 3000 líneas superpuestas generan ruido visual que oscurece la señal en vez de aportar información adicional a la ya resumida en los percentiles; y devolver `3000 × T` valores por instrumento multiplicaría el tamaño de la respuesta y el trabajo de renderizado en el frontend en varios órdenes de magnitud, sin una ganancia proporcional de utilidad. La interpretación de RF-06 se ajustó, en consecuencia, de "devolver las trayectorias generadas" a "devolver el resultado agregado derivado de las trayectorias generadas": el motor sí genera y usa las 3000 trayectorias por escenario, pero el contrato de salida expone su resumen estadístico en lugar de los datos crudos.

## 9. Separación de portfolios por moneda

Cada instrumento se clasifica como ARS o USD — los instrumentos USD son acciones con `mercado = "usd"`; todos los demás (letras, bonos, plazos fijos) son ARS —, se agrega por separado, y el motor retorna dos sub-portfolios (`portfolio_ars`, `portfolio_usd`) en vez de uno combinado. Combinar instrumentos ARS y USD en un único portfolio requeriría proyectar el tipo de cambio durante `T` meses: usar el tipo de cambio spot actual sería inverosímil para horizontes de 12 a 24 meses, y modelarlo como proceso estocástico separado excede el alcance de la propuesta (`SR-02`, `SR-03`). Cada sub-portfolio se interpreta y visualiza en su propia moneda. Si el portfolio no tiene acciones USD, `insts_usd` es una lista vacía y la función retorna una matriz de ceros; el frontend oculta el panel USD cuando el valor inicial es cero.

## 10. Ganancias nominales y reales

Además del patrimonio `V(t)`, el output incluye ganancias nominales y ganancias reales por instrumento y por portfolio:

```python
factor_acum_matrix = np.ones((N_SIMULACIONES, T_meses + 1))
factor_acum_matrix[:, 1:] = np.cumprod(1 + inflacion, axis=1)

gan_nominal_i = matriz_i - monto_i
gan_real_i    = matriz_i / factor_acum_matrix - monto_i
```

La ganancia nominal (`V(t) − monto`) indica cuántos pesos adicionales tiene el inversor respecto a lo invertido, y puede ser positiva aunque el instrumento haya perdido poder adquisitivo — un plazo fijo tradicional en escenario desfavorable gana nominalmente pero pierde en términos reales. La ganancia real (`V(t) / factor_acum(t) − monto`) deflacta el patrimonio por la inflación acumulada de esa trayectoria, convirtiendo a pesos de `t=0`, y responde si el inversor ganó o perdió poder adquisitivo: es la métrica que permite comparar de forma justa instrumentos indexados frente a no indexados. Se cumple el invariante `ganancia_real < ganancia_nominal` para `t > 0` con inflación positiva, verificado explícitamente por el test `test_ganancias_reales_menores_que_nominales`.

## 11. Estructura del output

```json
{
  "semilla": 182736451,
  "inflacion_acumulada": {
    "global":       { "media": [...], "mediana": [...], "p25": [...], "p75": [...], "minimo": [...], "maximo": [...] },
    "favorable":    { ... },
    "moderado":     { ... },
    "desfavorable": { ... }
  },
  "instrumentos": {
    "lecap_1": {
      "patrimonio":          { "global": {...}, "favorable": {...}, "moderado": {...}, "desfavorable": {...} },
      "ganancias_nominales": { "global": {...}, ... },
      "ganancias_reales":    { "global": {...}, ... }
    }
  },
  "portfolio_ars": {
    "patrimonio":          { "global": {...}, ... },
    "ganancias_nominales": { ... },
    "ganancias_reales":    { ... }
  },
  "portfolio_usd": { ... }
}
```

La jerarquía va de métrica a escenario, y no al revés, porque permite al frontend cambiar entre "vista de patrimonio" y "vista de ganancias reales" con una sola clave, sin iterar escenarios — un patrón de acceso más eficiente para la interfaz de usuario.

## 12. Rendimiento y vectorización

La primera versión del orquestador tenía un loop `for n in range(N_SIMULACIONES)` que llamaba a cada función de instrumento por cada una de las 1000 simulaciones; medía 2.66 segundos por portfolio típico. Ese loop se reemplazó por funciones vectorizadas que operan directamente sobre matrices `(N, T)`: cada módulo estocástico expone una variante `_vectorizado` que recibe la matriz de shocks completa y devuelve la matriz de trayectorias en una sola llamada, mientras que los instrumentos determinísticos (LECAP, bono tasa fija, que no usan inflación ni shocks y tienen la misma trayectoria en todas las simulaciones) usan la función escalar una única vez y replican el resultado con `np.tile`:

```python
elif tipo == "lecap":
    trayectoria_escalar = simular_letra_lecap(...)
    matrices_trayectorias[inst["id"]] = np.tile(trayectoria_escalar, (N_SIMULACIONES, 1))
```

El resultado es 0.55 segundos por portfolio equivalente — un speedup de 5×. NumPy delega las operaciones matriciales a rutinas BLAS/LAPACK escritas en C, que explotan instrucciones SIMD del procesador y evitan el overhead del intérprete Python por elemento: el loop `for n` iteraba 1000 veces sobre el intérprete, mientras que la versión vectorizada hace una sola llamada a código C compilado. Como consecuencia verificable, las matrices de instrumentos determinísticos tienen filas idénticas, y la estadística resultante cumple `minimo == media == maximo` en todos los meses — invariante verificado explícitamente por el test `test_instrumento_deterministico_sin_dispersion`, que distingue instrumentos determinísticos de estocásticos.

### 12.1 Optimización de `ganancias_nominales`: desplazamiento en vez de recálculo

Perfilando el orquestador a la escala real (`N_SIMULACIONES=3000`) se encontró que el costo dominante no es la simulación GBM/CER en sí, sino el cálculo de estadísticas: `np.percentile` (vía `numpy.ndarray.partition`) concentraba más de la mitad del tiempo total, porque `calcular_estadisticas()` se invoca 128 veces por request (una vez por instrumento × 4 subconjuntos [global + 3 escenarios] × 3 métricas [patrimonio/ganancias_nominales/ganancias_reales]).

`ganancias_nominales = patrimonio - monto` es un desplazamiento constante, y percentiles, media, mínimo y máximo son equivariantes ante desplazamientos: `percentil(X − c) = percentil(X) − c`. Por eso `metricas_completas()` calcula las estadísticas de `patrimonio` una sola vez y deriva `ganancias_nominales` restándole `monto` a cada valor ya calculado, en vez de volver a llamar a `np.percentile` sobre `matriz - monto`:

```python
def _desplazar_estadisticas(stats, delta):
    return {clave: [v - delta for v in valores] for clave, valores in stats.items()}
```

Esto elimina 36 de las 128 llamadas a `calcular_estadisticas()` por request (las de `ganancias_nominales`), y midió una mejora de ~21%–25% en tiempo total según `N_SIMULACIONES` (66ms→52ms a N=1000, 279ms→210ms a N=5000). Es una optimización exacta, no una aproximación — la transformación es matemáticamente idéntica, y los 66 tests existentes pasan sin cambios. `ganancias_reales` no admite la misma optimización porque divide por `factor_acum_matrix`, que varía por trayectoria (no es un desplazamiento constante), así que sigue recalculándose desde cero.

## 13. Diseño del endpoint `/simular`

```python
@api_bp.route('/simular', methods=['POST'])
def simular():
    parametros = request.get_json()
    resultado = simular_portfolio(parametros)
    return jsonify(resultado), 200
```

El endpoint no valida la estructura ni la semántica del request: el backend .NET valida el request antes de llamar al motor (tipos, rangos, que los flujos de bonos estén correctamente priced), y el motor confía en ese contrato. Agregar validación doble duplicaría código sin agregar valor en el flujo normal ni mejorar la seguridad, dado que el motor solo escucha en localhost y no está expuesto a internet. El motor tampoco asume `t_venc ≤ T` (ver sección 7).

## 14. Estrategia de testing

Los tests del orquestador (`test_orquestador.py`) usan bonos bullet como fixture para los casos de bonos: un bono con múltiples cupones arbitrarios no satisface `V(0) = monto` a menos que los flujos estén exactamente priced a la TIR, mientras que un bono bullet (un único flujo al vencimiento igual a `monto × (1+tir)^(t/12)`) cumple la identidad exactamente en aritmética de punto flotante, sin requerir calcular analíticamente flujos para cada TIR de test. Los fixtures usan `N=30, T=3`: `N` múltiplo de 3 garantiza `n_favorable = n_moderado = n_desfavorable = 10` sin sobrante, simplificando la verificación de cortes, y `T=3` minimiza el tiempo de ejecución manteniendo suficiente estructura temporal para verificar el padding (con una LECAP de `t_venc=2`, por ejemplo). El dict base de parámetros se copia con `copy.deepcopy(PARAMS_BASE)` en cada test, para que un test que modifique `params` no contamine los tests siguientes si compartieran el mismo objeto.
