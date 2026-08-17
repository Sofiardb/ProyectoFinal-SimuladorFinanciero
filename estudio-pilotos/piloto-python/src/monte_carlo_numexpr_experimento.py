"""
Experimento: ¿ayuda el multi-threading (numexpr) a que NumPy alcance el
paralelismo multi-núcleo de Parallel.For en C#? ¿Causa problemas correrlo
en un host de 1 sola CPU?

Reimplementa el mismo modelo que monte_carlo_python_numpy.py, pero evalúa
el tramo elemento-a-elemento (Z_accion + incrementos) con numexpr, que sí
reparte esas operaciones entre varios hilos nativos (a diferencia de los
ufuncs planos de NumPy, que corren en un solo núcleo).
"""
import math
import time
import os
import sys
import numpy as np
import numexpr as ne

sys.path.insert(0, os.path.dirname(__file__))
from data_loader import DatosAccionesLoader
from monte_carlo_python_numpy import Empresa  # ya reconfigura sys.stdout a UTF-8 en win32 al importarse


class MonteCarloNumexprMulti:
    def __init__(self, empresas):
        self.empresas = empresas
        self.num_empresas = len(empresas)

    def simular(self, T: int, pasos: int, num_simulaciones: int):
        dt = T / pasos
        sqrt_dt = math.sqrt(dt)
        E = self.num_empresas

        rhos = np.array([e.rho for e in self.empresas]).reshape(1, 1, E)
        mus = np.array([e.mu for e in self.empresas]).reshape(1, 1, E)
        sigmas = np.array([e.sigma for e in self.empresas]).reshape(1, 1, E)
        s0s = np.array([e.S0 for e in self.empresas])
        cantidades = np.array([e.cantidad for e in self.empresas])
        sqrt_rho2 = np.sqrt(1.0 - rhos ** 2)

        Z_indice = np.random.standard_normal((num_simulaciones, pasos, 1))
        Z_propio = np.random.standard_normal((num_simulaciones, pasos, E))

        shape_completa = (num_simulaciones, pasos, E)
        Z_indice_b = np.broadcast_to(Z_indice, shape_completa)
        rhos_b = np.broadcast_to(rhos, shape_completa)
        mus_b = np.broadcast_to(mus, shape_completa)
        sigmas_b = np.broadcast_to(sigmas, shape_completa)
        sqrt_rho2_b = np.broadcast_to(sqrt_rho2, shape_completa)

        # Tramo elemento-a-elemento evaluado con numexpr (multi-hilo, JIT a C)
        incrementos = ne.evaluate(
            "(mus_b - 0.5*sigmas_b**2)*dt + sigmas_b*sqrt_dt*(rhos_b*Z_indice_b + sqrt_rho2_b*Z_propio)"
        )

        log_retornos_finales = incrementos.sum(axis=1)
        precios_finales = s0s * np.exp(log_retornos_finales)
        valor_portafolio = np.sum(precios_finales * cantidades, axis=1)

        return {
            'retorno_esperado': float(np.mean(valor_portafolio)),
            'min': float(np.min(valor_portafolio)),
            'max': float(np.max(valor_portafolio)),
            'volatilidad': float(np.std(valor_portafolio)),
            'percentil_5': float(np.percentile(valor_portafolio, 5)),
            'percentil_95': float(np.percentile(valor_portafolio, 95)),
        }


def main():
    num_empresas = int(sys.argv[1]) if len(sys.argv) > 1 else 1
    # Segundo argumento opcional: cantidad de trayectorias Monte Carlo
    # (default: 3000, la escala real de motor-simulacion)
    num_simulaciones = int(sys.argv[2]) if len(sys.argv) > 2 else 3000

    json_path = os.path.join(os.path.dirname(__file__), '../../DatosAccionesDiaria.json')
    inicio_carga = time.time()
    loader = DatosAccionesLoader(json_path)
    mu, sigma = loader.calcular_parametros_gbm()
    tiempo_carga = time.time() - inicio_carga
    S0 = loader.get_precio_inicial()

    T, pasos = 1, 12

    empresas = []
    for i in range(num_empresas):
        mu_variada = mu + (0.005 * ((i % 3) - 1))
        rho_variada = 0.5 + (0.1 * ((i % 3) - 1))
        empresas.append(Empresa(f"Empresa_{i+1}", mu_variada, sigma, S0, rho_variada, 100))

    mc = MonteCarloNumexprMulti(empresas)

    # Warm-up: numexpr compila y cachea la expresión en la primera llamada;
    # no queremos medir ese costo de compilación como si fuera simulación.
    mc.simular(T, pasos, 100)

    inicio = time.time()
    resultados = mc.simular(T, pasos, num_simulaciones)
    tiempo_total = time.time() - inicio

    print(f"NUMEXPR_NUM_THREADS: {os.environ.get('NUMEXPR_NUM_THREADS', 'auto (todos los núcleos)')}")
    print(f"Retorno esperado: ${resultados['retorno_esperado']:.2f}")
    print(f"\n--- Performance ---")
    print(f"Tiempo carga+params: {tiempo_carga:.4f}s")
    print(f"Tiempo total: {tiempo_total:.4f}s")


if __name__ == '__main__':
    main()
