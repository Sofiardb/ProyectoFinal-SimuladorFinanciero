"""
Piloto Python -- variante "for paralelizado": multiprocessing (el GIL impide
paralelismo real de CPU con threads sobre un for interpretado). Pool
persistente, creado una sola vez y reusado entre instrumentos. z_indice se
reparte en slices una unica vez antes del loop de instrumentos; cada slice
viaja como argumento de tarea (son unos pocos cientos de KB en total a esta
escala, picklearlos por instrumento no es el cuello de botella).
"""
import multiprocessing
import os
import random
import sys
import time

from accion_secuencial import generar_normales
from mp_worker import inicializar_worker, simular_chunk_en_worker


def repartir_en_slices(matriz, n_partes):
    n = len(matriz)
    base, resto = divmod(n, n_partes)
    slices = []
    inicio = 0
    for i in range(n_partes):
        tam = base + (1 if i < resto else 0)
        slices.append(matriz[inicio:inicio + tam])
        inicio += tam
    return [s for s in slices if s]


def main():
    num_instrumentos = int(sys.argv[1]) if len(sys.argv) > 1 else 1
    num_simulaciones = int(sys.argv[2]) if len(sys.argv) > 2 else 3000
    t_meses = 12
    n_workers = os.cpu_count() or 4

    mu_base, sigma_base = 0.0528, 0.2583
    monto_por_instrumento = 100000.0
    rng_maestro = random.Random(12345)

    inicio = time.time()

    z_indice = generar_normales(num_simulaciones, t_meses, rng_maestro)
    z_indice_slices = repartir_en_slices(z_indice, n_workers)
    semilla_base = rng_maestro.randrange(2**31)

    valor_esperado = 0.0
    with multiprocessing.Pool(
        processes=len(z_indice_slices),
        initializer=inicializar_worker,
        initargs=(semilla_base,),
    ) as pool:
        for i in range(num_instrumentos):
            mu = mu_base + 0.005 * ((i % 3) - 1)
            rho = 0.5 + 0.1 * ((i % 3) - 1)

            tareas = [
                (monto_por_instrumento, mu, sigma_base, t_meses, rho, slice_)
                for slice_ in z_indice_slices
            ]
            resultados = pool.starmap(simular_chunk_en_worker, tareas)

            suma_total = sum(suma for suma, _ in resultados)
            n_total = sum(n for _, n in resultados)
            valor_esperado += suma_total / n_total

    tiempo_total = time.time() - inicio

    print(f"Valor esperado del portfolio: ${valor_esperado:.2f}")
    print("\n--- Performance ---")
    print(f"Tiempo total: {tiempo_total:.4f}s")


if __name__ == '__main__':
    main()
