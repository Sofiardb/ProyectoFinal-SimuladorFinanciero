"""
Estudio de convergencia del Monte Carlo — justificación empírica de N_SIMULACIONES (3000 original → 15000 elegido).

Ejecuta el orquestador REAL (app.simulacion.orquestador.simular_portfolio) variando la
cantidad de trayectorias N y la semilla, y mide cuánto fluctúan entre corridas las
estadísticas que el sistema muestra al usuario (mediana, p25, p75, media) para tres
portfolios tipo (conservador, moderado, agresivo), globalmente y por escenario.

La fluctuación entre corridas independientes con el mismo N ES el error de Monte Carlo:
si dos usuarios simulan el mismo portfolio, sus resultados difieren en esa magnitud.

Uso (desde motor-simulacion/):
    python -m benchmarks.estudio_convergencia            # corrida completa
    python -m benchmarks.estudio_convergencia --rapido   # versión corta para probar

Salida: benchmarks/resultados/convergencia.json
"""
import argparse
import copy
import json
import time
from pathlib import Path

import numpy as np

import app.simulacion.orquestador as orq

# Rangos de inflación mensual vigentes en producción (db/01_schema.sql)
ESCENARIOS = {
    "favorable":    {"inflacion_mensual_min": 0.005, "inflacion_mensual_max": 0.015,
                     "inflacion_mensual_min_usd": 0.000, "inflacion_mensual_max_usd": 0.002},
    "moderado":     {"inflacion_mensual_min": 0.015, "inflacion_mensual_max": 0.040,
                     "inflacion_mensual_min_usd": 0.002, "inflacion_mensual_max_usd": 0.004},
    "desfavorable": {"inflacion_mensual_min": 0.040, "inflacion_mensual_max": 0.080,
                     "inflacion_mensual_min_usd": 0.004, "inflacion_mensual_max_usd": 0.008},
}


def _bono_bullet(monto, tir, meses):
    return [{"mes": meses, "monto": monto * (1 + tir) ** (meses / 12)}]


def _bono_idx_bullet(monto, tir_real, meses):
    return [{"mes": meses, "capital_adj": monto * (1 + tir_real) ** (meses / 12), "interest_adj": 0.0}]


PORTFOLIOS = {
    "conservador": [
        {"id": "pf", "tipo": "plazo_fijo_tradicional", "monto": 400_000, "tna": 0.30, "t_venc_meses": 1, "reinvertir": True},
        {"id": "pfuva", "tipo": "plazo_fijo_uva", "monto": 300_000, "tasa_real_anual": 0.01, "t_venc_meses": 3, "reinvertir": True},
        {"id": "lecer", "tipo": "lecer", "monto": 200_000, "tna": 0.04, "t_venc_meses": 12},
        # perfil conservador: sigma_max_accion = 0 (db/01_schema.sql) -> sin acciones
        {"id": "pfusd", "tipo": "plazo_fijo_usd", "monto": 100_000, "tna": 0.02, "t_venc_meses": 1, "reinvertir": True},
    ],
    "moderado": [
        {"id": "lecap", "tipo": "lecap", "monto": 200_000, "tna": 0.32, "t_venc_meses": 6},
        {"id": "boncer", "tipo": "bono_indexado", "monto": 250_000,
         "flujos_base": _bono_idx_bullet(250_000, 0.06, 24), "tir_real": 0.06},
        {"id": "bonofijo", "tipo": "bono_tasa_fija", "monto": 150_000,
         "flujos": _bono_bullet(150_000, 0.35, 18), "tir": 0.35},
        {"id": "spy", "tipo": "accion", "monto": 200_000, "mu": 0.10, "sigma": 0.18, "rho": 0.95},
        {"id": "ko", "tipo": "accion", "monto": 200_000, "mu": 0.07, "sigma": 0.20, "rho": 0.55},
    ],
    "agresivo": [
        {"id": "lecer", "tipo": "lecer", "monto": 100_000, "tna": 0.04, "t_venc_meses": 12},
        {"id": "aapl", "tipo": "accion", "monto": 300_000, "mu": 0.20, "sigma": 0.30, "rho": 0.75},
        {"id": "nvda", "tipo": "accion", "monto": 300_000, "mu": 0.35, "sigma": 0.50, "rho": 0.65},
        {"id": "tsla", "tipo": "accion", "monto": 300_000, "mu": 0.25, "sigma": 0.60, "rho": 0.50},
    ],
}

# (clave de salida, ruta dentro del resultado del motor)
METRICAS = [
    ("ars_patrimonio",       ("portfolio_ars", "patrimonio")),
    ("ars_ganancia_real",    ("portfolio_ars", "ganancias_reales")),
    ("usd_patrimonio",       ("portfolio_usd", "patrimonio")),
    ("usd_ganancia_real",    ("portfolio_usd", "ganancias_reales")),
]
VISTAS = ["global", "favorable", "moderado", "desfavorable"]
ESTADISTICOS = ["media", "mediana", "p25", "p75", "minimo", "maximo"]


def correr(instrumentos, T, N, semilla):
    """Llama al motor real con N trayectorias y una semilla controlada.

    El motor genera su semilla con np.random.default_rng() sin argumentos; se sustituye esa
    fuente de entropía por una controlada para que el experimento sea reproducible."""
    orig_n, orig_rng = orq.N_SIMULACIONES, orq.np.random.default_rng
    fuente = orig_rng(semilla)

    def rng_controlado(seed=None):
        return orig_rng(seed) if seed is not None else fuente

    orq.N_SIMULACIONES = N
    orq.np.random.default_rng = rng_controlado
    try:
        return orq.simular_portfolio({"T_meses": T, "escenarios": ESCENARIOS,
                                      "instrumentos": copy.deepcopy(instrumentos)})
    finally:
        orq.N_SIMULACIONES = orig_n
        orq.np.random.default_rng = orig_rng


def extraer(res):
    """Valores al mes final T de cada (métrica, vista, estadístico)."""
    out = {}
    for clave, (a, b) in METRICAS:
        bloque = res[a][b]
        for v in VISTAS:
            for e in ESTADISTICOS:
                out[f"{clave}|{v}|{e}"] = bloque[v][e][-1]
    return out


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--rapido", action="store_true")
    ap.add_argument("--T", type=int, nargs="+", default=[12, 36])
    ap.add_argument("--salida", default="convergencia.json")
    ap.add_argument("--portfolios", nargs="+", default=list(PORTFOLIOS))
    args = ap.parse_args()

    Ns = [300, 600, 1500, 3000, 6000, 15000, 30000]
    R = 40 if args.rapido else 150            # repeticiones independientes por N
    N_REF, R_REF = 300_000, 3                 # "valor verdadero" de referencia

    resultados = {"Ns": Ns, "R": R, "N_ref": N_REF, "escenarios": ESCENARIOS, "casos": {}}
    for T in args.T:
        for nombre, inst in ((p, PORTFOLIOS[p]) for p in args.portfolios):
            caso = f"{nombre}_T{T}"
            print(f"== {caso}")
            ref_runs = [extraer(correr(inst, T, N_REF, 10_000_000 + k)) for k in range(R_REF)]
            ref = {k: float(np.mean([r[k] for r in ref_runs])) for k in ref_runs[0]}
            por_n = {}
            for N in Ns:
                t0 = time.perf_counter()
                muestras = [extraer(correr(inst, T, N, 1000 * N + r)) for r in range(R)]
                dt = (time.perf_counter() - t0) / R
                stats = {}
                for k in muestras[0]:
                    x = np.array([m[k] for m in muestras])
                    stats[k] = {"media": float(x.mean()), "desvio": float(x.std(ddof=1)),
                                "sesgo": float(x.mean() - ref[k])}
                por_n[str(N)] = {"seg_por_corrida": dt, "stats": stats}
                print(f"   N={N:>6}  {dt*1000:7.1f} ms/corrida")
            resultados["casos"][caso] = {"referencia": ref, "por_N": por_n}

    salida = Path(__file__).parent / "resultados"
    salida.mkdir(exist_ok=True)
    (salida / args.salida).write_text(json.dumps(resultados, indent=1))
    print("OK ->", salida / args.salida)


if __name__ == "__main__":
    main()
