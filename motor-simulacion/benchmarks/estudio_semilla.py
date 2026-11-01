"""
Verificaciones sobre el generador pseudoaleatorio del motor (PCG64 vía np.random.default_rng).

1. Reproducibilidad: misma semilla -> resultados bit a bit idénticos; semillas distintas -> distintos.
2. Calidad estadística básica de los flujos que usa el motor (normales y uniformes):
   Kolmogorov-Smirnov, media/varianza y autocorrelación de lag 1 sobre 15000 x 36 valores.
3. Probabilidad de colisión de semillas en [0, 2^31) (problema del cumpleaños).

Uso (desde motor-simulacion/): python -m benchmarks.estudio_semilla
"""
import json
from pathlib import Path

import numpy as np
from scipy import stats

from benchmarks.estudio_convergencia import PORTFOLIOS, correr


def main():
    out = {"generador": np.random.default_rng().bit_generator.__class__.__name__, "numpy": np.__version__}
    a = correr(PORTFOLIOS["agresivo"], 12, 15000, 42)
    b = correr(PORTFOLIOS["agresivo"], 12, 15000, 42)
    c = correr(PORTFOLIOS["agresivo"], 12, 15000, 43)
    out["misma_semilla_identico"] = json.dumps(a, sort_keys=True) == json.dumps(b, sort_keys=True)
    out["semilla_distinta_difiere"] = json.dumps(a, sort_keys=True) != json.dumps(c, sort_keys=True)

    rng = np.random.default_rng(int(np.random.default_rng(7).integers(0, 2**31)))
    z = rng.standard_normal((15000, 36)).ravel()
    u = rng.uniform(0.015, 0.040, (15000, 36)).ravel()
    out["normales"] = {"n": z.size, "media": float(z.mean()), "var": float(z.var()),
                       "ks_pvalor": float(stats.kstest(z, "norm").pvalue),
                       "autocorr_lag1": float(np.corrcoef(z[:-1], z[1:])[0, 1])}
    out["uniformes"] = {"n": u.size, "ks_pvalor": float(stats.kstest(u, "uniform", args=(0.015, 0.025)).pvalue),
                        "autocorr_lag1": float(np.corrcoef(u[:-1], u[1:])[0, 1])}
    out["prob_colision_semillas"] = {str(n): float(1 - np.exp(-n * (n - 1) / 2 / 2**31)) for n in (1_000, 10_000, 50_000)}
    salida = Path(__file__).parent / "resultados"
    (salida / "semilla.json").write_text(json.dumps(out, indent=1))
    print(json.dumps(out, indent=1))


if __name__ == "__main__":
    main()
