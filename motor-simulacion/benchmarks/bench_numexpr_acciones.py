"""
Benchmark real (no un modelo aparte): mide si numexpr conviene para
simular_accion_vectorizado() TAL COMO ESTA HOY en produccion, barriendo
N_SIMULACIONES y T_meses -- para poder decidir si conviene sumarlo cuando
se suban trayectorias, sin tener que repetir el analisis a mano cada vez.

Uso:
    python benchmarks/bench_numexpr_acciones.py
    python benchmarks/bench_numexpr_acciones.py --n-sim 1000 3000 5000 --t-meses 12 24 36 60

Requiere numexpr instalado (no es dependencia de produccion, solo de este
benchmark): pip install numexpr
"""
import argparse
import json
import sys
import time
from pathlib import Path

import numpy as np

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
from app.simulacion.acciones import simular_accion_vectorizado

try:
    import numexpr as ne
except ImportError:
    print("ERROR: falta numexpr. Instalar con: pip install numexpr")
    sys.exit(1)


def simular_accion_numexpr(monto, mu, sigma, T_meses, z_matrix):
    """Misma funcion que simular_accion_vectorizado(), evaluando el tramo
    elemento-a-elemento con numexpr en vez de operaciones NumPy sueltas.
    Semanticamente identica -- ver test_equivalencia() mas abajo."""
    N = z_matrix.shape[0]
    drift = (mu - 0.5 * sigma**2) / 12
    difusion = sigma / np.sqrt(12)
    retornos_log = ne.evaluate("drift + difusion * z_matrix")
    retornos_acum = np.hstack([np.zeros((N, 1)), np.cumsum(retornos_log, axis=1)])
    return monto * np.exp(retornos_acum)


def test_equivalencia():
    """La variante numexpr tiene que dar exactamente lo mismo que la real,
    dado el mismo z_matrix -- si esto falla, el benchmark no vale nada."""
    rng = np.random.default_rng(42)
    z = rng.standard_normal((500, 24))
    r1 = simular_accion_vectorizado(100000.0, 0.08, 0.25, 24, z)
    r2 = simular_accion_numexpr(100000.0, 0.08, 0.25, 24, z)
    if not np.allclose(r1, r2):
        raise AssertionError("La variante numexpr no coincide con la funcion real -- revisar")


def bench(fn, args, iters):
    fn(*args)  # warm-up
    t0 = time.perf_counter()
    for _ in range(iters):
        fn(*args)
    return (time.perf_counter() - t0) / iters * 1000  # ms


def iters_para(n_sim, t_meses):
    """Menos iteraciones para combinaciones grandes, para no eternizar el benchmark."""
    tamano = n_sim * t_meses
    if tamano <= 50_000:
        return 300
    if tamano <= 500_000:
        return 100
    return 30


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--n-sim', type=int, nargs='+', default=[1000, 3000, 5000, 10000, 20000],
                         help='Valores de N_SIMULACIONES a barrer (default: escala actual + hipoteticas)')
    parser.add_argument('--t-meses', type=int, nargs='+', default=[12, 24, 36, 60],
                         help='Valores de T_meses a barrer (rango real: 1-60, HorizonteMeses)')
    args = parser.parse_args()

    print("=" * 90)
    print("BENCHMARK REAL: simular_accion_vectorizado() -- NumPy plano vs NumPy+numexpr")
    print("Usa la funcion de produccion (app/simulacion/acciones.py), sin reimplementar el modelo")
    print("=" * 90)

    test_equivalencia()
    print("[OK] La variante numexpr da resultados identicos a la funcion real (np.allclose)\n")

    rng = np.random.default_rng(0)
    monto, mu, sigma = 100000.0, 0.08, 0.25

    resultados = {}
    print(f"{'N_SIMULACIONES':>15} {'T_meses':>8} {'NumPy plano':>13} {'NumPy+numexpr':>15} {'Factor':>9} {'Ganador':>14}")
    print("-" * 90)

    for n_sim in args.n_sim:
        resultados[str(n_sim)] = {}
        for t_meses in args.t_meses:
            z = rng.standard_normal((n_sim, t_meses))
            iters = iters_para(n_sim, t_meses)

            t_plano = bench(simular_accion_vectorizado, (monto, mu, sigma, t_meses, z), iters)
            t_numexpr = bench(simular_accion_numexpr, (monto, mu, sigma, t_meses, z), iters)

            factor = max(t_plano, t_numexpr) / min(t_plano, t_numexpr)
            ganador = "numexpr" if t_numexpr < t_plano else "NumPy plano (actual)"

            print(f"{n_sim:>15} {t_meses:>8} {t_plano:>11.4f}ms {t_numexpr:>13.4f}ms {factor:>8.2f}x {ganador:>14}")

            resultados[str(n_sim)][str(t_meses)] = {
                'numpy_plano_ms': t_plano,
                'numpy_numexpr_ms': t_numexpr,
                'factor': factor,
                'ganador': ganador,
            }

    # --- Punto de cruce aproximado por T_meses ---
    print(f"\n{'='*90}")
    print("PUNTO DE CRUCE POR T_meses (a partir de que N_SIMULACIONES conviene numexpr)")
    print(f"{'='*90}\n")
    for t_meses in args.t_meses:
        cruces = [n for n in args.n_sim if resultados[str(n)][str(t_meses)]['ganador'] == 'numexpr']
        if cruces:
            print(f"  T_meses={t_meses:3d}: numexpr conviene desde N_SIMULACIONES >= {min(cruces)}")
        else:
            print(f"  T_meses={t_meses:3d}: numexpr no conviene en el rango barrido (probar N mas grande)")

    with open(Path(__file__).parent / 'resultados_numexpr_acciones.json', 'w') as f:
        json.dump(resultados, f, indent=2)

    print(f"\n[OK] Resultados guardados en benchmarks/resultados_numexpr_acciones.json")


if __name__ == '__main__':
    main()
