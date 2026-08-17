# Informe de Benchmarks — Simulador Financiero Monte Carlo

**Autora:** Sofia Rodriguez del Busto  
**Fecha:** Abril 2026  
**Contexto:** Proyecto Final — Validación de performance del motor de simulación Python y de su mecanismo de integración con el backend .NET/PostgreSQL/React

---

## 1. Objetivo

Python fue la tecnología elegida para el motor de simulación Monte Carlo por preferencia personal y por su relevancia en el área de finanzas cuantitativas y ciencia de datos (ver justificación completa en la Sección 6). Este estudio busca **validar que no introduce un costo de performance**:

1. Comparar el cómputo puro de una implementación en Python/NumPy contra una equivalente en C#, en distintos escenarios de paralelismo disponible.
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
- `S₀ = 253.71 USD` (precio inicial)

### 2.2 Modelo de correlaciones — factor de mercado sistemático

Para simular un portafolio de N empresas con correlaciones realistas sin necesidad de una matriz de covarianzas completa, se usa un modelo de factor único:

```
Z_accion[i] = ρᵢ · Z_indice + √(1 - ρᵢ²) · Z_propio[i]
```

- `Z_indice`: shock de mercado compartido por todas las empresas en cada paso de tiempo
- `Z_propio[i]`: componente idiosincrática de la empresa i
- `ρᵢ ∈ [0.4, 0.6]`: correlación con el mercado (varía por empresa)

Cada empresa recibe un `μ` ligeramente diferente (±0.5%) para simular perfiles de crecimiento distintos, reutilizando `σ` y `S₀` históricos de IBM.

### 2.3 Configuración de la simulación

| Parámetro | Valor |
|---|---|
| Horizonte temporal (T) | 1 año |
| Pasos de tiempo | 12 (mensual) |
| Simulaciones | 3.000 |
| Acciones por empresa | 100 |
| N empresas evaluadas | 1, 5, 10, 20 |

La cantidad de simulaciones (3.000) coincide con `N_SIMULACIONES` en `motor-simulacion/app/simulacion/orquestador.py` — los benchmarks corren a la escala real del sistema, no a un número elegido arbitrariamente. Tanto `run_benchmark_escalable.py` como los pilotos aceptan este valor como parámetro (no está hardcodeado), así que si `N_SIMULACIONES` cambia en el futuro, el mismo estudio se puede re-correr a la nueva escala sin modificar código — sirve como metodología reutilizable para decidir tecnología si el sistema necesita escalar.

---

## 3. Arquitectura de los pilotos

### Piloto C# (`piloto-csharp/`)

**Stack:** .NET 8.0, C# con `Parallel.For` y `Random` thread-local.

**Estrategia de paralelismo:** cada simulación se ejecuta en un hilo independiente del `ThreadPool`. Cada hilo tiene su propia instancia de `Random` inicializada con `Guid.NewGuid().GetHashCode()` para evitar contención y garantizar independencia estadística.

**Generación de normales:** transformada de Box-Muller sobre `Random.NextDouble()`.

```
Arquitectura del loop:
  Parallel.For(0..N_simulaciones) {
      thread-local: Random rng, double[] Z_indices[12]
      for cada paso: Z_indices[paso] = BoxMuller(rng)   // factor mercado
      for cada empresa:
          for cada paso: Z_propio = BoxMuller(rng)
                         precio *= exp(drift + diffusion * Z_accion)
      valoresPortafolio[sim] = suma ponderada
  }
```

Archivos principales:
- `src/Program.cs` — entrada, construcción de empresas, medición
- `src/MonteCarloSimulator.cs` — simulador base (empresa única, referencia)
- `src/DatosAccionesLoader.cs` — parser JSON, cálculo de μ/σ

### Piloto Python (`piloto-python/src/`)

**Stack:** Python 3.13 + NumPy (+ `numexpr` para la variante multi-hilo usada en el Benchmark 1).

**Estrategia de vectorización:** NumPy genera todas las variables aleatorias en bloque como arrays multidimensionales y opera sobre ellos con *ufuncs* compiladas en C, sin bucles Python. La variante con `numexpr` además compila la expresión completa del incremento logarítmico en un solo paso y la reparte entre hilos nativos.

```
Arquitectura vectorizada (sin bucles Python, broadcast sobre las N empresas):
  Z_indice = np.random.standard_normal((n_sim, 12, 1))      # shape (sim, pasos, 1)
  Z_propio = np.random.standard_normal((n_sim, 12, N))      # shape (sim, pasos, empresa)

  Z_accion = ρ · Z_indice + √(1-ρ²) · Z_propio                # broadcast sobre las N empresas
  incrementos = drift·Δt + diffusion·Z_accion                 # shape (sim, pasos, N)
  precios_finales = S0 · exp(sum(incrementos, axis=pasos))    # shape (sim, N)

  valor_portafolio = sum(precios_finales · cantidades, axis=empresa)
```

Archivos principales:
- `src/monte_carlo_python_numpy.py` — simulador vectorizado (NumPy puro)
- `src/monte_carlo_numexpr_experimento.py` — variante con `numexpr`, usada en el Benchmark 1 para los escenarios multi-núcleo y 1-núcleo
- `src/data_loader.py` — parser JSON, cálculo de μ/σ
- `src/api_simulador.py` — microservicio Flask que expone el motor vía HTTP

---

## 4. Benchmark 1 — Cómputo puro: C# vs Python en 4 escenarios

**Scripts:** `run_benchmark_escalable.py` orquesta las corridas; `piloto-csharp/src/Program.cs` mide con `Stopwatch` y `piloto-python/src/monte_carlo_numexpr_experimento.py` mide con `time.time()`, ambos alrededor únicamente de la simulación en sí — sin arranque de proceso ni carga de datos históricos (ese costo se trata aparte en el Benchmark 2, que evalúa el mecanismo de integración).

**Qué se compara:** el mismo modelo (GBM correlacionado con un factor de mercado único, 3.000 simulaciones, 12 pasos mensuales, N empresas) corrido en cuatro variantes, cruzando lenguaje y núcleos disponibles:

| Variante | Paralelismo | Escenario que representa |
|---|---|---|
| **C# — multi-núcleo** | `Parallel.For` sin límite (usa los 22 hilos lógicos de la máquina de desarrollo) | Hosting con varias CPUs |
| **C# — 1 núcleo** | `Parallel.For` con `MaxDegreeOfParallelism=1` | Hosting con 1 sola CPU (p. ej. free tier) |
| **Python — multi-núcleo** | NumPy vectorizado (sin bucles Python) + `numexpr` para el tramo elemento-a-elemento, que reparte el cómputo entre hilos nativos | Hosting con varias CPUs |
| **Python — 1 núcleo** | Igual, con `NUMEXPR_NUM_THREADS=1` | Hosting con 1 sola CPU |

En las cuatro variantes, los parámetros por empresa (`ρ, μ, σ, S₀, cantidad`) se arman como vectores NumPy y todas las operaciones broadcastean sobre el eje `(num_simulaciones, pasos, num_empresas)` en una sola pasada, sin iterar en Python. La variante `numexpr` además compila la expresión completa del incremento logarítmico (`(μ − ½σ²)·Δt + σ·√Δt·Z`) y la evalúa en un solo paso, evitando los arrays temporarios intermedios que NumPy crea por cada operación — una ganancia que existe con o sin paralelismo disponible, y que se suma al reparto entre núcleos cuando hay más de uno.

**Reproducibilidad a otra escala:** la cantidad de simulaciones no está hardcodeada — es un argumento opcional en `Program.cs`, `monte_carlo_numexpr_experimento.py` y `run_benchmark_escalable.py` (default: 3.000, la escala real de `motor-simulacion/`). Si el sistema cambia `N_SIMULACIONES` en el futuro, `python run_benchmark_escalable.py <nuevo_N>` reproduce esta misma comparación a la nueva escala sin tocar código — el estudio funciona como metodología reutilizable para evaluar la tecnología conveniente si el proyecto necesita escalar, no solo como veredicto puntual.

### Resultados — tiempo de simulación pura por N (2 iteraciones por punto, promedio, 3.000 simulaciones)

| N empresas | C# multi-núcleo | C# 1 núcleo | Python multi-núcleo | Python 1 núcleo |
|---|---|---|---|---|
| 1 | 0.0293 s | 0.0243 s | 0.0060 s | 0.0040 s |
| 5 | 0.0345 s | 0.0349 s | 0.0106 s | 0.0119 s |
| 10 | 0.0400 s | 0.0543 s | 0.0187 s | 0.0212 s |
| 20 | 0.0519 s | 0.0782 s | 0.0300 s | 0.0354 s |

### Comparación por escenario de hosting

| N | Multi-núcleo — factor y ganador | 1 núcleo — factor y ganador |
|---|---|---|
| 1 | 4.88x — Python | 6.15x — Python |
| 5 | 3.27x — Python | 2.93x — Python |
| 10 | 2.14x — Python | 2.56x — Python |
| 20 | 1.73x — Python | 2.20x — Python |

### Análisis

A la escala real del sistema (3.000 simulaciones), **Python (NumPy + numexpr) es más rápido que C# en los 8 puntos medidos**, sin excepción — a diferencia de la corrida a 10.000 simulaciones (ver más abajo), donde C# ganaba en el escenario multi-núcleo con N=20. La ventaja es más marcada en portfolios chicos (4.9x–6.2x en N=1) y se mantiene sostenida (1.7x–2.9x) en el resto del rango, tanto en multi-núcleo como en 1 CPU.

### numexpr vs NumPy plano — ¿es numexpr lo que gana, o Python en general?

La sección anterior compara **Python+numexpr** contra C#. Para aislar cuánto de esa ventaja viene específicamente de `numexpr` (y no de Python/NumPy en general), el harness también corre la misma comparación puertas adentro de Python: NumPy plano vs NumPy+numexpr, con el modelo del piloto (batcheado sobre N empresas, expresión fusionada de 6 arrays).

| N | Multi-núcleo — factor y ganador | 1 núcleo — factor y ganador |
|---|---|---|
| 1 | 7.00x — numexpr | 10.08x — numexpr |
| 5 | 4.85x — numexpr | 4.27x — numexpr |
| 10 | 3.20x — numexpr | 2.90x — numexpr |
| 20 | 2.60x — numexpr | 2.19x — numexpr |

Dentro del modelo del piloto, `numexpr` gana siempre y por márgenes grandes — tanto con hilos disponibles como limitado a uno solo, lo que confirma que buena parte de la ganancia viene de la fusión de kernels (evitar arrays temporarios), no solo del paralelismo.

**Esta comparación no responde si conviene agregar `numexpr` al motor real (`motor-simulacion/app/simulacion/acciones.py`).** Usa el modelo del piloto: una expresión que fusiona 6 arrays (`ρ, μ, σ, S₀` de N empresas + shocks), batcheada sobre el eje de empresas. `acciones.py` simula **una acción a la vez**, con una expresión de 2 operaciones (`drift + difusion * z_matrix`) — mucho más simple, y sin ningún batcheo entre instrumentos.

Para esa pregunta se armó un benchmark aparte, fuera de `estudio-pilotos/`: [`motor-simulacion/benchmarks/bench_numexpr_acciones.py`](../motor-simulacion/benchmarks/bench_numexpr_acciones.py). No reimplementa el modelo — **importa `simular_accion_vectorizado` directamente de `acciones.py`** y la compara contra una variante con numexpr, verificando primero que ambas den resultados idénticos (`np.allclose`) antes de medir tiempos. Barre `N_SIMULACIONES` y `T_meses` (1–60, el rango real de `HorizonteMeses`), así se puede volver a correr cada vez que se considere cambiar la escala:

```powershell
cd motor-simulacion
python benchmarks/bench_numexpr_acciones.py
# o con otros valores: --n-sim 1000 3000 5000 --t-meses 12 24 36 60
```

| N_SIMULACIONES | T=12 | T=24 | T=36 | T=60 |
|---|---|---|---|---|
| 1.000 | actual 4.67x | actual 3.14x | numexpr 1.12x | actual 1.43x |
| **3.000 (actual)** | **actual 1.63x** | **actual 1.19x** | **actual 1.06x** | **actual 1.01x** |
| 5.000 | actual 1.33x | numexpr 1.16x | numexpr 1.05x | numexpr 1.07x |
| 10.000 | actual 1.17x | numexpr 1.08x | actual 1.06x | numexpr 1.06x |
| 20.000 | numexpr 1.06x | actual 1.13x | numexpr 1.06x | numexpr 1.12x |

A `N_SIMULACIONES=3.000` (el valor actual), la implementación de producción gana o empata en los cuatro `T_meses` medidos — nunca por mucho margen, pero nunca a favor de numexpr tampoco. El cruce aparece recién entre N=5.000 y N=10.000 según `T_meses`, y con márgenes chicos (1.05x–1.17x) que en varias celdas están cerca del ruido de medición. **Conclusión: a la escala actual no conviene tocar `acciones.py`.** Si en el futuro se sube `N_SIMULACIONES` por encima de ~5.000, vale la pena volver a correr este benchmark — a diferencia de la comparación C# vs Python (Sección 6), esta decisión sí depende directamente de la escala real de producción, no es una elección estable de una vez.

---

## 5. Benchmark 2 — Costo de integración

**Script:** `run_benchmark_integracion.py`  
**Objetivo:** separar el overhead del mecanismo de integración del costo real de simulación, y determinar qué mecanismo es óptimo para integrar el motor Python en la aplicación .NET.

*(Este benchmark compara únicamente mecanismos para integrar el motor Python — no vuelve a comparar contra C#, eso ya se cubrió en el Benchmark 1.)*

### Mecanismos evaluados

| Mecanismo | Descripción |
|---|---|
| **Subprocess Python** | Lanzar `python monte_carlo_python_numpy.py N` por cada request |
| **HTTP (microservicio Flask)** | Servidor Python persistente con datos pre-cargados; se hace POST a `/simular` |

### Overhead de integración (sin simulación)

| Mecanismo | Overhead medido |
|---|---|
| Python startup (sin NumPy) | 48.6 ms |
| Python startup + import NumPy | 227.8 ms |
| HTTP round-trip `/ping` (loopback) | 11.8 ms |

### Tiempos totales por N (3.000 simulaciones)

| N | Subprocess Python | HTTP Flask | Sim. pura (server) |
|---|---|---|---|
| 1 | 322.8 ms | **24.8 ms** | 12.1 ms |
| 5 | 326.7 ms | **24.8 ms** | 14.7 ms |
| 10 | 335.3 ms | **36.7 ms** | 23.3 ms |
| 20 | 359.5 ms | **49.2 ms** | 40.7 ms |

*(Los valores absolutos pueden variar según la máquina y su carga de fondo en el momento de la corrida; lo estable entre corridas es el punto cualitativo: HTTP siempre por debajo de subprocess.)*

### Desglose: overhead vs simulación

| N | Sub. overhead | HTTP overhead |
|---|---|---|
| 1 | 96% del tiempo total | 51% del tiempo total |
| 5 | 95% del tiempo total | 41% del tiempo total |
| 10 | 93% del tiempo total | 37% del tiempo total |
| 20 | 89% del tiempo total | 17% del tiempo total |

### Punto de cruce

- **HTTP supera a Subprocess Python desde N=1** — en todo el rango evaluado.
- El overhead HTTP (~12ms fijo) es muy inferior al costo de relanzar el proceso Python en cada request (~228ms de arranque con NumPy importado), incluso para portfolios de una sola empresa.

### Análisis del mecanismo HTTP

El microservicio Flask carga los datos históricos y calcula μ/σ/S₀ una única vez al arrancar, simulando el patrón de caché diario propuesto en la arquitectura de producción. Cada request paga únicamente:

```
costo_request = overhead_HTTP (~12ms) + simulacion_pura (12.1–40.7ms según N)
```

Comparado con el costo de relanzar el proceso en cada request:

```
costo_subprocess = startup_Python + NumPy (~228ms) + carga_JSON + calculo_params + simulacion
```

El ahorro del microservicio se mantiene estable en **~298–310ms por request** en todo el rango de N — a diferencia del cómputo puro (Benchmark 1), acá el costo fijo de arrancar Python + NumPy domina sobre el costo de simulación incluso en el extremo superior del rango (N=20), así que el ahorro no se diluye con N como en la corrida anterior a 10.000 simulaciones.

---

## 6. Conclusiones y justificación de diseño

### Por qué Python/NumPy para el motor de simulación

La elección de Python respondió a preferencia personal y a su relevancia en el área de finanzas cuantitativas y ciencia de datos: NumPy, pandas y Jupyter son estándar de facto en research financiero, y existen librerías especializadas (QuantLib-Python, statsmodels, scikit-learn) que amplían el alcance del simulador para extensiones futuras. No fue, en el momento de tomar la decisión, una elección basada en benchmarks de performance — este estudio se hizo *después*, para validar que esa preferencia no introdujera un costo de performance inaceptable.

El resultado de esa validación (Secciones 4 y 5):

1. **El cómputo puro no es un problema — Python resultó más rápido que C# en todos los escenarios medidos.** El Benchmark 1 compara C# y Python (NumPy vectorizado + numexpr) en cuatro escenarios de paralelismo disponible, a la escala real del sistema (3.000 simulaciones): Python gana en los 8 puntos medidos, con ventajas de hasta 6.2x en portfolios chicos y 1.7x–2.9x sostenido en el resto del rango. Esto es cómputo puro Python vs C# — no implica que agregar `numexpr` al motor real ayude: medido directo contra `acciones.py` (Sección 4, `benchmarks/bench_numexpr_acciones.py`), a la escala actual (N=3.000) NumPy plano gana o empata en todo el rango de `T_meses`.

2. **Ecosistema científico:** NumPy, SciPy y pandas ofrecen primitivas financieras que C# no tiene nativamente (percentiles, distribuciones, álgebra lineal densa), relevantes para extensiones futuras del simulador.

### Por qué microservicio HTTP en lugar de subprocess

1. **Overhead amortizado:** el servidor Flask paga el costo de startup y carga de datos una sola vez. Cada request posterior paga solo ~12ms de IPC vs ~228ms de startup por subprocess.

2. **Desacoplamiento:** el motor de simulación se convierte en un servicio independiente con interfaz HTTP limpia (`POST /simular`), invocable desde cualquier cliente (.NET, JavaScript, tests) sin acoplamiento de runtime.

3. **Costo de integración cuantificado:** con el mecanismo HTTP, el overhead de integración representa el 17%–51% del tiempo total según N, vs 89%–96% para subprocess.

### Limitaciones del prototipo académico

- Se consideró un único tipo de instrumentos para todos los portfolios.
- Los benchmarks miden wall-clock time, que incluye variabilidad del SO y de la carga de fondo de la máquina. Los valores son promedios de 2 iteraciones por punto en el Benchmark 1 y 5 iteraciones en el Benchmark 2.

---

## 7. Estructura de archivos del proyecto

```
ProyectoFinal-SimuladorFinanciero/
│
├── DatosAccionesDiaria.json          # Serie histórica IBM (2520 días, Alpha Vantage)
├── DatosAcciones2.json               # Dataset alternativo
│
├── run_benchmark_escalable.py        # Benchmark 1: C# vs Python (4 escenarios) por N empresas
├── run_benchmark_integracion.py      # Benchmark 2: Subprocess vs HTTP (motor Python)
│
├── benchmark_escalabilidad.json      # Resultados benchmark 1
├── benchmark_integracion.json        # Resultados benchmark 2
├── benchmark_report.json             # Resultados benchmark original (referencia)
│
├── piloto-csharp/
│   ├── MonteCarlosPilot.csproj       # .NET 8.0, Nullable enabled
│   └── src/
│       ├── Program.cs                # Entrada principal, Parallel.For escalable
│       ├── MonteCarloSimulator.cs    # Simulador base empresa única (referencia)
│       └── DatosAccionesLoader.cs    # Parser JSON, calculo mu/sigma
│
├── piloto-python/
│   └── src/
│       ├── monte_carlo_python_numpy.py       # Motor vectorizado NumPy (N empresas)
│       ├── monte_carlo_numexpr_experimento.py # Variante NumPy + numexpr (Benchmark 1)
│       ├── data_loader.py                    # Parser JSON, calculo mu/sigma
│       └── api_simulador.py                  # Microservicio Flask (/ping, /simular)
│
└── INFORME_BENCHMARKS.md             # Este documento
```

Además, fuera de `estudio-pilotos/` (en `motor-simulacion/benchmarks/`) vive `bench_numexpr_acciones.py` — el benchmark que compara la función real de producción (`app/simulacion/acciones.py`) contra una variante con numexpr, barriendo `N_SIMULACIONES` y `T_meses`. No reimplementa el modelo: importa la función real y verifica equivalencia numérica antes de medir (ver Sección 4). Requiere `numexpr` (listado en `requirements-dev.txt`, no es dependencia de producción).
