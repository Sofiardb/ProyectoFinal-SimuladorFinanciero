# Informe de Benchmarks — Simulador Financiero Monte Carlo

**Autora:** Sofia Rodriguez del Busto
**Fecha:** Abril 2026 

---

## 1. Objetivo

Python fue la tecnología elegida para el motor de simulación Monte Carlo por preferencia personal y por su relevancia en el área de finanzas cuantitativas y ciencia de datos. Este estudio busca **validar que no introduce un costo de performance**:

1. Comparar el cómputo puro de una implementación en Python/NumPy contra una equivalente en C#.
2. Cuantificar el costo de los mecanismos de integración entre el motor Python y el backend .NET (subprocess vs microservicio HTTP), para elegir el más adecuado.

---

## 2. Modelo de simulación

### 2.1 Movimiento Browniano Geométrico (GBM)

El precio de un activo sigue la ecuación diferencial estocástica:

```
dS = μ·S·dt + σ·S·dW
```

En forma discreta (esquema de Euler-Maruyama):

```
S(t+Δt) = S(t) · exp( (μ - σ²/2)·Δt + σ·√Δt · Z )
```

donde `Z ~ N(0,1)`.

Los parámetros `μ` (drift anualizado) y `σ` (volatilidad anualizada) se calculan a partir de 2.520 días históricos (~10 años) de precios de cierre de IBM, obtenidos vía Alpha Vantage API y almacenados en `DatosAccionesDiaria.json`.

**Parámetros estimados:**
- `μ = 0.0528` (retorno esperado anual: ~5.3%)
- `σ = 0.2583` (volatilidad anual: ~25.8%)

En el Benchmark 1 (Secciones 3-4) estos valores se usan como constantes fijas en memoria. El Benchmark 2 sí mide el costo real de cargarlos, porque ahí es justamente parte de lo que se compara.

### 2.2 Modelo de correlaciones — factor de mercado sistemático

Para simular un portafolio de N instrumentos con correlaciones realistas sin necesidad de una matriz de covarianzas completa, se usa un modelo de factor único — el mismo que implementa `motor-simulacion/app/simulacion/orquestador.py`:

```
Z_accion[i] = ρᵢ · Z_indice + √(1 - ρᵢ²) · Z_propio[i]
```

- `Z_indice`: shock de mercado compartido por todos los instrumentos en cada paso de tiempo
- `Z_propio[i]`: componente idiosincrática del instrumento i
- `ρᵢ ∈ [0.4, 0.6]`: correlación con el mercado (varía por instrumento)

Cada instrumento recibe un `μ` ligeramente diferente (±0.5%) para simular perfiles de crecimiento distintos, reutilizando `σ` histórico de IBM.

### 2.3 Configuración de la simulación

| Parámetro | Valor |
|---|---|
| Horizonte temporal (T) | 1 año |
| Pasos de tiempo | 12 (mensual) |
| Simulaciones | 3.000 |
| Monto por instrumento | $100.000 |
| N instrumentos evaluados | 1, 5, 10, 20 |

La cantidad de simulaciones (3.000) coincide con `N_SIMULACIONES` en `motor-simulacion/app/simulacion/orquestador.py` — los benchmarks corren a la escala real del sistema. Los pilotos aceptan este valor como parámetro, así que si `N_SIMULACIONES` cambia en el futuro, el mismo estudio se puede re-correr a la nueva escala sin modificar código — sirve como metodología reutilizable para decidir tecnología si el sistema necesita escalar.

---

## 3. Arquitectura de los pilotos

Ambos pilotos replican exactamente la arquitectura real de `motor-simulacion/app/simulacion/orquestador.py`: el factor de mercado `z_indice` se genera **una sola vez**, y después un loop **secuencial** recorre los N instrumentos del portfolio — nunca se batchea el cómputo entre instrumentos. Por cada instrumento se genera su shock idiosincrático `z_propio`, se combina en `z_accion`, y se llama a una función pura que recibe `z_accion` ya calculado y devuelve la **trayectoria completa** `(N_simulaciones, T_meses+1)` — la misma forma de salida que la función real de producción, `acciones.simular_accion_vectorizado`, porque la app necesita el camino completo (no solo el valor final) para gráficos y percentiles por período.

### Piloto C# (`piloto-csharp/src/`)

**Stack:** .NET 8.0.

Función pura (misma fórmula que `acciones.py`, ver Sección 4):

```
retornoLog[t] = (μ − 0.5σ²)/12 + (σ/√12)·z_accion[t]
acumulado += retornoLog[t]
trayectoria[t+1] = monto · exp(acumulado)
```

**Dos variantes de paralelismo**, implementadas como dos entry points que comparten el mismo núcleo de cómputo (para que no puedan divergir en la fórmula):
- **`for` secuencial:** un solo hilo, recorre las simulaciones una por una.
- **`Parallel.For`:** reparte las simulaciones de cada instrumento entre hilos del `ThreadPool`. Usa `Random.Shared` (.NET 8, thread-safe internamente) en vez de sembrar un `Random` por hilo a mano.

**Generación de normales:** transformada de Box-Muller sobre `Random`/`Random.Shared`.

Archivos:
- `src/Program.cs` — orquestador: instrumentos mock, loop secuencial, selector de variante (`for`/`parallel`) por argumento CLI
- `src/AccionSimulador.cs` — función pura por instrumento, las dos variantes
- `src/GeneradorShocks.cs` — generación de `z_indice` y de `z_accion`, también en dos variantes

### Piloto Python (`piloto-python/src/`)

**Stack:** Python 3.13.

**Tres variantes:**

- **`for` secuencial** (`accion_secuencial.py`): sin NumPy, `random.gauss(0, 1)` de la librería estándar, bucles Python anidados para todo el resto.
- **`for` paralelizado vía `multiprocessing`** (`accion_multiprocessing.py` + `mp_worker.py`): el GIL impide paralelismo real de CPU con threads sobre un `for` interpretado, así que la alternativa honesta a `Parallel.For` es multiprocessing, no threading. `Pool` persistente (creado una vez, reusado entre instrumentos dentro de una misma corrida); cada worker aplica la **misma función** de `accion_secuencial.py` (importada, no reimplementada) sobre su porción de simulaciones — garantiza que las dos variantes de `for` comparten fórmula exacta. Cada worker se siembra con una semilla derivada de su propio PID (único entre los procesos vivos del pool) para no correlacionar resultados entre procesos.
- **NumPy vectorizado** (`accion_numpy.py`): en vez de reimplementar la fórmula, **importa directo** `simular_accion_vectorizado` desde `motor-simulacion/app/simulacion/acciones.py`. Esta variante no es "un modelo parecido a producción": es producción, medida sin reimplementación de por medio.

Archivos:
- `src/accion_secuencial.py` — función pura `for` + generación de shocks, reusada por la variante `multiprocessing`
- `src/mp_worker.py` — funciones worker del `Pool` (nivel de módulo, picklables bajo `spawn` — el modo por defecto en Windows)
- `src/accion_multiprocessing.py` — orquestador de la variante paralela
- `src/accion_numpy.py` — wrapper delgado sobre la función real de producción

*(`monte_carlo_python_numpy.py`, `data_loader.py` y `api_simulador.py` no forman parte de este benchmark — los sigue usando el Benchmark 2, Sección 5, sin cambios.)*

### 3.1Comparación profunda: qué explica los resultados

**C# `for` secuencial le gana a `Parallel.For`, en los 4 N medidos** (Sección 4). Coordinar el `ThreadPool` para repartir 3.000 simulaciones de 12 pasos cada una no se paga solo a esta escala — el overhead de despachar cada tarea al pool pesa más que el cómputo que esa tarea ahorra. El paralelismo de grano grueso necesita más trabajo por unidad para amortizarse; con instrumentos más pesados (más pasos, portfolios más grandes) el resultado podría invertirse, pero no ocurre en el rango real del sistema (1-20 instrumentos, 3.000 simulaciones).

**El `for` interpretado en Python (sin ninguna librería) es 4.9x–8.7x más lento que el `for` de C#**, y esa brecha *crece* con N en vez de achicarse. Dos razones, no una: (1) CPython interpreta bytecode instrucción a instrucción y cada `random.gauss()` paga overhead de llamada de función — 3.000×12 veces por instrumento solo para el shock idiosincrático; (2) las listas de Python son arrays de punteros a objetos `float` individuales (boxeados, dispersos en memoria), contra los `double[]` contiguos de C# — peor localidad de caché en cada acceso. 

**`multiprocessing` es la variante más lenta en los 4 puntos, por lejos** (0.28s–0.38s, contra menos de 0.04s de las dos variantes C#). El costo no es de cómputo: es levantar un `Pool` de `os.cpu_count()` = 22 procesos en cada corrida — tan dominante que el tiempo total casi no crece entre N=1 y N=20 (0.2765s → 0.3784s, +37%, contra +870% de la variante NumPy en el mismo rango: casi toda la variante multiprocessing es overhead fijo, no trabajo real). Esto refleja la metodología del benchmark (cada corrida cronometrada relanza el proceso del piloto desde cero, igual que las otras 4 variantes, para que la comparación sea pareja) — no dice qué pasaría con un pool de workers persistente sirviendo muchos requests seguidos, que amortizaría ese arranque de forma parecida a como el microservicio HTTP amortiza el costo de importar NumPy en el Benchmark 2. Con o sin esa salvedad, el resultado ya es contundente para la decisión real: NumPy vectorizado no necesita ayuda de multiprocessing para ganarle a C#, así que no hay ninguna razón para explorar esa ruta en producción.

**Python NumPy vectorizado — la función real de producción — gana en los 4 puntos medidos**, contra la mejor variante de C# (`for` secuencial): 3.0x en N=1, 3.4x en N=5, 2.5x en N=10, 1.8x en N=20. La explicación es la misma que en el resto de esta sección, en sentido inverso: `np.random.standard_normal` genera todas las muestras de una corrida en una sola llamada bulk usando el algoritmo Ziggurat (resuelve casi todas las muestras con comparaciones y una tabla precalculada, cae a funciones trascendentales solo en el caso de rechazo — más barato por muestra que Box-Muller), y las operaciones vectorizadas de NumPy procesan varios `double` contiguos por instrucción de CPU (SIMD), sin el overhead de interpretación ni el boxing de listas de Python puro. El margen se achica con N (3.4x → 1.8x) por la misma razón que en el resto de las comparaciones: a medida que crece el trabajo por instrumento, el costo fijo de despacho/coordinación pesa relativamente menos frente al cómputo real, que escala de forma más parecida entre implementaciones.

---

## 4. Benchmark 1 — C# vs Python, 5 variantes

**Script:** `run_benchmark_escalable.py` orquesta las 5 variantes descritas en la Sección 3. Cada variante imprime `Tiempo total` (medido con `Stopwatch` en C#, `time.time()` en Python) alrededor únicamente de la simulación — generación de `z_indice`, loop de instrumentos, generación de `z_accion` y llamada a la función pura — sin arranque de proceso, que es lo que mide el Benchmark 2. Cada punto (variante × N instrumentos) se corre **10 veces y se reporta la mediana**, no el promedio.

### Resultados — mediana de 10 corridas, 3.000 simulaciones, 12 meses (segundos)

| N instrumentos | C# `for` | C# `Parallel.For` | Python `for` | Python `multiprocessing` | Python NumPy |
|---|---|---|---|---|---|
| 1 | 0.0039 | 0.0156 | 0.0261 | 0.2765 | **0.0013** |
| 5 | 0.0188 | 0.0280 | 0.0924 | 0.2942 | **0.0056** |
| 10 | 0.0246 | 0.0324 | 0.1739 | 0.3230 | **0.0100** |
| 20 | 0.0379 | 0.0415 | 0.3289 | 0.3784 | **0.0209** |

### Análisis

La lectura mecánica de cada resultado está en la Sección 3.4. En síntesis: **Python NumPy vectorizado (la función real de producción, importada sin modificar) es la variante más rápida en los 4 puntos medidos**, con ventajas de 1.8x a 3.4x sobre la mejor variante de C# (`for` secuencial, que a su vez le gana consistentemente a `Parallel.For` a esta escala). Las otras dos variantes Python (`for` interpretado y `multiprocessing`) son, como es esperable, mucho más lentas que cualquier variante C# — confirman que la ventaja de Python depende enteramente de vectorizar con NumPy, no del lenguaje en abstracto.

---

## 5. Benchmark 2 — Costo de integración

**Script:** `run_benchmark_integracion.py`
**Objetivo:** separar el overhead del mecanismo de integración del costo real de simulación, y determinar qué mecanismo es óptimo para integrar el motor Python en la aplicación .NET.

Al igual que en el Benchmark 1, cada punto se mide con **10 corridas y se reporta la mediana** (antes: 5 corridas, promedio); el *round-trip* HTTP puro (`/ping`) se mide con 30 corridas por lo económico de la medición.

### Mecanismos evaluados

| Mecanismo | Descripción |
|---|---|
| **Subprocess Python** | Lanzar `python monte_carlo_python_numpy.py N` por cada request |
| **HTTP (microservicio Flask)** | Servidor Python persistente con datos pre-cargados; se hace POST a `/simular` |

### Overhead de integración (sin simulación)

| Mecanismo | Overhead medido |
|---|---|
| Python startup (sin NumPy) | 31.8 ms |
| Python startup + import NumPy | 125.0 ms |
| HTTP round-trip `/ping` (loopback) | 1.8 ms |

### Tiempos totales por N (3.000 simulaciones)

| N | Subprocess Python | HTTP Flask | Sim. pura (server) |
|---|---|---|---|
| 1 | 165.4 ms | **11.5 ms** | 1.7 ms |
| 5 | 170.3 ms | **13.1 ms** | 6.7 ms |
| 10 | 167.7 ms | **29.0 ms** | 10.0 ms |
| 20 | 185.3 ms | **36.5 ms** | 21.0 ms |

*(Los valores absolutos pueden variar según la máquina y su carga de fondo en el momento de la corrida; lo estable entre corridas es el punto cualitativo: HTTP siempre por debajo de subprocess.)*

### Desglose: overhead vs simulación

| N | Sub. overhead | HTTP overhead |
|---|---|---|
| 1 | 99% del tiempo total | 87% del tiempo total |
| 5 | 96% del tiempo total | 38% del tiempo total |
| 10 | 94% del tiempo total | 66% del tiempo total |
| 20 | 89% del tiempo total | 40% del tiempo total |

El overhead de subprocess baja de forma monótona con N, como es esperable (la simulación pesa cada vez más sobre un costo fijo de arranque). El overhead HTTP, en cambio, no es monótono (87% → 38% → 66% → 40%): a esta escala los valores absolutos son de un dígito de milisegundos, así que el % es sensible al jitter propio del stack de red local (loopback) y del scheduler del SO entre corridas — el punto cualitativo robusto es que el overhead HTTP es siempre muy inferior al de subprocess.

### Punto de cruce

- **HTTP supera a Subprocess Python desde N=1** — en todo el rango evaluado.
- El overhead HTTP (~1.8 ms fijo) es muy inferior al costo de relanzar el proceso Python en cada request (~125 ms de arranque con NumPy importado), incluso para portfolios de una sola empresa.

### Análisis del mecanismo HTTP

El microservicio Flask carga los datos históricos y calcula μ/σ/S₀ una única vez al arrancar. Cada request paga únicamente:

```
costo_request = overhead_HTTP (~1.8ms) + simulacion_pura (1.7–21.0ms según N)
```

Comparado con el costo de relanzar el proceso en cada request:

```
costo_subprocess = startup_Python + NumPy (~125ms) + carga_JSON + calculo_params + simulacion
```

El ahorro del microservicio se mantiene estable en **~139–157 ms por request** en todo el rango de N — a diferencia del cómputo puro (Benchmark 1), acá el costo fijo de arrancar Python + NumPy domina sobre el costo de simulación incluso en el extremo superior del rango (N=20), así que el ahorro no se diluye con N.

---

## 6. Conclusiones y justificación de diseño

### Por qué Python/NumPy para el motor de simulación

La elección de Python respondió a preferencia personal y a su relevancia en el área de finanzas cuantitativas y ciencia de datos: NumPy, pandas y Jupyter son estándar de facto en research financiero, y existen librerías especializadas (QuantLib-Python, statsmodels, scikit-learn) que amplían el alcance del simulador para extensiones futuras. No fue, en el momento de tomar la decisión, una elección basada en benchmarks de performance — este estudio se hizo *después*, para validar que esa preferencia no introdujera un costo de performance inaceptable.

El resultado de esa validación (Secciones 4 y 5):

1. **El cómputo puro no es un problema — la implementación real de producción resultó más rápida que C# en todos los escenarios medidos.** El Benchmark 1 compara 5 variantes (C# `for`/`Parallel.For`, Python `for`/`multiprocessing`/NumPy vectorizado) replicando la arquitectura real de `orquestador.py`, a la escala real del sistema (3.000 simulaciones). La variante Python NumPy — que importa la función real de `acciones.py` sin modificarla — gana en los 4 N medidos, con ventajas de 1.8x a 3.4x sobre la mejor variante de C#. Las otras dos variantes Python (interpretada sin librerías, multiprocessing) son mucho más lentas que C#, lo que deja claro que la ventaja depende de vectorizar con NumPy, no del lenguaje en sí (Sección 3.4).

2. **Ecosistema científico:** NumPy, SciPy y pandas ofrecen primitivas financieras que C# no tiene nativamente (percentiles, distribuciones, álgebra lineal densa), relevantes para extensiones futuras del simulador.

### Por qué microservicio HTTP en lugar de subprocess

1. **Overhead amortizado:** el servidor Flask paga el costo de startup y carga de datos una sola vez. Cada request posterior paga solo ~1.8 ms de IPC vs ~125 ms de startup por subprocess.

2. **Desacoplamiento:** el motor de simulación se convierte en un servicio independiente con interfaz HTTP limpia (`POST /simular`), invocable desde cualquier cliente (.NET, JavaScript, tests) sin acoplamiento de runtime.

3. **Costo de integración cuantificado:** con el mecanismo HTTP, el overhead de integración representa el 38%–87% del tiempo total según N, vs 89%–99% para subprocess.

### Limitaciones del prototipo académico

- Se consideró un único tipo de instrumentos (acciones) para todos los portfolios del Benchmark 1.
- Los benchmarks miden wall-clock time, que incluye variabilidad del SO y de la carga de fondo de la máquina. Los valores reportados son la **mediana de 10 corridas por punto** en ambos benchmarks — la mediana no se deja arrastrar por 1-2 corridas atípicas, a diferencia del promedio.
- La variante `multiprocessing` del Benchmark 1 paga el costo de crear su `Pool` en cada corrida cronometrada (cada corrida relanza el proceso del piloto desde cero, igual que las otras 4 variantes, para que la comparación sea pareja) — no representa el costo de un pool de workers persistente sirviendo muchos requests (Sección 3.4).
- El escenario de hosting con CPU limitada ("1 núcleo/hilo") del estudio original no está incluido en el piloto rediseñado — pendiente de decidir si se modela con afinidad de proceso real.
- A la escala de milisegundos del Benchmark 2, el overhead HTTP medido como % del tiempo total no es perfectamente monótono entre puntos de N (Sección 5): normal cuando el valor absoluto es de un dígito de milisegundos, sensible al jitter del stack de red local y del scheduler del SO.

---

## 7. Estructura de archivos del proyecto

```
ProyectoFinal-SimuladorFinanciero/
│
├── DatosAccionesDiaria.json          # Serie histórica IBM (2520 días, Alpha Vantage) -- usado por Benchmark 2
│
├── run_benchmark_escalable.py        # Benchmark 1: C# vs Python, 5 variantes, por N instrumentos
├── run_benchmark_integracion.py      # Benchmark 2: Subprocess vs HTTP (motor Python)
│
├── benchmark_escalabilidad.json      # Resultados benchmark 1
├── benchmark_integracion.json        # Resultados benchmark 2
│
├── piloto-csharp/
│   ├── MonteCarlosPilot.csproj       # .NET 8.0, Nullable enabled
│   └── src/
│       ├── Program.cs                # Orquestador: instrumentos mock, loop secuencial, selector de variante
│       ├── AccionSimulador.cs        # Funcion pura por instrumento (for secuencial / Parallel.For)
│       └── GeneradorShocks.cs        # Generacion de z_indice y z_accion (secuencial / paralela)
│
├── piloto-python/
│   └── src/
│       ├── accion_secuencial.py       # Variante "for" (sin NumPy) -- reusada por multiprocessing
│       ├── mp_worker.py               # Funciones worker del Pool (nivel de modulo, picklables)
│       ├── accion_multiprocessing.py  # Variante "for paralelizado" (multiprocessing, pool persistente)
│       ├── accion_numpy.py            # Variante NumPy -- importa la funcion real de produccion
│       ├── monte_carlo_python_numpy.py # Usado solo por Benchmark 2 (subprocess/HTTP)
│       ├── data_loader.py             # Parser JSON, calculo mu/sigma -- usado solo por Benchmark 2
│       └── api_simulador.py           # Microservicio Flask (/ping, /simular) -- Benchmark 2
│
└── INFORME_BENCHMARKS.md             # Este documento
```
