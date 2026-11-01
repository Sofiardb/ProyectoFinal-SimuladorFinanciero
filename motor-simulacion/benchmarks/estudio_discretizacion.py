"""
Estudio de esquemas de discretización para el GBM de acciones.

    dS = mu * S dt + sigma * S dW          (ecuación diferencial ESTOCÁSTICA)

Se comparan, con paso mensual (dt = 1/12, el que usa el motor) y los MISMOS incrementos
brownianos:

  1. Exacta / log-Euler (la implementada en app/simulacion/acciones.py):
         S_{k+1} = S_k * exp((mu - sigma^2/2) dt + sigma sqrt(dt) Z_k)
     Aplicar Euler-Maruyama a X = ln S (lema de Itô) da un esquema SIN error de
     discretización para GBM con mu y sigma constantes: reproduce exactamente la
     distribución lognormal en cada fecha de la grilla.
  2. Euler-Maruyama sobre S:
         S_{k+1} = S_k * (1 + mu dt + sigma sqrt(dt) Z_k)
  3. Milstein sobre S:
         S_{k+1} = S_k * (1 + mu dt + sigma sqrt(dt) Z_k + 0.5 sigma^2 dt (Z_k^2 - 1))

Se reporta, contra la solución analítica lognormal:
  - error débil (media, mediana, p5, p95, desvío) en % del valor analítico
  - error fuerte (E|S_T^esquema - S_T^exacto| / S0), trayectoria a trayectoria
  - probabilidad de precio <= 0 (imposible en la realidad)
  - costo: pasos necesarios para que Euler iguale la precisión de la exacta

Uso (desde motor-simulacion/):  python -m benchmarks.estudio_discretizacion
Salida: benchmarks/resultados/discretizacion.json
"""
import json
from pathlib import Path

import numpy as np
from scipy.stats import norm

CASOS = {
    "baja_vol (SPY: mu=10%, sigma=18%)":   (0.10, 0.18),
    "media_vol (AAPL: mu=20%, sigma=30%)": (0.20, 0.30),
    "alta_vol (NVDA: mu=35%, sigma=50%)":  (0.35, 0.50),
    "extrema (TSLA: mu=25%, sigma=60%)":   (0.25, 0.60),
}
HORIZONTES = [12, 36]
N = 1_000_000
SEMILLA = 20260927


def analitico(mu, sigma, T):
    m, s = (mu - 0.5 * sigma**2) * T, sigma * np.sqrt(T)
    return {
        "media":   np.exp(mu * T),
        "mediana": np.exp(m),
        "p5":      np.exp(m + s * norm.ppf(0.05)),
        "p95":     np.exp(m + s * norm.ppf(0.95)),
        "desvio":  np.sqrt(np.exp(2 * mu * T) * (np.exp(sigma**2 * T) - 1)),
    }


def simular(mu, sigma, meses, pasos_por_mes, rng, n):
    dt = 1 / (12 * pasos_por_mes)
    k = meses * pasos_por_mes
    ln_ex = np.zeros(n)
    s_eu = np.ones(n)
    s_mi = np.ones(n)
    neg_eu = np.zeros(n, bool)
    for _ in range(k):
        z = rng.standard_normal(n)
        ln_ex += (mu - 0.5 * sigma**2) * dt + sigma * np.sqrt(dt) * z
        s_eu *= 1 + mu * dt + sigma * np.sqrt(dt) * z
        s_mi *= 1 + mu * dt + sigma * np.sqrt(dt) * z + 0.5 * sigma**2 * dt * (z**2 - 1)
        neg_eu |= s_eu <= 0
    return np.exp(ln_ex), s_eu, s_mi, neg_eu


def resumen(x):
    return {"media": x.mean(), "mediana": np.median(x), "p5": np.percentile(x, 5),
            "p95": np.percentile(x, 95), "desvio": x.std()}


def main():
    out = {}
    for nombre, (mu, sigma) in CASOS.items():
        for T in HORIZONTES:
            rng = np.random.default_rng(SEMILLA)
            ex, eu, mi, neg = simular(mu, sigma, T, 1, rng, N)
            ana = analitico(mu, sigma, T / 12)
            fila = {"analitico": ana}
            for etiqueta, x in (("exacta", ex), ("euler", eu), ("milstein", mi)):
                r = resumen(x)
                fila[etiqueta] = {
                    "valores": r,
                    "error_debil_pct": {k: 100 * (r[k] - ana[k]) / ana[k] for k in r},
                    "error_fuerte_pct": 100 * float(np.mean(np.abs(x - ex))),
                }
            fila["euler"]["prob_precio_no_positivo"] = float(neg.mean())
            # ¿cuántos sub-pasos por mes necesita Euler para bajar el error fuerte a < 0,5%?
            conv = {}
            for ppm in (1, 4, 21):   # mensual, semanal, diario hábil
                rng = np.random.default_rng(SEMILLA + ppm)
                ex2, eu2, _, _ = simular(mu, sigma, T, ppm, rng, 200_000)
                conv[ppm] = {"error_fuerte_pct": 100 * float(np.mean(np.abs(eu2 - ex2))),
                             "error_mediana_pct": 100 * float((np.median(eu2) - ana["mediana"]) / ana["mediana"])}
            fila["euler_refinado"] = conv
            out[f"{nombre} | T={T}m"] = fila
            print(nombre, T, "Euler err fuerte %.2f%%  err mediana %.2f%%  P(S<=0)=%.2e" % (
                fila["euler"]["error_fuerte_pct"], fila["euler"]["error_debil_pct"]["mediana"],
                fila["euler"]["prob_precio_no_positivo"]))

    salida = Path(__file__).parent / "resultados"
    salida.mkdir(exist_ok=True)
    (salida / "discretizacion.json").write_text(json.dumps(out, indent=1, default=float))


if __name__ == "__main__":
    main()
