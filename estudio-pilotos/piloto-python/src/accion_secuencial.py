"""
Piloto Python -- variante "for secuencial": sin NumPy, random.gauss() de la
libreria estandar. Replica la arquitectura real de orquestador.py: z_indice
se genera una vez, z_propio por instrumento, se combinan, y se llama a una
funcion pura con la misma formula que acciones.simular_accion_vectorizado().
"""
import math
import random
import sys
import time


def generar_normales(n_sim, t_meses, rng):
    return [[rng.gauss(0.0, 1.0) for _ in range(t_meses)] for _ in range(n_sim)]


def combinar_z_accion(rho, z_indice, z_propio):
    sqrt_rho2 = math.sqrt(1.0 - rho ** 2)
    return [
        [rho * z_indice[i][t] + sqrt_rho2 * z_propio[i][t] for t in range(len(z_indice[i]))]
        for i in range(len(z_indice))
    ]


def simular_accion_for(monto, mu, sigma, t_meses, z_accion):
    """Misma formula que acciones.simular_accion_vectorizado(), en for puro."""
    drift = (mu - 0.5 * sigma ** 2) / 12.0
    difusion = sigma / math.sqrt(12.0)
    trayectorias = []
    for fila in z_accion:
        acumulado = 0.0
        trayectoria = [monto]
        for z in fila:
            acumulado += drift + difusion * z
            trayectoria.append(monto * math.exp(acumulado))
        trayectorias.append(trayectoria)
    return trayectorias


def main():
    num_instrumentos = int(sys.argv[1]) if len(sys.argv) > 1 else 1
    num_simulaciones = int(sys.argv[2]) if len(sys.argv) > 2 else 3000
    t_meses = 12

    mu_base, sigma_base = 0.0528, 0.2583
    monto_por_instrumento = 100000.0
    rng = random.Random(12345)

    inicio = time.time()

    z_indice = generar_normales(num_simulaciones, t_meses, rng)

    valor_esperado = 0.0
    for i in range(num_instrumentos):
        mu = mu_base + 0.005 * ((i % 3) - 1)
        rho = 0.5 + 0.1 * ((i % 3) - 1)

        z_propio = generar_normales(num_simulaciones, t_meses, rng)
        z_accion = combinar_z_accion(rho, z_indice, z_propio)
        trayectorias = simular_accion_for(monto_por_instrumento, mu, sigma_base, t_meses, z_accion)

        valor_esperado += sum(tr[-1] for tr in trayectorias) / num_simulaciones

    tiempo_total = time.time() - inicio

    print(f"Valor esperado del portfolio: ${valor_esperado:.2f}")
    print("\n--- Performance ---")
    print(f"Tiempo total: {tiempo_total:.4f}s")


if __name__ == '__main__':
    main()
