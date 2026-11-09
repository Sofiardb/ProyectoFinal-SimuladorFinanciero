"""
Extensión del estudio de convergencia a N = 51.000 (valor adoptado), 60.000 y 100.000 trayectorias.

Reutiliza exactamente el mismo procedimiento de estudio_convergencia.py (mismos portfolios,
mismos escenarios, 150 semillas por N con la misma regla 1000*N + r) y el mismo valor de
referencia ya calculado con N = 300.000, de modo que los nuevos puntos son directamente
comparables con los anteriores. Los resultados se agregan a los archivos conv_T*.json.

Uso (desde motor-simulacion/):
    python -m benchmarks.extender_convergencia --caso moderado_T36 [--N 51000]
    python -m benchmarks.extender_convergencia --unir        # agrega los resultados a conv_T*.json
"""
import argparse
import json
import time
from pathlib import Path

import numpy as np

from benchmarks.estudio_convergencia import PORTFOLIOS, correr, extraer

RES = Path(__file__).parent / "resultados"
NS_NUEVOS = [51_000, 60_000, 100_000]
R = 150


def archivo_de(caso):
    port, T = caso.split("_T")
    return RES / (f"conv_T{T}_cons.json" if port == "conservador" else f"conv_T{T}.json")


def correr_caso(caso, Ns):
    port, T = caso.split("_T")
    T = int(T)
    destino = RES / f"ext_{caso}.json"
    por_n = json.loads(destino.read_text()) if destino.exists() else {}
    for N in Ns:
        t0 = time.perf_counter()
        muestras = [extraer(correr(PORTFOLIOS[port], T, N, 1000 * N + r)) for r in range(R)]
        dt = (time.perf_counter() - t0) / R
        ref = json.loads(archivo_de(caso).read_text())["casos"][caso]["referencia"]
        stats = {}
        for k in muestras[0]:
            x = np.array([m[k] for m in muestras])
            stats[k] = {"media": float(x.mean()), "desvio": float(x.std(ddof=1)),
                        "sesgo": float(x.mean() - ref[k])}
        por_n[str(N)] = {"seg_por_corrida": dt, "stats": stats}
        print(f"{caso} N={N} {dt:.2f} s/corrida", flush=True)
    destino.write_text(json.dumps(por_n))


def unir():
    for f in sorted(RES.glob("ext_*.json")):
        caso = f.stem[4:]
        destino = archivo_de(caso)
        d = json.loads(destino.read_text())
        d["casos"][caso]["por_N"].update(json.loads(f.read_text()))
        d["Ns"] = sorted(set(d["Ns"]) | set(NS_NUEVOS))
        destino.write_text(json.dumps(d, indent=1))
        print("unido", caso, "->", destino.name)


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--caso", nargs="*", default=[])
    ap.add_argument("--N", type=int, nargs="*", default=None, help="valores de N a correr (por defecto, todos)")
    ap.add_argument("--unir", action="store_true")
    a = ap.parse_args()
    for c in a.caso:
        correr_caso(c, a.N or NS_NUEVOS)
    if a.unir:
        unir()
