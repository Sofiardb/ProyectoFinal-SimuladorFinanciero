# Estudios numéricos del motor (respuesta a observaciones del Estado de Avance)

Scripts que ejecutan las funciones reales del motor (`app/simulacion/*`) para sustentar con datos
las decisiones numéricas. Se corren desde `motor-simulacion/` (requieren `numpy`, `scipy`, `matplotlib`).

| Script | Qué responde | Salida en `resultados/` |
|---|---|---|
| `estudio_convergencia.py` | ¿Qué N usar? (3000 original → 15000 → 51000 adoptado) Error de Monte Carlo vs N (300 a 30 000), 150 semillas por N, 3 portfolios tipo × 2 horizontes (12 y 36 meses) | `conv_T*.json` |
| `analizar_convergencia.py` | Tablas y gráficos del estudio anterior | `convergencia_tabla.json`, `convergencia_resumen.json`, `fig_convergencia_mediana.png`, `fig_criterio_N.png` |
| `extender_convergencia.py` | Extiende el estudio de convergencia a N = 60 000 y 100 000 (mismas semillas y referencia) y une los resultados a `conv_T*.json` | `conv_T*.json` |
| `criterio_convergencia.py` | Peor error / ancho p25–p75 por N, ajuste c/√N, verificación de la fórmula del percentil, N para cada criterio; Figura 2 del informe | `criterio_convergencia.json`, `fig_criterio_N.png` |
| `costo_por_N.py` | Tiempo y memoria máxima del motor por N (3 000 a 300 000, T = 36) | `costo_por_N.json` |
| `descargar_series.py` | Descarga precios ajustados de Alpha Vantage (misma key y endpoint que el backend). Requiere internet | `datos/<ticker>_diario_ajustado.json` |
| `backtesting_reciente.py` | Backtesting de los últimos 5 años con acciones de referencia (IBM, KO, NVDA), calibración con 10 años | `backtesting_reciente.json`, `fig_backtesting_reciente.png` |
| `estudio_discretizacion.py` | ¿Euler? Exacta (log-Euler) vs Euler-Maruyama vs Milstein para el GBM, paso mensual | `discretizacion.json` |
| `estudio_semilla.py` | Reproducibilidad por semilla, tests KS / autocorrelación del PCG64, colisiones de semillas | `semilla.json` |
| `backtesting.py` | Simulado vs real en ventanas de 2 y 3 meses (inflación INDEC e IBM) | `backtesting.json` |
| `graficos_discretizacion_backtesting.py` | Gráficos de los dos estudios anteriores | `fig_discretizacion.png`, `fig_backtesting.png` |

Orden sugerido:

```bash
python -m benchmarks.estudio_convergencia --T 12 36     # ~40 min en 2 núcleos
python -m benchmarks.analizar_convergencia
python -m benchmarks.estudio_discretizacion             # ~2 min
python -m benchmarks.estudio_semilla
python -m benchmarks.backtesting
python -m benchmarks.graficos_discretizacion_backtesting
```

Datos en `datos/`: IPC Nacional INDEC variación mensual (serie `145.3_INGNACUAL_DICI_M_38` de
datos.gob.ar, ene-2017 a ago-2026) e IBM diario de Alpha Vantage (copia de `estudio-pilotos/`).

## Prueba prospectiva (simulaciones de control)

`control_prospectivo.py` compara simulaciones lanzadas hoy con los valores reales al vencer el horizonte.
Simulaciones de control lanzadas el 27/09/2026 (portfolios 17, 18 y 19):

| Portfolio | 2 meses (comparar 27/11/2026) | 3 meses (comparar 27/12/2026) |
|---|---|---|
| Control 2026-09 Conservador (id 17) | 24 | 25 |
| Control 2026-09 Moderado (id 18) | 26 | 27 |
| Control 2026-09 Agresivo (id 19) | 28 | 29 |

```bash
python -m benchmarks.control_prospectivo registrar --simulaciones 24 25 26 27 28 29   # una vez, ahora
python -m benchmarks.control_prospectivo comparar                                      # en cada fecha final
python -m benchmarks.control_prospectivo comparar --inflacion 0.021 0.019 0.02 --uva <UVA_27-09> <UVA_final>
```

Importante: no borrar ni modificar esos portfolios hasta terminar la comparación — el script lee
de ellos el precio actual de cada tenencia.
