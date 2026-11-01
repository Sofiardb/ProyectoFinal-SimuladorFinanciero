"""Gráficos para el informe a partir de discretizacion.json y backtesting.json."""
import json
from pathlib import Path

import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
import numpy as np

RES = Path(__file__).parent / "resultados"


def fig_discretizacion():
    d = json.loads((RES / "discretizacion.json").read_text())
    claves = [k for k in d if "T=36" in k]
    etiquetas = [k.split("(")[1].split(":")[0] + "\nσ=" + k.split("sigma=")[1].split(")")[0] for k in claves]
    x = np.arange(len(claves))
    fig, axes = plt.subplots(1, 2, figsize=(12, 4.3))
    w = .27
    for i, (esq, col) in enumerate((("exacta", "#2a9d8f"), ("milstein", "#e9c46a"), ("euler", "#e76f51"))):
        axes[0].bar(x + (i - 1) * w, [d[k][esq]["error_fuerte_pct"] for k in claves], w, color=col, label=esq)
        axes[1].bar(x + (i - 1) * w, [abs(d[k][esq]["error_debil_pct"]["desvio"]) for k in claves], w, color=col, label=esq)
    axes[0].set_title("Error fuerte (trayectoria a trayectoria), T=36 meses, paso mensual")
    axes[0].set_ylabel("E|S_esquema − S_exacta| / S0  (%)")
    axes[1].set_title("Error en el desvío del valor final vs. analítico, T=36 meses")
    axes[1].set_ylabel("|error| (%)")
    for ax in axes:
        ax.set_xticks(x, etiquetas, fontsize=8)
        ax.legend()
        ax.grid(axis="y", alpha=.3)
    fig.tight_layout()
    fig.savefig(RES / "fig_discretizacion.png", dpi=150)


def fig_backtesting():
    d = json.loads((RES / "backtesting.json").read_text())
    fig, axes = plt.subplots(1, 2, figsize=(13, 4.5))
    # acciones h=3: bandas simuladas vs real
    a = d["acciones"]["h3"]
    t = np.arange(len(a))
    ax = axes[0]
    ax.fill_between(t, [100 * f["p5"] for f in a], [100 * f["p95"] for f in a], color="#8ecae6", alpha=.5, label="simulado p5–p95")
    ax.fill_between(t, [100 * f["p25"] for f in a], [100 * f["p75"] for f in a], color="#219ebc", alpha=.6, label="simulado p25–p75")
    ax.plot(t, [100 * f["mediana"] for f in a], color="#023047", lw=1, label="mediana simulada")
    ax.scatter(t, [100 * f["retorno_real"] for f in a], s=8, color="#fb8500", zorder=3, label="retorno real")
    ticks = list(range(0, len(a), 24))
    ax.set_xticks(ticks, [a[i]["origen"][:7] for i in ticks], fontsize=8)
    ax.set_ylabel("Retorno a 3 meses (%)")
    ax.set_title("IBM a 3 meses: simulado (N=15000) vs. real")
    ax.legend(fontsize=7, ncol=2)
    ax.grid(alpha=.3)
    # inflación h=3: real vs bandas globales y por escenario
    v = d["inflacion"]["h3"]["ventanas"]
    s = d["inflacion"]["h3"]["simulado"]
    ax = axes[1]
    t = np.arange(len(v))
    from benchmarks.estudio_convergencia import ESCENARIOS
    for nombre, col in (("favorable", "#2a9d8f"), ("moderado", "#e9c46a"), ("desfavorable", "#e76f51")):
        e = ESCENARIOS[nombre]
        lo, hi = (1 + e["inflacion_mensual_min"]) ** 3 - 1, (1 + e["inflacion_mensual_max"]) ** 3 - 1
        ax.axhspan(100 * lo, 100 * hi, color=col, alpha=.22, label=f"rango escenario {nombre}")
    ax.plot(t, [100 * x["real"] for x in v], "o-", ms=2.5, color="#023047", label="inflación real acumulada 3m (INDEC)")
    ticks = list(range(0, len(v), 12))
    ax.set_xticks(ticks, [v[i]["desde"] for i in ticks], fontsize=8)
    ax.set_yscale("log")
    ax.set_ylabel("Inflación acumulada 3 meses (%) — escala log")
    ax.set_title("Inflación a 3 meses: escenarios del motor vs. real")
    ax.legend(fontsize=7, loc="upper left")
    ax.grid(alpha=.3, which="both")
    fig.tight_layout()
    fig.savefig(RES / "fig_backtesting.png", dpi=150)


if __name__ == "__main__":
    fig_discretizacion()
    fig_backtesting()
