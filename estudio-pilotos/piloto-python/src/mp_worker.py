"""
Funciones worker para el Pool de multiprocessing (variante "for paralelizado").
Deben ser de nivel de modulo para ser picklables bajo el modo "spawn" de
Windows. Cada worker recibe su propia semilla derivada de su PID (unico
entre los procesos persistentes del pool) via el initializer del Pool --
nunca la misma semilla para todos, para no correlacionar resultados.
"""
import os
import random

from accion_secuencial import generar_normales, combinar_z_accion, simular_accion_for

_RNG = None


def inicializar_worker(semilla_base):
    global _RNG
    _RNG = random.Random(semilla_base + os.getpid())


def simular_chunk_en_worker(monto, mu, sigma, t_meses, rho, z_indice_slice):
    n_sim = len(z_indice_slice)
    z_propio = generar_normales(n_sim, t_meses, _RNG)
    z_accion = combinar_z_accion(rho, z_indice_slice, z_propio)
    trayectorias = simular_accion_for(monto, mu, sigma, t_meses, z_accion)
    return sum(tr[-1] for tr in trayectorias), n_sim
