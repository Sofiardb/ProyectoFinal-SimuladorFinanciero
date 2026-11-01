"""
Backtesting: comparación de resultados simulados vs. resultados reales en ventanas de 2 y 3 meses.

Idea: "viajar al pasado". Para cada fecha de origen t0 se calibra el modelo SOLO con información
disponible en t0, se simula el horizonte h (2 o 3 meses) con N = 15000 trayectorias (el N_SIMULACIONES del motor) usando las
funciones reales del motor, y se compara con lo que efectivamente ocurrió en t0 + h.

Qué se evalúa (calibración probabilística, no "acertar el número"):
  - Cobertura: % de veces que el valor real cayó dentro de [p25, p75] (esperado ~50%)
    y dentro de [p5, p95] (esperado ~90%) / [mín, máx] de lo simulado.
  - Rango percentil (PIT) del valor real dentro de la distribución simulada: si el modelo
    está bien calibrado, debe distribuirse uniforme en [0, 100].
  - Error de la mediana: (mediana simulada - real) / real.

Partes:
  A. Inflación argentina (motor de escenarios: afecta CER/UVA, LECER, bonos CER, PF UVA y
     todas las "ganancias reales"). Datos: INDEC, IPC Nacional, variación mensual
     (serie 145.3_INGNACUAL_DICI_M_38, datos.gob.ar), en benchmarks/datos/.
  B. Acciones (GBM). Datos: IBM diario de Alpha Vantage (misma fuente que el backend),
     calibración con 10 años de retornos log diarios (igual que AccionCatalogoService).

Uso (desde motor-simulacion/): python -m benchmarks.backtesting
Salida: benchmarks/resultados/backtesting.json
"""
import csv
import json
from datetime import date
from pathlib import Path

import numpy as np

import app.simulacion.orquestador as orq
from app.simulacion.acciones import simular_accion_vectorizado
from benchmarks.estudio_convergencia import ESCENARIOS

DATOS = Path(__file__).parent / "datos"
N = 15000
HORIZONTES = [2, 3]


# ----------------------------------------------------------------------------- A. inflación
def cargar_ipc():
    with open(DATOS / "ipc_nacional_mensual.csv") as f:
        filas = list(csv.DictReader(f))
    return [r["indice_tiempo"][:7] for r in filas], np.array([float(r["ipc_ng_nacional_tasa_variacion_mensual"]) for r in filas])


def escenario_de(pi_media):
    for nombre, e in ESCENARIOS.items():
        if e["inflacion_mensual_min"] <= pi_media < e["inflacion_mensual_max"]:
            return nombre
    return "fuera_de_rango_alto" if pi_media >= ESCENARIOS["desfavorable"]["inflacion_mensual_max"] else "fuera_de_rango_bajo"


def backtest_inflacion():
    meses, pi = cargar_ipc()
    out = {}
    for h in HORIZONTES:
        # distribución simulada de inflación acumulada a h meses: se usa el orquestador real
        # (portfolio con un solo PF UVA, irrelevante para la inflación) y se toma su salida.
        res = orq.simular_portfolio({"T_meses": h, "escenarios": ESCENARIOS, "instrumentos": [
            {"id": "x", "tipo": "plazo_fijo_tradicional", "monto": 1.0, "tna": 0.3, "t_venc_meses": 1, "reinvertir": True}]})
        g = res["inflacion_acumulada"]["global"]
        sim = {k: g[k][-1] - 1 for k in ("p25", "mediana", "p75", "minimo", "maximo")}
        # réplica exacta del muestreo del motor para obtener la distribución completa (PIT)
        rng = np.random.default_rng(123)
        n3 = N // 3
        m = np.vstack([rng.uniform(e["inflacion_mensual_min"], e["inflacion_mensual_max"], (n, h))
                       for e, n in zip(ESCENARIOS.values(), (n3, n3, N - 2 * n3))])
        dist = np.prod(1 + m, axis=1) - 1
        dist_esc = {"favorable": dist[:n3], "moderado": dist[n3:2 * n3], "desfavorable": dist[2 * n3:]}
        p5, p95 = np.percentile(dist, [5, 95])

        ventanas = []
        for i in range(len(pi) - h + 1):
            real = float(np.prod(1 + pi[i:i + h]) - 1)
            ventanas.append({
                "desde": meses[i], "hasta": meses[i + h - 1], "real": real,
                "pit": float(100 * np.mean(dist <= real)),
                "en_p25_p75": sim["p25"] <= real <= sim["p75"],
                "en_p5_p95": p5 <= real <= p95,
                "en_min_max": sim["minimo"] <= real <= sim["maximo"],
                "escenario_real": escenario_de((1 + real) ** (1 / h) - 1),
                "error_mediana_pp": 100 * (sim["mediana"] - real),
            })
            esc = ventanas[-1]["escenario_real"]
            if esc in dist_esc:   # evaluación condicional: ¿el escenario que ocurrió contenía al real?
                d = dist_esc[esc]
                q25, q75 = np.percentile(d, [25, 75])
                ventanas[-1].update({"pit_en_escenario": float(100 * np.mean(d <= real)),
                                     "en_p25_p75_escenario": bool(q25 <= real <= q75),
                                     "en_min_max_escenario": bool(d.min() <= real <= d.max())})
        out[f"h{h}"] = {"simulado": {**sim, "p5": p5, "p95": p95}, "ventanas": ventanas}
    return out


# ----------------------------------------------------------------------------- B. acciones
def cargar_precios():
    d = json.loads((DATOS / "ibm_diario_alphavantage.json").read_text())["Time Series (Daily)"]
    fechas = sorted(d)
    return [date.fromisoformat(x) for x in fechas], np.array([float(d[x]["4. close"]) for x in fechas])


def backtest_acciones(lookback_anios=10):
    fechas, px = cargar_precios()
    logret = np.diff(np.log(px))
    # último día hábil de cada mes
    fin_mes = [i for i in range(len(fechas) - 1) if fechas[i + 1].month != fechas[i].month]
    out = {}
    for h in HORIZONTES:
        filas = []
        for j, i0 in enumerate(fin_mes):
            if j + h >= len(fin_mes):
                break
            i1 = fin_mes[j + h]
            desde = i0 - 252 * lookback_anios
            if desde < 0:
                continue
            r = logret[desde:i0]                  # sólo información disponible en t0
            sigma = r.std(ddof=1) * np.sqrt(252)
            mu = r.mean() * 252 + sigma**2 / 2      # misma estimación que el backend (media log = mu - sigma^2/2)
            rng = np.random.default_rng(1_000 + j)
            tray = simular_accion_vectorizado(1.0, mu, sigma, h, rng.standard_normal((N, h)))
            final = tray[:, -1]
            real = px[i1] / px[i0]
            p5, p25, p50, p75, p95 = np.percentile(final, [5, 25, 50, 75, 95])
            filas.append({
                "origen": fechas[i0].isoformat(), "fin": fechas[i1].isoformat(),
                "mu": mu, "sigma": sigma, "retorno_real": real - 1,
                "p5": p5 - 1, "p25": p25 - 1, "mediana": p50 - 1, "p75": p75 - 1, "p95": p95 - 1,
                "pit": float(100 * np.mean(final <= real)),
                "en_p25_p75": bool(p25 <= real <= p75), "en_p5_p95": bool(p5 <= real <= p95),
                "en_min_max": bool(final.min() <= real <= final.max()),
            })
        out[f"h{h}"] = filas
    return out


def resumen_cobertura(filas, paso):
    """Cobertura sobre ventanas NO superpuestas (cada `paso` meses) para que las observaciones
    sean independientes, con intervalo de confianza binomial (Wilson, 95%)."""
    sub = filas[::paso]
    n = len(sub)
    res = {"n_ventanas": n}
    for clave in ("en_p25_p75", "en_p5_p95", "en_min_max"):
        k = sum(f[clave] for f in sub)
        p = k / n
        z = 1.96
        centro = (p + z**2 / (2 * n)) / (1 + z**2 / n)
        semi = z * np.sqrt(p * (1 - p) / n + z**2 / (4 * n**2)) / (1 + z**2 / n)
        res[clave] = {"cobertura": p, "ic95": [centro - semi, centro + semi]}
    return res


def main():
    infl = backtest_inflacion()
    acc = backtest_acciones()
    resumen = {}
    for h in HORIZONTES:
        v = infl[f"h{h}"]["ventanas"]
        regimen_actual = [x for x in v if x["desde"] >= "2024-06"]
        resumen[f"inflacion_h{h}_historia_completa"] = resumen_cobertura(v, h)
        resumen[f"inflacion_h{h}_desde_2024_06"] = resumen_cobertura(regimen_actual, 1)
        resumen[f"acciones_h{h}"] = resumen_cobertura(acc[f"h{h}"], h)
        resumen[f"acciones_h{h}"]["pit_hist_deciles"] = np.histogram(
            [f["pit"] for f in acc[f"h{h}"]], bins=10, range=(0, 100))[0].tolist()
    salida = Path(__file__).parent / "resultados"
    salida.mkdir(exist_ok=True)
    (salida / "backtesting.json").write_text(json.dumps(
        {"resumen": resumen, "inflacion": infl, "acciones": acc}, indent=1, default=float))
    print(json.dumps(resumen, indent=1, default=float))


if __name__ == "__main__":
    main()
