"""
Backtesting de acciones a horizontes largos (3, 12, 36 y 60 meses) con todos los orígenes disponibles.

Para cada acción de referencia (IBM, KO, NVDA; series diarias ajustadas desde 1999) y cada fecha de origen t0
desde el primer fin de mes con 10 años de historia previa:
  1. se calibran μ y σ con los 10 años previos a t0, con el mismo procedimiento que el backend;
  2. se simula el horizonte h con la función real del motor y N_SIMULACIONES trayectorias;
  3. se ubica el retorno que efectivamente ocurrió dentro de la distribución simulada.

Análisis principal: ventanas sin superposición (una cada h meses), que son casos independientes en el tiempo.
Análisis complementario: orígenes mensuales superpuestos (descriptivo; los casos están correlacionados, por lo
que para la inferencia se usa la cantidad de ventanas sin superposición).

Banda ampliada: misma simulación, pero incorporando la incertidumbre del drift estimado, μ ~ N(μ̂, σ̂²/A) con
A = 10 años (Merton, 1980). El logaritmo del retorno queda normal con varianza σ²T(1 + T/A), por lo que se
calcula en forma exacta.

Uso (desde motor-simulacion/):  python -m benchmarks.backtesting_largo
Salida: resultados/backtesting_largo.json y resultados/fig_backtesting_largo.png
"""
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
from benchmarks.backtesting_reciente import cargar_series, fines_de_mes, wilson

RES = Path(__file__).parent / "resultados"
HORIZONTES = [3, 12, 24, 36, 60]
LOOKBACK_ANIOS = 10
A = LOOKBACK_ANIOS


def ventanas(fechas, px, h, semilla_base, paso):
    logret = np.diff(np.log(px))
    fin_mes = fines_de_mes(fechas)
    js = [j for j, i in enumerate(fin_mes) if i - 252 * LOOKBACK_ANIOS >= 0 and j + h < len(fin_mes)]
    js = js[::paso]
    filas = []
    for j in js:
        i0, i1 = fin_mes[j], fin_mes[j + h]
        r = logret[i0 - 252 * LOOKBACK_ANIOS:i0]
        sigma = r.std(ddof=1) * np.sqrt(252)
        mu = r.mean() * 252 + sigma**2 / 2
        real = px[i1] / px[i0]
        T = h / 12
        z = (np.log(real) - (mu - sigma**2 / 2) * T) / (sigma * np.sqrt(T))
        za = z / np.sqrt(1 + T / A)                       # banda ampliada (exacta)
        fila = {"origen": fechas[i0].isoformat(), "fin": fechas[i1].isoformat(), "mu": mu, "sigma": sigma,
                "retorno_real": real - 1, "z": float(z), "z_ampliada": float(za),
                "pit_ampliada": float(stats.norm.cdf(za))}
        if paso == h:                                     # simulación con el motor sólo en el análisis principal
            rng = np.random.default_rng(semilla_base + j)
            final = simular_accion_vectorizado(1.0, mu, sigma, h, rng.standard_normal((N, h)))[:, -1]
            p5, p25, p50, p75, p95 = np.percentile(final, [5, 25, 50, 75, 95])
            fila.update({"p5": p5 - 1, "p25": p25 - 1, "mediana": p50 - 1, "p75": p75 - 1, "p95": p95 - 1,
                         "pit": float(np.mean(final <= real))})
        else:
            fila["pit"] = float(stats.norm.cdf(z))       # GBM exacto: idéntico al motor salvo error MC
        filas.append(fila)
    return filas


def ic_media(x, n=None):
    n = n or len(x)
    s = x.std(ddof=1) if n > 1 else np.nan
    t = stats.t.ppf(.975, n - 1) if n > 1 else np.nan
    return [float(x.mean() - t * s / np.sqrt(n)), float(x.mean() + t * s / np.sqrt(n))]


def ic_desvio(x, n=None):
    n = n or len(x)
    s2 = x.var(ddof=1)
    return [float(np.sqrt((n - 1) * s2 / stats.chi2.ppf(.975, n - 1))),
            float(np.sqrt((n - 1) * s2 / stats.chi2.ppf(.025, n - 1)))]


def resumir(filas, n_ef=None):
    n = len(filas)
    n_ef = n_ef or n
    out = {"n": n, "n_inferencia": n_ef}
    for sufijo, kz, kp in (("", "z", "pit"), ("_ampliada", "z_ampliada", "pit_ampliada")):
        pit = np.array([f[kp] for f in filas])
        z = np.array([f[kz] for f in filas])
        k50 = int(np.sum((pit >= .25) & (pit <= .75)))
        k90 = int(np.sum((pit >= .05) & (pit <= .95)))
        # Wilson con la cantidad de casos independientes (escala los aciertos a n_ef)
        out["p25_p75" + sufijo] = wilson(k50 * n_ef / n, n_ef) | {"aciertos": k50, "n": n}
        out["p5_p95" + sufijo] = wilson(k90 * n_ef / n, n_ef) | {"aciertos": k90, "n": n}
        out["debajo_p25" + sufijo] = int(np.sum(pit < .25))
        out["encima_p75" + sufijo] = int(np.sum(pit > .75))
        out["z_media" + sufijo] = float(z.mean())
        out["z_desvio" + sufijo] = float(z.std(ddof=1))
        if n_ef > 2:
            out["z_media_ic95" + sufijo] = ic_media(z, n_ef)
            out["z_desvio_ic95" + sufijo] = ic_desvio(z, n_ef)
        if n_ef == n and n > 2:
            out["ks_pvalor" + sufijo] = float(stats.kstest(pit, "uniform").pvalue)
    return out


def fmt(r, suf=""):
    c, d = r["p25_p75" + suf], r["p5_p95" + suf]
    s = (f"n={r['n']:>3} (inf {r['n_inferencia']:>3})  p25–p75 {100*c['cobertura']:4.0f}% "
         f"[{100*c['ic95'][0]:.0f}–{100*c['ic95'][1]:.0f}]  p5–p95 {100*d['cobertura']:4.0f}% "
         f"[{100*d['ic95'][0]:.0f}–{100*d['ic95'][1]:.0f}]  deb/enc {r['debajo_p25'+suf]}/{r['encima_p75'+suf]}  "
         f"z {r['z_media'+suf]:+.2f}/{r['z_desvio'+suf]:.2f}")
    if "z_desvio_ic95" + suf in r:
        a, b = r["z_desvio_ic95" + suf]
        m0, m1 = r["z_media_ic95" + suf]
        s += f" [media {m0:+.2f}..{m1:+.2f}; sd {a:.2f}–{b:.2f}]"
    if "ks_pvalor" + suf in r:
        s += f"  KS p={r['ks_pvalor'+suf]:.2f}"
    return s


def main():
    series = cargar_series()
    out = {"N": N, "lookback_anios": LOOKBACK_ANIOS, "horizontes": HORIZONTES, "acciones": {}, "conjunto": {}}
    for k, (t, (fechas, px, fuente)) in enumerate(sorted(series.items())):
        out["acciones"][t] = {"serie": [fechas[0].isoformat(), fechas[-1].isoformat()]}
        for h in HORIZONTES:
            ind = ventanas(fechas, px, h, 10_000 * (k + 1), h)
            sup = ventanas(fechas, px, h, 0, 1)
            out["acciones"][t][f"h{h}"] = {"ventanas": ind, "resumen": resumir(ind),
                                          "superpuestas": resumir(sup, len(ind))}
    # Las acciones de una misma fecha de origen no son independientes (viven el mismo mercado).
    # Se estima la correlación media de z entre acciones con el horizonte de más fechas (3 meses) y se
    # usa la cantidad efectiva de casos independientes: n_fechas · m / (1 + (m − 1)·ρ).
    tick = sorted(out["acciones"])
    m = len(tick)
    Z = np.array([[w["z"] for w in out["acciones"][t][f"h{HORIZONTES[0]}"]["ventanas"]] for t in tick])
    rho = float(np.corrcoef(Z)[np.triu_indices(m, 1)].mean()) if m > 1 else 0.0
    out["correlacion_z_entre_acciones"] = rho
    for h in HORIZONTES:
        ind = [f for t in tick for f in out["acciones"][t][f"h{h}"]["ventanas"]]
        n_fechas = len(ind) / m
        n_ef = max(3, round(n_fechas * m / (1 + (m - 1) * rho)))
        out["conjunto"][f"h{h}"] = {"independientes": resumir(ind, n_ef)}
        sup = [f for t, (fechas, px, _) in sorted(series.items()) for f in ventanas(fechas, px, h, 0, 1)]
        out["conjunto"][f"h{h}"]["superpuestas"] = resumir(sup, n_ef)

    for h in HORIZONTES:
        print(f"\n=== Horizonte {h} meses (ρ entre acciones {out['correlacion_z_entre_acciones']:.2f}) ===")
        for t in out["acciones"]:
            v = out["acciones"][t][f"h{h}"]
            print(f"{t:5} indep    {fmt(v['resumen'])}")
        c = out["conjunto"][f"h{h}"]
        print(f"TOTAL indep    {fmt(c['independientes'])}")
        print(f"TOTAL superp   {fmt(c['superpuestas'])}")
        print(f"TOTAL ampliada {fmt(c['independientes'], '_ampliada')}")
        print(f"TOTAL ampl sup {fmt(c['superpuestas'], '_ampliada')}")
    RES.mkdir(exist_ok=True)
    (RES / "backtesting_largo.json").write_text(json.dumps(out, indent=1, default=float))
    graficar(out)


def graficar(out):
    """(a) cobertura p25–p75; (b) dónde caen los fallos (orígenes mensuales, descriptivo); (c) sesgo: media de z."""
    hs = out["horizontes"]
    x = np.arange(len(hs))
    ind = [out["conjunto"][f"h{h}"]["independientes"] for h in hs]
    sup = [out["conjunto"][f"h{h}"]["superpuestas"] for h in hs]
    etiquetas = [f"{h} m\n{v['n']} (ef. {v['n_inferencia']})" for h, v in zip(hs, ind)]
    fig, axes = plt.subplots(1, 3, figsize=(12, 4))
    ax = axes[0]
    for desp, suf, col, lab in ((-.12, "", "#e76f51", "banda del motor"),
                                (.12, "_ampliada", "#2a9d8f", "banda con incertidumbre de μ")):
        y = np.array([100 * v["p25_p75" + suf]["cobertura"] for v in ind])
        lo = np.array([100 * v["p25_p75" + suf]["ic95"][0] for v in ind])
        hi = np.array([100 * v["p25_p75" + suf]["ic95"][1] for v in ind])
        ax.errorbar(x + desp, y, yerr=[y - lo, hi - y], fmt="o", color=col, capsize=3, label=lab)
    ax.axhline(50, color="gray", ls="--", lw=.8)
    ax.set_title("(a) Cobertura de la banda p25–p75", fontsize=10)
    ax.set_ylabel("% de ventanas independientes")
    ax.legend(fontsize=8, loc="lower left")
    ax = axes[1]
    deb = [100 * v["debajo_p25"] / v["n"] for v in sup]
    enc = [100 * v["encima_p75"] / v["n"] for v in sup]
    ax.bar(x - .18, deb, .36, color="#457b9d", label="debajo de p25")
    ax.bar(x + .18, enc, .36, color="#e9c46a", label="encima de p75")
    ax.axhline(25, color="gray", ls="--", lw=.8)
    ax.set_title("(b) Fallos por debajo y por encima de la banda", fontsize=10)
    ax.set_ylabel("% de orígenes mensuales (esperado 25 %)")
    ax.legend(fontsize=8, loc="upper left")
    ax = axes[2]
    y = np.array([v["z_media"] for v in ind])
    lo = np.array([v["z_media_ic95"][0] for v in ind]); hi = np.array([v["z_media_ic95"][1] for v in ind])
    ax.errorbar(x, y, yerr=[y - lo, hi - y], fmt="o", color="#264653", capsize=3)
    ax.axhline(0, color="gray", ls="--", lw=.8)
    ax.set_title("(c) Sesgo: media del error estandarizado z", fontsize=10)
    ax.set_ylabel("media de z (ideal 0)")
    for ax in axes:
        ax.set_xticks(x, etiquetas, fontsize=8)
        ax.grid(alpha=.3)
    fig.tight_layout()
    fig.savefig(RES / "fig_backtesting_largo.png", dpi=200)


if __name__ == "__main__":
    main()
