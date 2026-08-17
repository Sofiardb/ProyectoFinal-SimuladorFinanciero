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
        Simulación completamente vectorizada para múltiples empresas: sin bucle
        Python sobre las N empresas, solo operaciones NumPy con broadcasting
        sobre el eje (num_simulaciones, pasos, num_empresas).
        """
        dt = T / pasos

        # Parámetros por empresa como vectores (num_empresas,)
        rhos = np.array([e.rho for e in self.empresas])
        mus = np.array([e.mu for e in self.empresas])
        sigmas = np.array([e.sigma for e in self.empresas])
        s0s = np.array([e.S0 for e in self.empresas])
        cantidades = np.array([e.cantidad for e in self.empresas])

        sqrt_rho2 = np.sqrt(1.0 - rhos ** 2)

        # Factor de mercado compartido: (num_sim, pasos)
        Z_indice = np.random.standard_normal((num_simulaciones, pasos))

        # Variables propias por empresa: (num_sim, pasos, num_empresas)
        Z_propio = np.random.standard_normal((num_simulaciones, pasos, self.num_empresas))

        # Z_accion = ρ · Z_indice + √(1-ρ²) · Z_propio, broadcast sobre las N empresas
        Z_accion = rhos * Z_indice[:, :, None] + sqrt_rho2 * Z_propio

        # Incrementos logarítmicos: (num_sim, pasos, num_empresas)
        incrementos = (mus - 0.5 * sigmas ** 2) * dt + sigmas * np.sqrt(dt) * Z_accion

        # Log-retorno acumulado al final del horizonte = suma sobre los pasos
        log_retornos_finales = np.sum(incrementos, axis=1)  # (num_sim, num_empresas)

        # Precios finales por empresa: (num_sim, num_empresas)
        precios_finales = s0s * np.exp(log_retornos_finales)

        # Valor del portafolio: suma ponderada de todas las empresas
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
    # Segundo argumento opcional: cantidad de trayectorias Monte Carlo
    # (default: 3000, la escala real de motor-simulacion)
    num_simulaciones = int(sys.argv[2]) if len(sys.argv) > 2 else 3000

    # Cargar datos históricos (reutilizados N veces)
    json_path = os.path.join(os.path.dirname(__file__), '../../DatosAccionesDiaria.json')
    inicio_carga = time.time()
    loader = DatosAccionesLoader(json_path)
    mu, sigma = loader.calcular_parametros_gbm()
    tiempo_carga = time.time() - inicio_carga
    S0 = loader.get_precio_inicial()

    # Configuración
    T = 1
    pasos = 12

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
    print(f"Tiempo carga+params: {tiempo_carga:.4f}s")
    print(f"Tiempo total: {tiempo_total:.4f}s")
    print(f"Tiempo/simulacion: {(tiempo_total / num_simulaciones) * 1000:.6f}ms")
    print(f"Tiempo/empresa/simulacion: {(tiempo_total / (num_simulaciones * num_empresas)) * 1000:.6f}ms")


if __name__ == '__main__':
    main()
