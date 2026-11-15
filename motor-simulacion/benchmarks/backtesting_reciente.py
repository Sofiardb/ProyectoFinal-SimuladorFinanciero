"""
Backtesting de acciones en los últimos 5 años (horizonte máximo del motor).

Para cada acción de referencia y cada fecha de origen t0 dentro de los últimos 5 años de la serie:
  1. se calibran μ y σ con los 10 años previos a t0, con el mismo procedimiento que el backend;
  2. se simula el horizonte h (2 y 3 meses) con la función real del motor y N_SIMULACIONES trayectorias,
     es decir, lo que el motor habría mostrado si se hubiera ejecutado en t0;
  3. se ubica el retorno que efectivamente ocurrió dentro de la distribución simulada.

Las ventanas no se superponen (una cada h meses) para que los casos sean independientes.

Medidas:
  - Cobertura de las bandas p25–p75 (esperado 50 %) y p5–p95 (esperado 90 %), por acción y en
    conjunto, con intervalo de confianza de Wilson al 95 %.
  - Percentil del valor real dentro de la distribución simulada: con un modelo calibrado se distribuye
    uniforme entre 0 y 100 (prueba de Kolmogorov-Smirnov).
  - Error estandarizado z = (ln R − (μ − σ²/2)·T) / (σ·√T): con un modelo calibrado tiene media 0
    (sin sesgo en el drift) y desvío 1 (volatilidad bien estimada).
  - Volatilidad realizada en el período de prueba frente a la estimada con los 10 años previos.

Datos: benchmarks/datos/<ticker>_diario_ajustado.json (descargar_series.py).

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
from scipy import stats

from app.simulacion.acciones import simular_accion_vectorizado
from app.simulacion.orquestador import N_SIMULACIONES as N

DATOS = Path(__file__).parent / "datos"
RES = Path(__file__).parent / "resultados"
HORIZONTES = [2, 3]
LOOKBACK_ANIOS = 10


def cargar_series():
    out = {}
    for f in sorted(DATOS.glob("*_diario_ajustado.json")):
        d = json.loads(f.read_text())
        fechas = sorted(d["precios"])
        out[d["ticker"]] = ([date.fromisoformat(x) for x in fechas],
                            np.array([d["precios"][x] for x in fechas]), d["fuente"])
    return out


def wilson(k, n, z=1.96):
    p = k / n
    centro = (p + z**2 / (2 * n)) / (1 + z**2 / n)
    semi = z * np.sqrt(p * (1 - p) / n + z**2 / (4 * n**2)) / (1 + z**2 / n)
    return {"aciertos": int(k), "n": int(n), "cobertura": p, "ic95": [centro - semi, centro + semi]}


def fines_de_mes(fechas):
    return [i for i in range(len(fechas) - 1) if fechas[i + 1].month != fechas[i].month]


def backtest(fechas, px, h, anios, semilla_base):
    logret = np.diff(np.log(px))
    fin_mes = fines_de_mes(fechas)
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
        T = h / 12
        z = (np.log(real) - (mu - sigma**2 / 2) * T) / (sigma * np.sqrt(T))
        p5, p25, p50, p75, p95 = np.percentile(final, [5, 25, 50, 75, 95])
        filas.append({"origen": fechas[i0].isoformat(), "fin": fechas[i1].isoformat(),
                      "mu": mu, "sigma": sigma, "retorno_real": real - 1, "z": float(z),
                      "p5": p5 - 1, "p25": p25 - 1, "mediana": p50 - 1, "p75": p75 - 1, "p95": p95 - 1,
                      "percentil_real": float(100 * np.mean(final <= real)),
                      "en_p25_p75": bool(p25 <= real <= p75), "en_p5_p95": bool(p5 <= real <= p95)})
    return filas


def resumir(filas):
    n = len(filas)
    pit = np.array([f["percentil_real"] for f in filas]) / 100
    z = np.array([f["z"] for f in filas])
    return {"n_ventanas": n,
            "p25_p75": wilson(sum(f["en_p25_p75"] for f in filas), n),
            "p5_p95": wilson(sum(f["en_p5_p95"] for f in filas), n),
            "debajo_p25": int(sum(f["percentil_real"] < 25 for f in filas)),
            "encima_p75": int(sum(f["percentil_real"] > 75 for f in filas)),
            "percentil_medio": float(100 * pit.mean()),
            "ks_uniforme_pvalor": float(stats.kstest(pit, "uniform").pvalue),
            "z_media": float(z.mean()), "z_desvio": float(z.std(ddof=1)),
            "mu_rango": [min(f["mu"] for f in filas), max(f["mu"] for f in filas)],
            "sigma_rango": [min(f["sigma"] for f in filas), max(f["sigma"] for f in filas)]}


def realizado(fechas, px, desde, hasta):
    """Volatilidad y retorno log anualizados de la serie entre dos fechas."""
    idx = [i for i, f in enumerate(fechas) if desde <= f <= hasta]
    r = np.diff(np.log(px[idx]))
    anios = (fechas[idx[-1]] - fechas[idx[0]]).days / 365.25
    return {"sigma": float(r.std(ddof=1) * np.sqrt(252)),
            "retorno_log_anual": float(np.log(px[idx[-1]] / px[idx[0]]) / anios)}


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
        # período de prueba (primer origen a última fecha) y década de calibración previa
        o0 = date.fromisoformat(out["acciones"][t]["h2"]["ventanas"][0]["origen"])
        out["acciones"][t]["prueba"] = realizado(fechas, px, o0, fechas[-1])
        out["acciones"][t]["calibracion_previa"] = realizado(fechas, px, date(o0.year - 10, o0.month, o0.day), o0)
        out["acciones"][t]["por_anio"] = {y: realizado(fechas, px, date(y, 1, 1), date(y, 12, 31))["sigma"]
                                         for y in range(o0.year, fechas[-1].year + 1)}
    for h in HORIZONTES:
        todas = [f for t in out["acciones"] for f in out["acciones"][t][f"h{h}"]["ventanas"]]
        out["conjunto"][f"h{h}"] = resumir(todas)

    for t in out["acciones"]:
        for h in HORIZONTES:
            r = out["acciones"][t][f"h{h}"]["resumen"]
            print(f"{t} h={h}: n={r['n_ventanas']} p25–p75 {100*r['p25_p75']['cobertura']:.0f}% "
                  f"[{100*r['p25_p75']['ic95'][0]:.0f}–{100*r['p25_p75']['ic95'][1]:.0f}] "
                  f"p5–p95 {100*r['p5_p95']['cobertura']:.0f}% [{100*r['p5_p95']['ic95'][0]:.0f}–{100*r['p5_p95']['ic95'][1]:.0f}] "
                  f"deb/enc {r['debajo_p25']}/{r['encima_p75']} pct medio {r['percentil_medio']:.0f} "
                  f"KS p={r['ks_uniforme_pvalor']:.2f} z {r['z_media']:+.2f}/{r['z_desvio']:.2f} "
                  f"μ {r['mu_rango'][0]:.1%}..{r['mu_rango'][1]:.1%} σ {r['sigma_rango'][0]:.1%}..{r['sigma_rango'][1]:.1%}")
        p, c = out["acciones"][t]["prueba"], out["acciones"][t]["calibracion_previa"]
        print(f"   {t} σ calibración previa {c['sigma']:.1%} / prueba {p['sigma']:.1%}; "
              f"retorno log anual previa {c['retorno_log_anual']:.1%} / prueba {p['retorno_log_anual']:.1%}; "
              f"σ por año {({y: round(100*v) for y, v in out['acciones'][t]['por_anio'].items()})}")
    for h in HORIZONTES:
        r = out["conjunto"][f"h{h}"]
        print(f"CONJUNTO h={h}: n={r['n_ventanas']} p25–p75 {100*r['p25_p75']['cobertura']:.0f}% "
              f"[{100*r['p25_p75']['ic95'][0]:.0f}–{100*r['p25_p75']['ic95'][1]:.0f}] "
              f"p5–p95 {100*r['p5_p95']['cobertura']:.0f}% [{100*r['p5_p95']['ic95'][0]:.0f}–{100*r['p5_p95']['ic95'][1]:.0f}] "
              f"deb/enc {r['debajo_p25']}/{r['encima_p75']} pct medio {r['percentil_medio']:.0f} "
              f"KS p={r['ks_uniforme_pvalor']:.2f} z {r['z_media']:+.2f}/{r['z_desvio']:.2f}")
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
