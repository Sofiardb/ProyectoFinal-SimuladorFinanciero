"""
Procesa benchmarks/resultados/conv_T*.json y genera tablas + gráficos del estudio de convergencia.

Error de Monte Carlo al 95%:  e95 = 1,96 × desvío entre corridas independientes,
expresado en % del capital invertido en el sub-portfolio (ARS o USD). Así un e95 = 0,5%
significa: "si se repite la simulación, el resultado se mueve como mucho ±0,5 pesos
(o dólares) por cada 100 invertidos, con 95% de confianza".
"""
import json
from pathlib import Path

import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
import numpy as np

from benchmarks.estudio_convergencia import PORTFOLIOS

RES = Path(__file__).parent / "resultados"
N_ANTERIOR = 3000    # valor original de N_SIMULACIONES
N_ELEGIDO = 15000    # valor adoptado a partir de este estudio


def capital(portfolio, moneda):
    usd = {"accion", "plazo_fijo_usd"}
    return sum(i["monto"] for i in PORTFOLIOS[portfolio]
               if (i["tipo"] in usd) == (moneda == "usd"))


def cargar():
    casos, Ns = {}, None
    for f in sorted(RES.glob("conv_T*.json")):
        d = json.loads(f.read_text())
        Ns = d["Ns"]
        casos.update(d["casos"])
    return Ns, casos


def e95(casos, caso, N, clave):
    port, moneda = caso.split("_T")[0], clave.split("_")[0]
    cap = capital(port, moneda)
    st = casos[caso]["por_N"][str(N)]["stats"][clave]
    return 100 * 1.96 * st["desvio"] / cap, 100 * st["sesgo"] / cap


def iqr_pct(casos, caso, metrica, vista):
    port, moneda = caso.split("_T")[0], metrica.split("_")[0]
    ref = casos[caso]["referencia"]
    return 100 * (ref[f"{metrica}|{vista}|p75"] - ref[f"{metrica}|{vista}|p25"]) / capital(port, moneda)


def main():
    Ns, casos = cargar()
    tabla = {}
    for caso in casos:
        for metrica in ("ars_patrimonio", "usd_patrimonio", "ars_ganancia_real", "usd_ganancia_real"):
            port, moneda = caso.split("_T")[0], metrica.split("_")[0]
            if capital(port, moneda) == 0:
                continue
            for vista in ("global", "favorable", "moderado", "desfavorable"):
                for est in ("mediana", "p25", "p75", "media", "minimo", "maximo"):
                    clave = f"{metrica}|{vista}|{est}"
                    fila = {str(N): e95(casos, caso, N, clave)[0] for N in Ns}
                    fila["iqr_pct"] = iqr_pct(casos, caso, metrica, vista)
                    fila["sesgo_3000"] = e95(casos, caso, 3000, clave)[1]
                    tabla[f"{caso}|{clave}"] = fila
    (RES / "convergencia_tabla.json").write_text(json.dumps(tabla, indent=1))

    # ---------- resumen: peor caso a N=3000 por (estadístico, vista)
    print("\nPeor e95 (% del capital) a N=3000 entre todos los portfolios/métricas/horizontes")
    for est in ("mediana", "p25", "p75", "media", "minimo", "maximo"):
        for vista in ("global", "favorable", "moderado", "desfavorable"):
            filas = {k: v for k, v in tabla.items() if k.endswith(f"|{vista}|{est}")}
            peor_k = max(filas, key=lambda k: filas[k]["3000"])
            v = filas[peor_k]
            print(f"  {est:8s} {vista:12s} e95={v['3000']:6.2f}%  (IQR={v['iqr_pct']:6.1f}%, "
                  f"e95/IQR={100*v['3000']/v['iqr_pct']:5.1f}%)  <- {peor_k.split('|')[0]} {peor_k.split('|')[1]}")

    # ---------- gráfico 1: e95 vs N, mediana global, todos los casos + recta 1/sqrt(N)
    colores = {"conservador": "#2a9d8f", "moderado": "#e9c46a", "agresivo": "#e76f51"}
    fig, axes = plt.subplots(1, 2, figsize=(12, 4.6), sharey=True)
    for ax, vista in zip(axes, ("global", "desfavorable")):
        for caso in casos:
            port, T = caso.split("_T")
            for metrica, ls in (("usd_patrimonio", "-"), ("ars_patrimonio", "--")):
                k = f"{caso}|{metrica}|{vista}|mediana"
                if k not in tabla:
                    continue
                y = [tabla[k][str(N)] for N in Ns]
                if max(y) < 1e-6:        # sub-portfolio determinístico (p.ej. PF USD): sin error MC
                    continue
                ax.plot(Ns, y, ls, marker="o", ms=3, color=colores[port],
                        alpha=1 if T == "36" else .55,
                        label=f"{port} {metrica.split('_')[0].upper()} T={T}m")
        ref = np.array(Ns, float)
        ax.plot(ref, 10 / np.sqrt(ref / 300), ":", color="gray", label="pendiente teórica 1/√N")
        ax.axvline(N_ANTERIOR, color="gray", lw=1, ls="--"); ax.axvline(N_ELEGIDO, color="black", lw=1)
        ax.axhline(1, color="red", lw=.8, ls="--")
        ax.set_xscale("log"); ax.set_yscale("log"); ax.set_ylim(0.02, 50)
        ax.set_title(f"Mediana del valor final — vista {vista}")
        ax.set_xlabel("N (trayectorias totales)")
        ax.grid(alpha=.3, which="both")
    axes[0].set_ylabel("Error MC al 95% (% del capital)")
    axes[1].legend(fontsize=7, loc="lower left")
    fig.tight_layout()
    fig.savefig(RES / "fig_convergencia_mediana.png", dpi=150)

    # ---------- gráfico 2: costo vs precisión (peor caso)
    tiempos = {N: np.mean([casos[c]["por_N"][str(N)]["seg_por_corrida"] for c in casos if c.endswith("T36")]) for N in Ns}
    peor = max((k for k in tabla if k.endswith("|global|mediana")), key=lambda k: tabla[k]["3000"])
    fig, ax1 = plt.subplots(figsize=(7, 4.2))
    ax1.plot(Ns, [tabla[peor][str(N)] for N in Ns], "o-", color="#e76f51", label="error MC (peor caso)")
    ax1.set_xscale("log"); ax1.set_xlabel("N"); ax1.set_ylabel("Error MC 95% (% capital)", color="#e76f51")
    ax2 = ax1.twinx()
    ax2.plot(Ns, [1000 * tiempos[N] for N in Ns], "s--", color="#264653", label="tiempo motor")
    ax2.set_ylabel("ms por simulación (T=36)", color="#264653")
    ax1.axvline(N_ANTERIOR, color="gray", lw=1, ls="--"); ax1.axvline(N_ELEGIDO, color="black", lw=1)
    ax1.set_title("Precisión vs. costo computacional")
    ax1.grid(alpha=.3, which="both")
    fig.tight_layout()
    fig.savefig(RES / "fig_costo_precision.png", dpi=150)
    print("\nTiempos medios T=36 (ms):", {N: round(1000 * t) for N, t in tiempos.items()})
    print("peor caso:", peor)


if __name__ == "__main__":
    main()


def resumen_por_portfolio():
    """Tabla para el informe: por portfolio/horizonte y moneda, e95 a N=3000 de la mediana (global y peor
    escenario), peor e95/IQR entre p25/mediana/p75/media, y N necesario para e95/IQR <= 5%, y peor e95/IQR a N_ELEGIDO."""
    tabla = json.loads((RES / "convergencia_tabla.json").read_text())
    filas = []
    casos = sorted({k.split("|")[0] for k in tabla}, key=lambda c: (["conservador", "moderado", "agresivo"].index(c.split("_T")[0]), int(c.split("_T")[1])))
    for caso in casos:
        for moneda in ("ars", "usd"):
            ks = [k for k in tabla if k.startswith(caso + "|" + moneda + "_patrimonio")]
            if not ks:
                continue
            g = tabla[f"{caso}|{moneda}_patrimonio|global|mediana"]
            esc = max((tabla[f"{caso}|{moneda}_patrimonio|{v}|mediana"] for v in ("favorable", "moderado", "desfavorable")), key=lambda r: r["3000"])
            ratios = [(tabla[k]["3000"] / tabla[k]["iqr_pct"], k) for k in tabla
                      if k.startswith(caso + "|" + moneda) and k.split("|")[-1] in ("mediana", "p25", "p75", "media") and tabla[k]["iqr_pct"] > 0.5]
            peor_ratio, peor_k = max(ratios)
            n_5 = 3000 * (peor_ratio / 0.05) ** 2
            peor_ratio_el = max(tabla[k][str(N_ELEGIDO)] / tabla[k]["iqr_pct"] for _, k in ratios)
            filas.append({"caso": caso, "moneda": moneda.upper(), "e95_mediana_global": g["3000"],
                          "e95_mediana_peor_escenario": esc["3000"], "iqr_global": g["iqr_pct"],
                          "peor_e95_sobre_iqr_pct": 100 * peor_ratio, "peor_estadistico": "|".join(peor_k.split("|")[1:]),
                          "N_para_5pct_iqr": n_5, "peor_e95_sobre_iqr_pct_N_elegido": 100 * peor_ratio_el})
    (RES / "convergencia_resumen.json").write_text(json.dumps(filas, indent=1))
    for f in filas:
        print(f"{f['caso']:15s} {f['moneda']}  mediana global ±{f['e95_mediana_global']:.2f}%  peor esc ±{f['e95_mediana_peor_escenario']:.2f}%  "
              f"IQR {f['iqr_global']:.1f}%  peor e95/IQR {f['peor_e95_sobre_iqr_pct']:.1f}% ({f['peor_estadistico']})  N(5%)={f['N_para_5pct_iqr']:.0f}  a N={N_ELEGIDO}: {f['peor_e95_sobre_iqr_pct_N_elegido']:.1f}%")


if __name__ == "__main__":
    resumen_por_portfolio()


def fig_criterio():
    """Peor error MC relativo al ancho de banda p25–p75, vista global y por escenario, vs N y costo."""
    tabla = json.loads((RES / "convergencia_tabla.json").read_text())
    Ns, casos = cargar()
    est_ok = ("mediana", "p25", "p75", "media")
    def peor(N, global_):
        return max(100 * v[str(N)] / v["iqr_pct"] for k, v in tabla.items()
                   if (k.split("|")[2] == "global") == global_ and k.split("|")[3] in est_ok and v["iqr_pct"] > 0.5)
    tiempos = [1000 * np.mean([casos[c]["por_N"][str(N)]["seg_por_corrida"] for c in casos if c.endswith("T36")]) for N in Ns]
    fig, ax = plt.subplots(figsize=(8.5, 4.6))
    ax.plot(Ns, [peor(N, True) for N in Ns], "o-", color="#264653", label="vista global (N trayectorias)")
    ax.plot(Ns, [peor(N, False) for N in Ns], "o-", color="#e76f51", label="vista por escenario (N/3 trayectorias)")
    ax.axhline(5, color="#264653", ls="--", lw=.8)
    ax.text(310, 5.4, "criterio: 5% de la banda (global y por escenario)", fontsize=8, color="#264653")
    ax.text(N_ANTERIOR * 1.06, 30, "N anterior\n3.000", fontsize=8, color="gray")
    ax.text(N_ELEGIDO * 1.06, 21, "N elegido\n15.000", fontsize=8)
    ax.axvline(N_ANTERIOR, color="gray", lw=1, ls="--"); ax.axvline(N_ELEGIDO, color="black", lw=1)
    ax.set_xscale("log")
    ax.set_xlabel("N (trayectorias totales)")
    ax.set_ylabel("Peor error MC 95% / ancho p25–p75 (%)")
    ax.set_title("¿Cuánto 'se mueve' una banda entre dos corridas? Peor caso de 6 portfolios × 2 horizontes")
    ax.grid(alpha=.3, which="both")
    ax2 = ax.twinx()
    ax2.plot(Ns, tiempos, "s:", color="gray", label="tiempo del motor, T=36 (ms)")
    ax2.set_ylabel("ms por simulación (T=36 meses)", color="gray")
    h1, l1 = ax.get_legend_handles_labels(); h2, l2 = ax2.get_legend_handles_labels()
    ax.legend(h1 + h2, l1 + l2, fontsize=8, loc="upper right")
    fig.tight_layout()
    fig.savefig(RES / "fig_criterio_N.png", dpi=150)


if __name__ == "__main__":
    fig_criterio()
