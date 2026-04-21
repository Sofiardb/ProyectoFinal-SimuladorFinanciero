# Informe de Benchmarks — Simulador Financiero Monte Carlo

**Autora:** Sofia Rodriguez del Busto  
**Fecha:** Abril 2026  
**Contexto:** Proyecto Final — Evaluación de motores de simulación para integración en aplicación web (React / .NET / PostgreSQL)

---

## 1. Objetivo

Evaluar el rendimiento comparativo de dos implementaciones del motor de simulación Monte Carlo (C# y Python/NumPy) para determinar qué tecnología adoptar como backend de simulación, y cuantificar el costo de los distintos mecanismos de integración disponibles (subprocess y microservicio HTTP).

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
| Simulaciones | 10.000 |
| Acciones por empresa | 100 |
| N empresas evaluadas | 1, 5, 10, 20 |

---

## 3. Arquitectura de los pilotos

### Piloto C# (`piloto-csharp/`)

**Stack:** .NET 8.0, C# con `Parallel.For` y `Random` thread-local.

**Estrategia de paralelismo:** cada simulación se ejecuta en un hilo independiente del `ThreadPool`. Cada hilo tiene su propia instancia de `Random` inicializada con `Guid.NewGuid().GetHashCode()` para evitar contención y garantizar independencia estadística.

**Generación de normales:** transformada de Box-Muller sobre `Random.NextDouble()`.

```
Arquitectura del loop:
  Parallel.For(0..10000) {
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

**Stack:** Python 3.13 + NumPy.

**Estrategia de vectorización:** NumPy genera todas las variables aleatorias en bloque como arrays multidimensionales y opera sobre ellos sin bucles Python internos (delega a BLAS/LAPACK en C compilado).

```
Arquitectura vectorizada:
  Z_indice = np.random.standard_normal((10000, 12))      # shape (sim, pasos)
  Z_propio = np.random.standard_normal((10000, 12, N))   # shape (sim, pasos, empresa)

  for cada empresa i:
      Z_accion = ρᵢ · Z_indice + √(1-ρᵢ²) · Z_propio[:,:,i]
      incrementos = drift·Δt + diffusion·Z_accion
      precios_finales[:,i] = S0 · exp(cumsum(incrementos, axis=1)[:,-1])

  valor_portafolio = sum(precios_finales · cantidades, axis=1)
```

Archivos principales:
- `src/monte_carlo_python_numpy.py` — simulador escalable vectorizado
- `src/data_loader.py` — parser JSON, cálculo de μ/σ
- `src/api_simulador.py` — microservicio Flask que expone el motor vía HTTP

---

## 4. Benchmark 1 — Escalabilidad (C# vs Python como procesos)

**Script:** `run_benchmark_escalable.py`  
**Metodología:** medición de tiempo de pared (wall-clock) de cada proceso completo, 2 iteraciones por N. Incluye startup del proceso, imports, carga de datos y simulación.

### Resultados

| N empresas | C# promedio | Python promedio | Factor | Ganador |
|---|---|---|---|---|
| 1 | 0.522 s | 0.153 s | 3.4x | Python |
| 5 | 0.520 s | 0.161 s | 3.2x | Python |
| 10 | 0.513 s | 0.179 s | 2.9x | Python |
| 20 | 0.542 s | 0.226 s | 2.4x | Python |

### Análisis

Python/NumPy supera a C# en todo el rango medido. El factor de ventaja se reduce con N porque la simulación escala linealmente en C# mientras que NumPy tiene un overhead fijo de inicialización de arrays que se amortiza con N.

**Observación importante:** estos tiempos incluyen el overhead de proceso (`dotnet run` ≈ 470ms; `python` + NumPy import ≈ 100ms). La simulación pura en C# con `Parallel.For` es del orden de 30ms para N=1 (medido internamente con `Stopwatch`). El benchmark de proceso favorece a Python porque su startup es más económico, no porque el cómputo de C# sea más lento en términos absolutos.

---

## 5. Benchmark 2 — Costo de integración

**Script:** `run_benchmark_integracion.py`  
**Objetivo:** separar el overhead del mecanismo de integración del costo real de simulación, y determinar qué mecanismo es óptimo para integrar el motor Python en la aplicación .NET.

### Mecanismos evaluados

| Mecanismo | Descripción |
|---|---|
| **Subprocess Python** | Lanzar `python monte_carlo_python_numpy.py N` desde C# por cada request |
| **HTTP (microservicio Flask)** | Servidor Python persistente con datos pre-cargados; C# hace POST a `/simular` |
| **C# subprocess** | `dotnet run` completo por cada request (baseline del piloto C#) |

### Overhead de integración (sin simulación)

| Mecanismo | Overhead medido |
|---|---|
| Python startup (sin NumPy) | 24.2 ms |
| Python startup + import NumPy | 100.0 ms |
| HTTP round-trip `/ping` (loopback) | 9.8 ms |

### Tiempos totales por N

| N | Subprocess Python | HTTP Flask | C# subprocess | Sim. pura (server) |
|---|---|---|---|---|
| 1 | 143.7 ms | **11.8 ms** | 503.5 ms | 4.9 ms |
| 5 | 153.5 ms | **27.0 ms** | 510.9 ms | 15.7 ms |
| 10 | 181.2 ms | **48.9 ms** | 527.9 ms | 34.3 ms |
| 20 | 212.5 ms | **86.2 ms** | 531.8 ms | 75.5 ms |

### Desglose: overhead vs simulación

| N | Sub. overhead | HTTP overhead |
|---|---|---|
| 1 | 97% del tiempo total | 58% del tiempo total |
| 5 | 90% del tiempo total | 42% del tiempo total |
| 10 | 81% del tiempo total | 30% del tiempo total |
| 20 | 64% del tiempo total | 12% del tiempo total |

### Punto de cruce

- **HTTP supera a C# subprocess desde N=1** — en todo el rango evaluado.
- **Subprocess Python supera a C# subprocess desde N=1** — también en todo el rango.
- El overhead HTTP (~10ms fijo) es absorbido por la ventaja de NumPy en simulación incluso para portfolios de una sola empresa.

### Análisis del mecanismo HTTP

El microservicio Flask carga los datos históricos y calcula μ/σ/S₀ una única vez al arrancar, simulando el patrón de caché diario propuesto en la arquitectura de producción. Cada request paga únicamente:

```
costo_request = overhead_HTTP (~10ms) + simulacion_pura (4.9–75.5ms según N)
```

Comparado con el costo de relanzar el proceso en cada request:

```
costo_subprocess = startup_Python (100ms) + carga_JSON (7ms) + calculo_params (2ms) + simulacion
```

El ahorro del microservicio es de aproximadamente **100–130ms fijos por request**, independientemente de N.

---

## 6. Conclusiones y justificación de diseño

### Por qué Python/NumPy para el motor de simulación

1. **Rendimiento medido:** Python/NumPy es 2.4x–3.4x más rápido que C# como proceso en el rango N=1..20. La ventaja proviene de la vectorización implícita de NumPy (BLAS/LAPACK), que opera sobre todos los 10.000 paths en paralelo sin overhead de interpretación Python.

2. **Escalabilidad favorable:** a medida que N crece, el cómputo matricial de NumPy escala sublinealmente (comparte operaciones entre empresas vía broadcasting), mientras que C# itera linealmente sobre empresas dentro de cada simulación.

3. **Ecosistema científico:** NumPy, SciPy y pandas ofrecen primitivas financieras que C# no tiene nativamente (percentiles, distribuciones, álgebra lineal densa), relevantes para extensiones futuras del simulador.

### Por qué microservicio HTTP en lugar de subprocess

1. **Overhead amortizado:** el servidor Flask paga el costo de startup y carga de datos una sola vez. Cada request posterior paga solo ~10ms de IPC vs ~100ms de startup por subprocess.

2. **Patrón de caché diario:** los parámetros μ, σ, S₀ calculados sobre datos históricos no cambian dentro del mismo día de trading. Cargarlos al arrancar el servidor y reutilizarlos por todos los usuarios es arquitectónicamente correcto y elimina recálculos redundantes.

3. **Desacoplamiento:** el motor de simulación se convierte en un servicio independiente con interfaz HTTP limpia (`POST /simular`), invocable desde cualquier cliente (.NET, JavaScript, tests) sin acoplamiento de runtime.

4. **Costo de integración cuantificado:** con el mecanismo HTTP, el overhead de integración representa el 12%–58% del tiempo total según N, vs 64%–97% para subprocess. Para N ≥ 10 (portfolios realistas), más del 70% del tiempo es cómputo útil.

### Limitaciones del prototipo académico


- La simulación no usa semilla fija, por lo que los resultados varían entre ejecuciones (comportamiento correcto para Monte Carlo).
- Los datos históricos son de IBM únicamente; el modelo de variación de parámetros por empresa (±0.5% en μ) es una simplificación para el cálculo del benchmark.
- El benchmark mide wall-clock time, que incluye variabilidad del SO. Los valores son promedios de 5 iteraciones.

---

## 7. Estructura de archivos del proyecto

```
ProyectoFinal-SimuladorFinanciero/
│
├── DatosAccionesDiaria.json          # Serie histórica IBM (2520 días, Alpha Vantage)
├── DatosAcciones2.json               # Dataset alternativo
│
├── run_benchmark_escalable.py        # Benchmark 1: C# vs Python por N empresas
├── run_benchmark_integracion.py      # Benchmark 2: Subprocess vs HTTP vs C# nativo
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
│       ├── monte_carlo_python_numpy.py  # Motor vectorizado NumPy (N empresas)
│       ├── data_loader.py               # Parser JSON, calculo mu/sigma
│       └── api_simulador.py             # Microservicio Flask (/ping, /simular)
│
└── INFORME_BENCHMARKS.md             # Este documento
```
