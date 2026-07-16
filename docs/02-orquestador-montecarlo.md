# Orquestador Monte Carlo — Decisiones de diseño

**Archivo:** `motor-simulacion/app/simulacion/orquestador.py`  
**Función principal:** `simular_portfolio(parametros: dict) -> dict`  
**Tests:** `motor-simulacion/tests/test_orquestador.py`

---

## Rol del orquestador

El orquestador es el único módulo del motor que:
1. Genera aleatoriedad (a través de `numpy.random.default_rng`)
2. Conoce la composición completa del portfolio (todos los instrumentos simultáneamente)
3. Aplica los escenarios macroeconómicos (inflación por rango)
4. Agrega trayectorias individuales en la trayectoria del portfolio
5. Calcula las estadísticas finales

Las funciones de instrumento (`simular_accion_vectorizado`, `simular_bono_tasa_fija`, etc.) son funciones puras: reciben sus inputs y devuelven una trayectoria, sin conocer el contexto del portfolio ni generar aleatoriedad. El orquestador actúa como director de la simulación y cada función de instrumento como un cálculo puntual.

---

## Flujo de ejecución

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

---

## Decisión 1: Semilla — generación interna con retorno al llamador

```python
semilla = parametros.get("semilla")
if semilla is None:
    semilla = int(np.random.default_rng().integers(0, 2**31))
rng = np.random.default_rng(semilla)
```

**Decisión:** si el llamador no provee semilla, el motor genera una aleatoriamente y la retorna en el output. El RNG final siempre es determinístico a partir de esa semilla.

**Justificación original (RF-16) — ahora desplazada:** el diseño inicial preveía que la reproducibilidad de simulaciones pasadas se lograría regenerando las trayectorias desde la semilla. Bajo ese esquema, la semilla se persistía en `simulacion.seed_aleatoria` y el backend invocaba al motor con `"semilla": <seed guardada>` para obtener resultados idénticos.

Esa justificación quedó obsoleta cuando se decidió persistir las estadísticas completas en `resultado_simulacion` como JSONB. Ahora el backend lee esa tabla directamente para visualizar simulaciones pasadas y no necesita reinvocar al motor. La semilla sigue persistiéndose en la base de datos como registro de auditoría — permite saber con qué secuencia aleatoria se generó cada simulación — pero ya no es el mecanismo de reproducibilidad principal.

**Por qué `2**31` como límite:** `numpy.random.default_rng` acepta enteros de hasta 128 bits, pero la semilla se mantiene en rango `int32` para compatibilidad con la columna `BIGINT` de PostgreSQL y el tipo `long` de .NET, evitando conversiones o truncamientos en la capa de persistencia.

**Por qué `default_rng` y no `np.random.seed`:** `default_rng` crea un generador con estado local (no modifica estado global). El antiguo `np.random.seed` modifica el estado global del módulo, lo que causaría interferencia entre dos requests simultáneos al motor. Flask puede recibir múltiples requests en paralelo; con `default_rng` cada llamada tiene su propio generador aislado.

---

## Decisión 2: Reparto de simulaciones por escenario

```python
N_SIMULACIONES = 1000
n_favorable    = N_SIMULACIONES // 3        # 333
n_moderado     = N_SIMULACIONES // 3        # 333
n_desfavorable = N_SIMULACIONES - n_favorable - n_moderado  # 334
```

**Decisión:** dividir las 1000 simulaciones en tres grupos iguales. Si N no es divisible por 3, el sobrante va a `n_desfavorable`.

**Por qué el sobrante a `desfavorable`:** es el escenario de mayor riesgo. Para N=1000 la diferencia (334 vs 333) es estadísticamente despreciable, pero sobredimensionar el escenario adverso es preferible desde el punto de vista del análisis de riesgo.

**Por qué grupos contiguos y no intercalados:** el ordenamiento contiguo (primero todas las favorables, luego las moderadas, luego las desfavorables) simplifica la extracción de estadísticas por escenario:
```python
corte_favorable    = slice(0, n_favorable)
corte_moderado     = slice(n_favorable, n_favorable + n_moderado)
corte_desfavorable = slice(n_favorable + n_moderado, N_SIMULACIONES)
```
Un slice contiguo es la operación más eficiente en NumPy sobre el eje 0: no requiere reindexado ni máscaras booleanas.

---

## Decisión 3: Pre-generación upfront de toda la aleatoriedad

**Decisión:** toda la aleatoriedad del motor (inflación, shocks de mercado, shocks idiosincráticos) se genera en una sola pasada antes del loop principal de instrumentos.

**Justificación — tres razones:**

1. **Reproducibilidad estable ante cambios en el portfolio.** La semilla controla el estado interno del RNG de forma secuencial. Si la generación estuviera intercalada con la lógica de cada instrumento, agregar o quitar un instrumento cambiaría todos los números aleatorios de los instrumentos restantes (porque el RNG avanzaría diferente). Al generar upfront y por tipo de variable, agregar un instrumento solo agrega nuevas columnas al final del diccionario `z_propios` — no altera los números ya generados para otros instrumentos.

2. **Performance.** NumPy genera bloques grandes de números aleatorios mucho más eficientemente que uno por vez. `rng.standard_normal((1000, T))` produce 1000×T valores en una sola llamada a código C compilado. El equivalente con un loop Python haría 1000×T llamadas al intérprete.

3. **Claridad estructural.** Queda explícito qué variables son determinadas por azar (generadas antes del loop) y cuáles son calculadas (derivadas durante el loop). Facilita la lectura y el debugging.

---

## Decisión 4: Modelo de inflación — Uniform(min, max) independiente por mes

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

**Decisión:** para cada simulación y cada mes, la inflación mensual se sortea de forma independiente de una distribución uniforme en el rango del escenario.

**Por qué distribución Uniforme:** la propuesta especifica que los escenarios definen rangos `[min, max]` de inflación mensual. La distribución uniforme es la más conservadora: asigna igual probabilidad a cualquier valor dentro del rango, sin suponer una forma particular de la distribución real de inflación. Alternativas más precisas (Normal truncada, Beta) requerirían calibrar parámetros adicionales sin datos suficientes para justificarlos en el contexto del trabajo final.

**Por qué independiente mes a mes:** no se modela autocorrelación. Esta es una simplificación explícita: modelar autocorrelación requeriría un proceso AR(1) u ARIMA, que está fuera del alcance definido en la propuesta.

**Por qué los escenarios de inflación no afectan los shocks bursátiles:** los shocks `z_indice` y `z_propios` son completamente independientes del escenario de inflación. Una simulación "favorable" (inflación 2-3%) puede tener retornos bursátiles negativos, y viceversa. La correlación entre inflación argentina y el mercado estadounidense no está modelada por decisión de diseño.

---

## Decisión 5: Un único índice de mercado (S&P 500)

**Decisión:** se genera un único `z_indice` que representa el shock del S&P 500. El campo `"mercado"` existe en la estructura de cada instrumento para extensiones futuras, pero actualmente todas las acciones usan el mismo `z_indice`.

**Justificación:** la versión original contemplaba dos índices: `z_indice_arg` (MERVAL) y `z_indice_usd` (S&P 500). Se eliminó `z_indice_arg` porque el universo de acciones del simulador se limita al S&P 500. La disponibilidad de datos históricos con profundidad y calidad suficiente para estimar `μ`, `σ` y `ρ` existe de forma confiable para el índice americano.

---

## Decisión 6: Modelo de factor único para correlaciones entre acciones

```python
z_accion = rho * z_indice + np.sqrt(1 - rho**2) * z_propio
```

**Decisión:** el shock de cada acción se construye como combinación lineal del shock sistemático (índice de mercado, compartido) y el shock idiosincrático (exclusivo de la acción).

**Fundamento matemático:** si `Z_indice ~ N(0,1)` y `Z_propio ~ N(0,1)` son independientes, entonces `Z_accion = ρ·Z_indice + √(1-ρ²)·Z_propio` cumple que:
- `Z_accion ~ N(0,1)` — la distribución del shock es estándar
- `Corr(Z_accion, Z_indice) = ρ` — correlación exacta con el índice
- Para dos acciones A y B: `Corr(Z_A, Z_B) = ρ_A · ρ_B` — correlación entre acciones derivada del índice compartido

**Implicancias para el portfolio:** acciones con `ρ` alto (≈1) se mueven muy correlacionadas entre sí y con el mercado — el riesgo no se reduce al combinarlas. Acciones con `ρ` bajo (≈0) tienen comportamiento casi independiente — aportan diversificación real. El modelo captura este efecto correctamente.

**Alternativa descartada: Cholesky sobre matriz de correlaciones.** Para `N` acciones, la correlación directa requeriría una matriz de correlaciones `N×N` y su descomposición de Cholesky. El modelo de factor único es una aproximación de primer orden ampliamente usada en la práctica (es la base del CAPM) que captura la mayor parte de la varianza con un solo parámetro por acción (`ρ`), estimable directamente de datos históricos sin necesidad de construir la matriz completa.

---

## Decisión 7: Padding/truncado de trayectorias cuando el vencimiento no coincide con el horizonte

```python
if len(trayectoria) > T_meses + 1:
    trayectoria = trayectoria[:T_meses + 1]
elif len(trayectoria) < T_meses + 1:
    trayectoria = trayectoria + [trayectoria[-1]] * (T_meses + 1 - len(trayectoria))
```

**Contexto:** letras y bonos devuelven trayectorias de largo `t_venc + 1`, calculado contra el
vencimiento **real** del instrumento — independiente del horizonte de simulación `T` (el horizonte se
elige por simulación, no al armar el portfolio; ver `docs/07-portfolio-reglas-negocio.md`). El vencimiento
real puede caer antes o después de `T`.

**Decisión — vence antes (`t_venc < T`):** repetir el último valor (`V(t_venc)`) desde `t_venc + 1` hasta
`T_meses`. El capital cobrado al vencimiento queda disponible como efectivo para el resto del período,
sin rendimiento adicional.

**Decisión — vence después (`t_venc > T`):** truncar la trayectoria a `T_meses + 1`. El motor sigue
calculando la valuación contra el vencimiento real (para descontar correctamente "cuánto falta"), pero
solo emite los valores hasta `T`, sin proyectar el instrumento como si hubiera llegado a vencimiento. Para
los instrumentos indexados por CER (`lecer`, `bono_indexado`) esto además es necesario estructuralmente:
`factor_cer_matrix` solo tiene inflación simulada hasta `T_meses + 1`, así que no hay forma de calcular
más allá de ese punto.

**Justificación (ambos casos):** la reinversión al vencimiento implicaría elegir en qué instrumento
reinvertir y a qué condiciones, y proyectar más allá del horizonte implicaría asumir que el instrumento
efectivamente llega a cobrarse. Ambas son decisiones del usuario, no del simulador. El simulador muestra
qué pasó con el capital invertido en los instrumentos elegidos, tal como están, hasta el horizonte
elegido — ni más allá, ni asumiendo qué pasa después.

**Alternativa descartada:** modelar el cash post-vencimiento como un plazo fijo a tasa de referencia del mercado. Requeriría un parámetro adicional (tasa vigente en el período de reinversión) y haría implícita una decisión financiera que debería ser explícita del usuario.

---

## Decisión 8: Estadísticas — p25/mediana/p75 y cuatro vistas de escenario

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

**Decisión:** calcular p25, mediana (p50) y p75 en una sola llamada, junto con media, mínimo y máximo. Producir cuatro vistas por instrumento: global, favorable, moderado, desfavorable.

**Por qué p25/mediana/p75 y no p5/p95:** los cuartiles forman el resumen de cinco números (mín, p25, mediana, p75, máx) necesario para construir box-whisker plots. Junto con `minimo` y `maximo`, el output cubre los dos modos de visualización del frontend: fan chart (banda p25–p75 con bordes min/max) y box-whisker por mes. Los percentiles extremos (p5/p95) fueron descartados porque los box-whisker usan cuartiles por convención, y p25–p75 ya comunica la dispersión central de forma reconocible.

**Los tres percentiles en una sola llamada.** `np.percentile(matriz, [25, 50, 75])` hace una única pasada sobre la matriz. Tres llamadas separadas harían tres pasadas independientes — innecesariamente costoso para matrices de `(1000, T+1)`.

**Vista `global`:** estadística sobre las 1000 simulaciones completas, sin condicionar por escenario. Permite al usuario ver el comportamiento marginal del instrumento antes de filtrar por escenario. No es el promedio de los tres escenarios sino la estadística sobre la totalidad de las trayectorias.

---

## Decisión 9: Portfolios separados por moneda (portfolio_ars / portfolio_usd)

**Decisión:** clasificar cada instrumento como ARS o USD, agregar por separado y retornar dos sub-portfolios en lugar de uno. Los instrumentos USD son acciones con `mercado = "usd"`; todos los demás (letras, bonos, plazos fijos) son ARS.

**Justificación:** combinar instrumentos ARS y USD en un único portfolio requeriría proyectar el tipo de cambio durante `T` meses. Usar el tipo de cambio spot actual sería inverosímil para horizontes de 12 a 24 meses. Modelarlo como proceso estocástico separado excede el alcance de la propuesta. La decisión fue separar monedas: cada sub-portfolio se interpreta y visualiza en su propia moneda.

**Sub-portfolio vacío:** si el portfolio no tiene acciones USD, `insts_usd` es una lista vacía y la función retorna una matriz de ceros. El frontend puede ocultar el panel USD cuando el valor inicial es cero.

---

## Decisión 10: Ganancias nominales y reales como capas adicionales

```python
factor_acum_matrix = np.ones((N_SIMULACIONES, T_meses + 1))
factor_acum_matrix[:, 1:] = np.cumprod(1 + inflacion, axis=1)

gan_nominal_i = matriz_i - monto_i
gan_real_i    = matriz_i / factor_acum_matrix - monto_i
```

**Decisión:** además del patrimonio `V(t)`, el output incluye ganancias nominales y ganancias reales por cada instrumento y portfolio.

**Ganancia nominal** (`V(t) − monto`): cuántos pesos adicionales tiene el inversor respecto a lo invertido. Puede ser positiva aunque el instrumento haya perdido poder adquisitivo (un plazo fijo tradicional en escenario desfavorable gana nominalmente pero pierde en términos reales).

**Ganancia real** (`V(t) / factor_acum(t) − monto`): deflacta el patrimonio por la inflación acumulada de esa trayectoria, convirtiendo a pesos de t=0. Responde si el inversor ganó o perdió poder adquisitivo. Esta es la métrica que permite comparar de forma justa instrumentos indexados vs no indexados.

**Invariante:** `ganancia_real < ganancia_nominal` para `t > 0` con inflación positiva. El test `test_ganancias_reales_menores_que_nominales` verifica este invariante explícitamente.

---

## Decisión 11: Función `calcular_estadisticas` a nivel de módulo; `estadisticas_por_escenario` como closure

**Decisión:** `calcular_estadisticas` vive a nivel del módulo (función pura, no captura ninguna variable exterior). `estadisticas_por_escenario` vive dentro de `simular_portfolio` como closure.

**Justificación para `calcular_estadisticas` a nivel de módulo:** no depende de ninguna variable del portfolio (no captura cortes de escenario, ni N, ni T). Al ser una función pura, es testeable de forma aislada importándola directamente en un test sin necesidad de armar un portfolio completo. También es reutilizable si en el futuro otro módulo necesita calcular las mismas métricas sobre cualquier matriz de simulaciones.

**Justificación para `estadisticas_por_escenario` como closure:** captura `corte_favorable`, `corte_moderado` y `corte_desfavorable`, que son variables locales calculadas a partir de `N_SIMULACIONES` en runtime. Al estar dentro de `simular_portfolio`, esos cortes están disponibles sin necesidad de pasarlos como parámetros en cada llamada. Si viviera a nivel de módulo, habría que pasar los tres cortes explícitamente en cada llamada, agregando ruido sin beneficio.

**Criterio general adoptado:** solo viven dentro de la función las auxiliares que genuinamente necesitan capturar estado local de esa llamada. Las funciones puras van al nivel del módulo.

---

## Decisión 12: Vectorización del loop principal

**Contexto inicial:** la primera versión del orquestador tenía un loop `for n in range(N_SIMULACIONES)` que llamaba a cada función de instrumento para cada una de las 1000 simulaciones. Medición: **2.66 segundos** por portfolio típico.

**Decisión:** reemplazar ese loop por funciones vectorizadas que operan directamente sobre matrices `(N, T)`. Cada módulo estocástico expone una variante `_vectorizado` que recibe la matriz de shocks completa y devuelve la matriz de trayectorias en una sola llamada. Los instrumentos determinísticos usan la función escalar una única vez y replican el resultado con `np.tile`.

**Resultado:** **0.55 segundos** por portfolio equivalente — speedup de 5×.

**Por qué la vectorización es efectiva aquí:** NumPy delega las operaciones matriciales a rutinas BLAS/LAPACK escritas en C, que explotan instrucciones SIMD del procesador y evitan el overhead del intérprete Python por elemento. El loop `for n` iteraba 1000 veces sobre el intérprete; la versión vectorizada hace una sola llamada a código C compilado.

---

## Decisión 13: Instrumentos determinísticos dentro del loop vectorizado

**Contexto:** LECAP y bono tasa fija no usan inflación ni shocks. Su trayectoria es idéntica en todas las simulaciones.

**Decisión:** llamar la función escalar una vez y replicar el resultado con `np.tile` para producir la matriz `(N, T+1)`.

```python
elif tipo == "lecap":
    trayectoria_escalar = simular_letra_lecap(...)
    matrices_trayectorias[inst["id"]] = np.tile(trayectoria_escalar, (N_SIMULACIONES, 1))
```

**Consecuencia verificable:** las matrices de instrumentos determinísticos tienen filas idénticas. La estadística resultante tiene `minimo == media == maximo` en todos los meses. El test `test_instrumento_deterministico_sin_dispersion` verifica este invariante explícitamente, distinguiendo los instrumentos determinísticos de los estocásticos.

---

## Decisión 14: Diseño del endpoint `/simular`

```python
@api_bp.route('/simular', methods=['POST'])
def simular():
    parametros = request.get_json()
    resultado = simular_portfolio(parametros)
    return jsonify(resultado), 200
```

**Decisión:** el endpoint no valida la estructura ni la semántica del request.

**Justificación:** el backend .NET valida el request antes de llamar al motor (tipos, rangos, que los flujos de bonos estén correctamente priced). El motor confía en ese contrato. Agregar validación doble duplica código sin agregar valor en el flujo normal y sin mejorar la seguridad (el motor solo escucha en localhost, no está expuesto a internet). El motor no asume `t_venc ≤ T` — ver Decisión 7.

---

## Estructura del output

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
      "ganancias_reales":    { "global": {...}, ... },
      "prob_perdida":        { "global": {...}, ... }
    }
  },
  "portfolio_ars": {
    "patrimonio":          { "global": {...}, ... },
    "ganancias_nominales": { ... },
    "ganancias_reales":    { ... },
    "prob_perdida":        { ... }
  },
  "portfolio_usd": { ... }
}
```

**Jerarquía: métrica → escenario (no al revés).** Esta estructura permite al frontend cambiar entre "vista de patrimonio" y "vista de ganancias reales" con una sola clave, sin iterar escenarios. Es más eficiente para los patrones de acceso de la interfaz de usuario.

**`prob_perdida`:** fracción de simulaciones donde `V(t) < monto`. Se calcula tanto en términos nominales como reales, y desagregada por escenario. Por construcción, `prob_perdida_real ≥ prob_perdida_nominal` cuando la inflación es positiva: perder en términos reales es más probable que perder en términos nominales.

---

## Decisiones de diseño de los tests del orquestador

**Bullet bonds para el fixture de bonos.** Los bonos con múltiples cupones arbitrarios no satisfacen `V(0) = monto` a menos que los flujos estén exactamente priced a la TIR. Con un bono bullet (un único flujo al vencimiento igual a `monto × (1+tir)^(t/12)`), la identidad se cumple exactamente en aritmética de punto flotante. Los bonos con cupones múltiples requerirían calcular analíticamente los flujos para cada TIR de test — innecesariamente complejo para un fixture.

**`N=30, T=3`.** Múltiplo de 3 garantiza `n_favorable = n_moderado = n_desfavorable = 10` (sin sobrante, simplificando la verificación de cortes). T=3 minimiza el tiempo de ejecución manteniendo suficiente estructura temporal para verificar padding (LECAP con `t_venc=2`).

**`copy.deepcopy(PARAMS_BASE)` en cada test.** El dict base se copia en profundidad para cada test. Sin esto, un test que modifica `params` (como `test_semilla_reproducibilidad`, que agrega `params["semilla"]`) contaminaría los tests siguientes si compartieran el mismo objeto.
