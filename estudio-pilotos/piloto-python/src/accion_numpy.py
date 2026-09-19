"""
Piloto Python -- variante "NumPy vectorizado". No reimplementa la formula:
importa simular_accion_vectorizado() directo de motor-simulacion/ -- esta
variante mide produccion real, no un modelo parecido.
"""
import sys
import time
from pathlib import Path

import numpy as np

sys.path.insert(0, str(Path(__file__).resolve().parents[3] / "motor-simulacion"))
from app.simulacion.acciones import simular_accion_vectorizado


def main():
    num_instrumentos = int(sys.argv[1]) if len(sys.argv) > 1 else 1
    num_simulaciones = int(sys.argv[2]) if len(sys.argv) > 2 else 3000
    t_meses = 12

    mu_base, sigma_base = 0.0528, 0.2583
    monto_por_instrumento = 100000.0
    rng = np.random.default_rng(12345)

    inicio = time.time()

    z_indice = rng.standard_normal((num_simulaciones, t_meses))

    valor_esperado = 0.0
    for i in range(num_instrumentos):
        mu = mu_base + 0.005 * ((i % 3) - 1)
        rho = 0.5 + 0.1 * ((i % 3) - 1)

        z_propio = rng.standard_normal((num_simulaciones, t_meses))
        z_accion = rho * z_indice + np.sqrt(1.0 - rho ** 2) * z_propio

        trayectorias = simular_accion_vectorizado(monto_por_instrumento, mu, sigma_base, t_meses, z_accion)
        valor_esperado += float(np.mean(trayectorias[:, -1]))

    tiempo_total = time.time() - inicio

    print(f"Valor esperado del portfolio: ${valor_esperado:.2f}")
    print("\n--- Performance ---")
    print(f"Tiempo total: {tiempo_total:.4f}s")


if __name__ == '__main__':
    main()
