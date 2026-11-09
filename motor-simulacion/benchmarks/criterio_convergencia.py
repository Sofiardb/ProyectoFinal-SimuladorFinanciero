"""
Análisis complementario del estudio de convergencia (N de 300 a 100.000).

1. Peor error de Monte Carlo relativo al ancho de la banda p25–p75, global y por escenario, para cada N,
   y ajuste de la ley e(N) = c / √N.
2. Verificación de la fórmula teórica del error de un percentil, 1,96·√(q(1−q)/n) / f(x_q), contra el
   error medido, para el estadístico que define el peor caso.
3. N necesario para distintos criterios (10 %, 5 %, 2,5 %, 1 %).
4. Gráfico (Figura 2 del informe).

Uso (desde motor-simulacion/):  python -m benchmarks.criterio_convergencia
Salida: resultados/criterio_convergencia.json y resultados/fig_criterio_N.png
"""
import json
from pathlib import Path

import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
import numpy as np

from benchmarks.analizar_convergencia import capital, cargar, e95, iqr_pct
from benchmarks.estudio_convergencia import PORTFOLIOS, correr

RES = Path(__file__).parent / "resultados"
ESTADISTICOS = ("mediana", "p25", "p75", "media")   # los que el usuario ve como banda y valor central


def tabla_ratios(Ns, casos):
    filas = {}
    for caso in casos:
        for metrica in ("ars_patrimonio", "usd_patrimonio", "ars_ganancia_real", "usd_ganancia_real"):
            port, moneda = caso.split("_T")[0], metrica.split("_")[0]
            if capital(port, moneda) == 0:
                continue
            for vista in ("global", "favorable", "moderado", "desfavorable"):
                iqr = iqr_pct(casos, caso, metrica, vista)
                if iqr <= 0.5:            # sub-portfolio sin dispersión (determinístico): no hay banda
                    continue
                for est in ESTADISTICOS:
                    k = f"{metrica}|{vista}|{est}"
                    filas[f"{caso}|{k}"] = {N: 100 * e95(casos, caso, N, k)[0] / iqr for N in Ns}
    return filas


def peor(filas, N, global_):
    cands = [(v[N], k) for k, v in filas.items() if (k.split("|")[2] == "global") == global_]
    return max(cands)


def verificar_teoria(clave, n_vista):
    """Error teórico del percentil con la densidad estimada de una corrida grande (N = 300.000)."""
    caso, metrica, vista, est = clave.split("|")
    port, T = caso.split("_T")
    res = correr_matriz(PORTFOLIOS[port], int(T))
    x = res[metrica][vista]
    q = {"p25": .25, "p75": .75, "mediana": .5}[est]
    xq = np.quantile(x, q)
    p25, p75 = np.quantile(x, [.25, .75])
    h = 0.02 * (p75 - p25)                               # densidad local: fracción de muestras en ±h
    f = np.mean(np.abs(x - xq) <= h) / (2 * h)
    err_prob = 1.96 * np.sqrt(q * (1 - q) / n_vista)
    err_valor = err_prob / f
    return {"q": q, "error_probabilidad": err_prob, "error_relativo_banda_teorico": 100 * err_valor / (p75 - p25)}


def correr_matriz(instrumentos, T, N=300_000, semilla=77):
    """Valores finales por trayectoria (no sólo estadísticas) para estimar la densidad."""
    import app.simulacion.orquestador as orq
    capturas = {}
    orig = orq.calcular_estadisticas

    def capturar(m):
        capturas.setdefault("pila", []).append(np.asarray(m)[:, -1].copy())
        return orig(m)
    orq.calcular_estadisticas = capturar
    try:
        res = correr(instrumentos, T, N, semilla)
    finally:
        orq.calcular_estadisticas = orig
    # Se identifica cada matriz capturada comparando su p75 con el del resultado.
    salida = {}
    for metrica, (a, b) in (("usd_patrimonio", ("portfolio_usd", "patrimonio")),
                            ("usd_ganancia_real", ("portfolio_usd", "ganancias_reales")),
                            ("ars_patrimonio", ("portfolio_ars", "patrimonio")),
                            ("ars_ganancia_real", ("portfolio_ars", "ganancias_reales"))):
        salida[metrica] = {}
        for vista in ("global", "favorable", "moderado", "desfavorable"):
            objetivo = res[a][b][vista]["p75"][-1]
            for v in capturas["pila"]:
                if v.size and abs(np.percentile(v, 75) - objetivo) < 1e-9 * max(1, abs(objetivo)):
                    salida[metrica][vista] = v
                    break
    return salida


def main():
    Ns, casos = cargar()
    filas = tabla_ratios(Ns, casos)
    resumen = {"Ns": Ns, "peor_global": {}, "peor_escenario": {}}
    for N in Ns:
        g, kg = peor(filas, N, True)
        e, ke = peor(filas, N, False)
        resumen["peor_global"][N] = {"valor": g, "clave": kg}
        resumen["peor_escenario"][N] = {"valor": e, "clave": ke}
        print(f"N={N:>7}  global {g:5.2f}%  ({kg})   escenario {e:5.2f}%  ({ke})")

    # Ajuste e = c/√N por mínimos cuadrados en escala log con pendiente fija −1/2 (N ≥ 1500)
    for vista in ("peor_global", "peor_escenario"):
        Nf = [N for N in Ns if N >= 1500]
        c = float(np.exp(np.mean([np.log(resumen[vista][N]["valor"] * np.sqrt(N)) for N in Nf])))
        pend = float(np.polyfit(np.log(Nf), np.log([resumen[vista][N]["valor"] for N in Nf]), 1)[0])
        resumen[vista + "_ajuste"] = {"c": c, "pendiente_libre": pend,
                                      "N_para": {str(t): (c / t) ** 2 for t in (10, 5, 2.5, 1)}}
        print(vista, "c =", round(c, 1), "pendiente libre =", round(pend, 3),
              {t: round((c / t) ** 2) for t in (10, 5, 2.5, 1)})

    # Verificación de la teoría sobre el estadístico del peor caso por escenario a N = 15.000
    clave = resumen["peor_escenario"][15000]["clave"]
    teo = verificar_teoria(clave, 5000)
    teo["clave"] = clave
    teo["medido_N15000"] = filas[clave][15000]
    resumen["verificacion_teoria"] = teo
    print("teoría vs medido:", teo)

    (RES / "criterio_convergencia.json").write_text(json.dumps(resumen, indent=1))

    # Figura
    costo = [f for f in json.loads((RES / "costo_por_N.json").read_text()) if f["portfolio"] == "moderado"]
    Nc, tiempos = [f["N"] for f in costo], [1000 * f["seg"] for f in costo]
    fig, ax = plt.subplots(figsize=(8.5, 5.4))
    yg = [resumen["peor_global"][N]["valor"] for N in Ns]
    ye = [resumen["peor_escenario"][N]["valor"] for N in Ns]
    ax.plot(Ns, yg, "o-", color="#264653", label="medido, vista global (N trayectorias)")
    ax.plot(Ns, ye, "o-", color="#e76f51", label="medido, vista por escenario (N/3 trayectorias)")
    xs = np.logspace(np.log10(300), np.log10(300_000), 50)
    for vista, col in (("peor_global", "#264653"), ("peor_escenario", "#e76f51")):
        ax.plot(xs, resumen[vista + "_ajuste"]["c"] / np.sqrt(xs), ":", color=col, lw=1)
    ax.plot([], [], ":", color="gray", label="ley teórica c/√N")
    ax.axhline(5, color="gray", ls="--", lw=.8)
    ax.text(330, 5.4, "máximo admisible: 5 %", fontsize=8, color="dimgray")
    ax.axhline(2.5, color="black", ls="--", lw=.8)
    ax.text(330, 2.65, "objetivo adoptado: 2,5 %", fontsize=8)
    ax.axvline(15000, color="gray", lw=.8, ls=":")
    ax.text(15000 * 1.07, 26, "N inicial\n15.000", fontsize=8, color="dimgray")
    ax.axvline(51000, color="black", lw=1)
    ax.text(51000 * 1.07, 20, "N adoptado\n51.000", fontsize=8)
    ax.set_xlim(250, 350_000)
    ax.set_xscale("log"); ax.set_yscale("log")
    ax.set_xlabel("N (trayectorias totales)")
    ax.set_ylabel("Peor error MC al 95 % / ancho p25–p75 (%)")
    ax.grid(alpha=.3, which="both")
    ax2 = ax.twinx()
    ax2.plot(Nc, tiempos, "s:", color="gray", ms=4, label="tiempo del motor, portfolio moderado, T = 36 meses (ms)")
    ax2.set_yscale("log")
    ax2.set_ylabel("ms por simulación (T = 36 meses)", color="gray")
    h1, l1 = ax.get_legend_handles_labels(); h2, l2 = ax2.get_legend_handles_labels()
    ax.legend(h1 + h2, l1 + l2, fontsize=8, loc="upper center", bbox_to_anchor=(0.5, -0.14), ncol=2, frameon=False)
    fig.tight_layout()
    fig.savefig(RES / "fig_criterio_N.png", dpi=200)
    print("tiempos T36 (ms):", dict(zip(Nc, [round(t) for t in tiempos])))


if __name__ == "__main__":
    main()
