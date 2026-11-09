"""
Backtesting de acciones restringido a los últimos 5 años (horizonte máximo del motor).

Para cada acción de referencia y cada fecha de origen t0 dentro de los últimos 5 años de la serie:
  1. se calibran μ y σ con los 10 años previos a t0, con el mismo procedimiento que el backend;
  2. se simula el horizonte h (2 y 3 meses) con la función real del motor y N = 15.000 trayectorias,
     es decir, lo que el motor habría mostrado si se hubiera ejecutado en t0;
  3. se ubica el retorno que efectivamente ocurrió dentro de la distribución simulada.

Las ventanas no se superponen (una cada h meses) para que los casos sean independientes.
Se reporta la cobertura de las bandas p25–p75 (esperado 50 %) y p5–p95 (esperado 90 %) por acción
y en conjunto, con intervalo de confianza de Wilson al 95 %.

Datos: benchmarks/datos/<ticker>_diario_ajustado.json (descargar_series.py). Si para IBM sólo existe
la serie original (ibm_diario_alphavantage.json, precio de cierre sin ajustar), se usa esa.

Uso (desde motor-simulacion/):  python -m benchmarks.backtesting_reciente [--anios 5]
Salida: resultados/backtesting_reciente.json y resultados/fig_backtesting_reciente.png
"""
import argparse
import json
from datetime import date
from pathlib import Path

import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
import numpy as np

from app.simulacion.acciones import simular_accion_vectorizado

DATOS = Path(__file__).parent / "datos"
RES = Path(__file__).parent / "resultados"
N = 15_000
HORIZONTES = [2, 3]
LOOKBACK_ANIOS = 10


def cargar_series():
    series = {}
    for f in sorted(DATOS.glob("*_diario_ajustado.json")):
        d = json.loads(f.read_text())
        series[d["ticker"]] = (d["precios"], d["fuente"])
    if "IBM" not in series and (DATOS / "ibm_diario_alphavantage.json").exists():
        ts = json.loads((DATOS / "ibm_diario_alphavantage.json").read_text())["Time Series (Daily)"]
        series["IBM"] = ({k: float(v["4. close"]) for k, v in ts.items()},
                         "Alpha Vantage TIME_SERIES_DAILY (4. close, sin ajustar)")
    out = {}
    for t, (p, fuente) in series.items():
        fechas = sorted(p)
        out[t] = ([date.fromisoformat(x) for x in fechas], np.array([p[x] for x in fechas]), fuente)
    return out


def wilson(k, n, z=1.96):
    p = k / n
    centro = (p + z**2 / (2 * n)) / (1 + z**2 / n)
    semi = z * np.sqrt(p * (1 - p) / n + z**2 / (4 * n**2)) / (1 + z**2 / n)
    return {"aciertos": int(k), "n": int(n), "cobertura": p, "ic95": [centro - semi, centro + semi]}


def backtest(fechas, px, h, anios, semilla_base):
    logret = np.diff(np.log(px))
    fin_mes = [i for i in range(len(fechas) - 1) if fechas[i + 1].month != fechas[i].month]
    ultimo = fechas[fin_mes[-1]]
    inicio = date(ultimo.year - anios, ultimo.month, 1)
    # orígenes dentro de los últimos `anios` años con horizonte completo observado
    js = [j for j, i in enumerate(fin_mes) if fechas[i] >= inicio and j + h < len(fin_mes)]
    js = js[::h]                                  # ventanas sin superposición
    filas = []
    for j in js:
        i0, i1 = fin_mes[j], fin_mes[j + h]
        desde = i0 - 252 * LOOKBACK_ANIOS
        if desde < 0:
            continue
        r = logret[desde:i0]                      # sólo información disponible en t0
        sigma = r.std(ddof=1) * np.sqrt(252)
        mu = r.mean() * 252 + sigma**2 / 2        # igual que el backend
        rng = np.random.default_rng(semilla_base + j)
        final = simular_accion_vectorizado(1.0, mu, sigma, h, rng.standard_normal((N, h)))[:, -1]
        real = px[i1] / px[i0]
        p5, p25, p50, p75, p95 = np.percentile(final, [5, 25, 50, 75, 95])
        filas.append({"origen": fechas[i0].isoformat(), "fin": fechas[i1].isoformat(),
                      "mu": mu, "sigma": sigma, "retorno_real": real - 1,
                      "p5": p5 - 1, "p25": p25 - 1, "mediana": p50 - 1, "p75": p75 - 1, "p95": p95 - 1,
                      "percentil_real": float(100 * np.mean(final <= real)),
                      "en_p25_p75": bool(p25 <= real <= p75), "en_p5_p95": bool(p5 <= real <= p95)})
    return filas


def resumir(filas):
    n = len(filas)
    return {"n_ventanas": n,
            "p25_p75": wilson(sum(f["en_p25_p75"] for f in filas), n),
            "p5_p95": wilson(sum(f["en_p5_p95"] for f in filas), n),
            "debajo_p25": sum(f["percentil_real"] < 25 for f in filas),
            "encima_p75": sum(f["percentil_real"] > 75 for f in filas)}


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--anios", type=int, default=5)
    a = ap.parse_args()
    series = cargar_series()
    out = {"anios": a.anios, "lookback_anios": LOOKBACK_ANIOS, "N": N, "acciones": {}, "conjunto": {}}
    for k, (t, (fechas, px, fuente)) in enumerate(sorted(series.items())):
        out["acciones"][t] = {"fuente": fuente, "serie": [fechas[0].isoformat(), fechas[-1].isoformat()]}
        for h in HORIZONTES:
            filas = backtest(fechas, px, h, a.anios, 10_000 * (k + 1))
            out["acciones"][t][f"h{h}"] = {"ventanas": filas, "resumen": resumir(filas)}
            r = out["acciones"][t][f"h{h}"]["resumen"]
            print(f"{t} h={h}: {r['n_ventanas']} ventanas ({filas[0]['origen']} a {filas[-1]['origen']}) | "
                  f"p25–p75 {100*r['p25_p75']['cobertura']:.0f}% "
                  f"[{100*r['p25_p75']['ic95'][0]:.0f}–{100*r['p25_p75']['ic95'][1]:.0f}] | "
                  f"p5–p95 {100*r['p5_p95']['cobertura']:.0f}% "
                  f"[{100*r['p5_p95']['ic95'][0]:.0f}–{100*r['p5_p95']['ic95'][1]:.0f}] | "
                  f"debajo p25: {r['debajo_p25']}, encima p75: {r['encima_p75']} | "
                  f"μ {min(f['mu'] for f in filas):.1%} a {max(f['mu'] for f in filas):.1%}")
    for h in HORIZONTES:
        todas = [f for t in out["acciones"] for f in out["acciones"][t][f"h{h}"]["ventanas"]]
        out["conjunto"][f"h{h}"] = resumir(todas)
        r = out["conjunto"][f"h{h}"]
        print(f"CONJUNTO h={h}: {r['n_ventanas']} ventanas | p25–p75 {100*r['p25_p75']['cobertura']:.0f}% "
              f"[{100*r['p25_p75']['ic95'][0]:.0f}–{100*r['p25_p75']['ic95'][1]:.0f}] | "
              f"p5–p95 {100*r['p5_p95']['cobertura']:.0f}% "
              f"[{100*r['p5_p95']['ic95'][0]:.0f}–{100*r['p5_p95']['ic95'][1]:.0f}]")
    RES.mkdir(exist_ok=True)
    (RES / "backtesting_reciente.json").write_text(json.dumps(out, indent=1, default=float))

    # Figura: por acción, banda simulada a 3 meses en cada origen y retorno real
    tick = sorted(out["acciones"])
    fig, axes = plt.subplots(len(tick), 1, figsize=(9, 2.8 * len(tick)), squeeze=False)
    for ax, t in zip(axes[:, 0], tick):
        f = out["acciones"][t]["h3"]["ventanas"]
        x = [date.fromisoformat(v["origen"]) for v in f]
        pc = lambda k: [100 * v[k] for v in f]
        ax.vlines(x, pc("p5"), pc("p95"), color="#e9c46a", lw=6, alpha=.6, label="p5–p95 simulado")
        ax.vlines(x, pc("p25"), pc("p75"), color="#e76f51", lw=6, label="p25–p75 simulado")
        ax.plot(x, pc("retorno_real"), "o", color="#264653", ms=5, label="retorno real")
        ax.axhline(0, color="gray", lw=.6)
        ax.set_title(f"{t}: retorno a 3 meses, simulado en cada fecha de origen frente al real", fontsize=9)
        ax.set_ylabel("%")
        ax.grid(alpha=.3)
    h, l = axes[0, 0].get_legend_handles_labels()
    fig.legend(h, l, fontsize=8, loc="lower center", ncol=3, frameon=False)
    fig.tight_layout(rect=(0, 0.04, 1, 1))
    fig.savefig(RES / "fig_backtesting_reciente.png", dpi=200)


if __name__ == "__main__":
    main()
