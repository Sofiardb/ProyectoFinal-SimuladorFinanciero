"""
Tiempo y memoria máxima del motor en función de N (portfolio moderado y agresivo, T = 36 meses).

Cada medición se hace en un proceso nuevo para que la memoria máxima (ru_maxrss) corresponda a esa
única simulación. Uso (desde motor-simulacion/):  python -m benchmarks.costo_por_N
Salida: resultados/costo_por_N.json
"""
import json
import resource
import subprocess
import sys
import time
from pathlib import Path

RES = Path(__file__).parent / "resultados"
NS = [3_000, 15_000, 30_000, 60_000, 100_000, 300_000]
REPS = 3


def medir_uno(port, T, N):
    from benchmarks.estudio_convergencia import PORTFOLIOS, correr
    correr(PORTFOLIOS[port], T, 1000, 0)                      # calentamiento (imports, caches)
    t0 = time.perf_counter()
    correr(PORTFOLIOS[port], T, N, 1)
    dt = time.perf_counter() - t0
    mem_mb = resource.getrusage(resource.RUSAGE_SELF).ru_maxrss / 1024
    print(json.dumps({"seg": dt, "mem_mb": mem_mb}))


def main():
    out = []
    for port in ("moderado", "agresivo"):
        for N in NS:
            ms = []
            for _ in range(REPS):
                r = subprocess.run([sys.executable, "-m", "benchmarks.costo_por_N", "--uno", port, "36", str(N)],
                                   capture_output=True, text=True, check=True)
                ms.append(json.loads(r.stdout.strip().splitlines()[-1]))
            fila = {"portfolio": port, "T": 36, "N": N,
                    "seg": min(m["seg"] for m in ms), "mem_mb": max(m["mem_mb"] for m in ms)}
            out.append(fila)
            print(fila, flush=True)
    (RES / "costo_por_N.json").write_text(json.dumps(out, indent=1))


if __name__ == "__main__":
    if len(sys.argv) > 1 and sys.argv[1] == "--uno":
        medir_uno(sys.argv[2], int(sys.argv[3]), int(sys.argv[4]))
    else:
        main()
