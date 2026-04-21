"""
Piloto Python OPTIMIZADO (NumPy) - ESCALABLE para N empresas
Simulación vectorizada de múltiples empresas con correlaciones
"""
import math
import time
from typing import Dict, List
import os
import sys
import numpy as np

# Configurar encoding para Windows
if sys.platform == 'win32':
    import io
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

from data_loader import DatosAccionesLoader


class Empresa:
    """Representa una empresa en el portafolio"""
    def __init__(self, nombre: str, mu: float, sigma: float, S0: float, rho: float, cantidad: int):
        self.nombre = nombre
        self.mu = mu
        self.sigma = sigma
        self.S0 = S0
        self.rho = rho
        self.cantidad = cantidad


class MonteCarloPythonNumPyMulti:
    """Simulación Monte Carlo VECTORIZADA para N empresas"""

    def __init__(self, empresas: List[Empresa]):
        self.empresas = empresas
        self.num_empresas = len(empresas)

    def simular_monte_carlo_vectorizado(self, T: int, pasos: int, num_simulaciones: int) -> Dict:
        """
        Simulación vectorizada para múltiples empresas
        Matrices: (num_simulaciones x pasos) para Z_indice
                  (num_simulaciones x pasos x num_empresas) para Z_propio
        """
        dt = T / pasos

        # Factor de mercado compartido: (num_sim, pasos)
        Z_indice = np.random.standard_normal((num_simulaciones, pasos))

        # Variables propias por empresa: (num_sim, pasos, num_empresas)
        Z_propio = np.random.standard_normal((num_simulaciones, pasos, self.num_empresas))

        # Precios finales por empresa: (num_sim, num_empresas)
        precios_finales = np.zeros((num_simulaciones, self.num_empresas))

        # Calcular para cada empresa
        for emp_idx, empresa in enumerate(self.empresas):
            # Factor sistemático: Z_accion = ρ * Z_indice + √(1-ρ²) * Z_propio
            sqrt_rho2 = np.sqrt(1.0 - empresa.rho ** 2)
            Z_accion = empresa.rho * Z_indice + sqrt_rho2 * Z_propio[:, :, emp_idx]

            # Incrementos logarítmicos
            incrementos = (empresa.mu - 0.5 * empresa.sigma ** 2) * dt + empresa.sigma * np.sqrt(dt) * Z_accion

            # Precios finales de esta empresa
            log_retornos = np.cumsum(incrementos, axis=1)
            precios_finales[:, emp_idx] = empresa.S0 * np.exp(log_retornos[:, -1])

        # Valor del portafolio: suma ponderada de todas las empresas
        cantidades = np.array([e.cantidad for e in self.empresas])
        valor_portafolio = np.sum(precios_finales * cantidades, axis=1)

        # Estadísticas
        return {
            'retorno_esperado': float(np.mean(valor_portafolio)),
            'min': float(np.min(valor_portafolio)),
            'max': float(np.max(valor_portafolio)),
            'volatilidad': float(np.std(valor_portafolio)),
            'percentil_5': float(np.percentile(valor_portafolio, 5)),
            'percentil_95': float(np.percentile(valor_portafolio, 95)),
        }


def main():
    print("=" * 70)
    print("PILOTO PYTHON (NumPy) ESCALABLE - Múltiples Empresas con Correlaciones")
    print("=" * 70)

    # Argumentos
    import sys
    num_empresas = int(sys.argv[1]) if len(sys.argv) > 1 else 1

    # Cargar datos históricos (reutilizados N veces)
    json_path = os.path.join(os.path.dirname(__file__), '../../DatosAccionesDiaria.json')
    loader = DatosAccionesLoader(json_path)
    mu, sigma = loader.calcular_parametros_gbm()
    S0 = loader.get_precio_inicial()

    # Configuración
    T = 1
    pasos = 12
    num_simulaciones = 10000

    print(f"\n--- Configuracion ---")
    print(f"Numero de empresas: {num_empresas}")
    print(f"Simulaciones: {num_simulaciones}")
    print(f"Pasos: {pasos}")
    print(f"Datos historicos: {loader.symbol} (reutilizados)")

    # Crear lista de empresas (reutilizando los mismos parámetros con variaciones)
    empresas = []
    for i in range(num_empresas):
        # Variar ligeramente mu y rho para simular empresas diferentes
        mu_variada = mu + (0.005 * ((i % 3) - 1))  # Variacion ±0.5%
        rho_variada = 0.5 + (0.1 * ((i % 3) - 1))  # Correlacion entre 0.4-0.6

        empresas.append(Empresa(
            nombre=f"Empresa_{i+1}",
            mu=mu_variada,
            sigma=sigma,
            S0=S0,
            rho=rho_variada,
            cantidad=100  # 100 acciones por empresa
        ))

    print(f"\n--- Parametros por Empresa ---")
    for emp in empresas:
        print(f"{emp.nombre}: mu={emp.mu:.4f} sigma={emp.sigma:.4f} rho={emp.rho:.2f}")

    # Ejecutar simulación
    mc = MonteCarloPythonNumPyMulti(empresas)

    inicio = time.time()
    resultados = mc.simular_monte_carlo_vectorizado(T, pasos, num_simulaciones)
    tiempo_total = time.time() - inicio

    print(f"\n--- Resultados Portafolio ---")
    print(f"Retorno esperado: ${resultados['retorno_esperado']:.2f}")
    print(f"Minimo: ${resultados['min']:.2f}")
    print(f"Maximo: ${resultados['max']:.2f}")
    print(f"Volatilidad: {resultados['volatilidad']:.2f}")
    print(f"P5: ${resultados['percentil_5']:.2f}")
    print(f"P95: ${resultados['percentil_95']:.2f}")

    print(f"\n--- Performance ---")
    print(f"Tiempo total: {tiempo_total:.4f}s")
    print(f"Tiempo/simulacion: {(tiempo_total / num_simulaciones) * 1000:.6f}ms")
    print(f"Tiempo/empresa/simulacion: {(tiempo_total / (num_simulaciones * num_empresas)) * 1000:.6f}ms")


if __name__ == '__main__':
    main()
