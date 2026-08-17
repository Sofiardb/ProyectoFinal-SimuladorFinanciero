"""
Script de benchmark ESCALABLE - C# vs Python (NumPy + numexpr) con N empresas
Mide cómo escala la performance con múltiples empresas, en 4 variantes:
C#/Python x multi-núcleo/1-núcleo (ver Benchmark 1 en INFORME_BENCHMARKS.md)
"""
import subprocess
import json
import re
import time
import os
import sys
import platform


PATRON_TIEMPO_SIM = re.compile(r"Tiempo total:\s*([\d.]+)s")
PATRON_TIEMPO_CARGA = re.compile(r"Tiempo carga\+params:\s*([\d.]+)s")


def parsear_performance(stdout):
    """Extrae del stdout del piloto el tiempo de carga+parámetros y el tiempo
    de simulación pura, ambos impresos bajo la sección '--- Performance ---'."""
    m_sim = PATRON_TIEMPO_SIM.search(stdout)
    m_carga = PATRON_TIEMPO_CARGA.search(stdout)
    tiempo_sim = float(m_sim.group(1)) if m_sim else None
    tiempo_carga = float(m_carga.group(1)) if m_carga else None
    return tiempo_carga, tiempo_sim


def promedio(corridas, clave):
    """Promedio de una clave sobre una lista de corridas (dicts), ignorando None."""
    valores = [c[clave] for c in corridas if c.get(clave) is not None]
    return sum(valores) / len(valores) if valores else None


def verificar_numpy():
    """Verifica si NumPy está instalado."""
    try:
        import numpy
        return True
    except ImportError:
        return False


def ejecutar_benchmark_n_empresas():
    """Ejecuta benchmark para 1, 5, 10, 20 empresas"""

    print("\n" + "=" * 80)
    print("BENCHMARK ESCALABLE - C# vs Python (NumPy + numexpr) - N Empresas con Correlaciones")
    print("=" * 80)

    # Verificar NumPy
    if not verificar_numpy():
        print("\n⚠️  NumPy no está instalado. Instalando...")
        python_cmd = "python" if platform.system() == "Windows" else "python3"
        resultado = subprocess.run(
            [python_cmd, "-m", "pip", "install", "numpy"],
            capture_output=True,
            text=True,
            timeout=120
        )
        if resultado.returncode != 0:
            print("❌ Error instalando NumPy")
            return
        print("✓ NumPy instalado correctamente\n")

    # Configuración
    c_sharp_dir = "piloto-csharp"
    python_dir = "piloto-python/src"
    python_cmd = "python" if platform.system() == "Windows" else "python3"

    # Números de empresas a probar
    num_empresas_lista = [1, 5, 10, 20]
    iteraciones = 2  # Menos iteraciones para mayor cantidad de empresas

    # Cantidad de trayectorias Monte Carlo por corrida. 3000 es la escala real
    # de motor-simulacion (N_SIMULACIONES en orquestador.py) -- se parametriza
    # para poder re-correr este mismo benchmark a otra escala si el sistema
    # cambia N_SIMULACIONES en el futuro.
    num_simulaciones = int(sys.argv[1]) if len(sys.argv) > 1 else 3000
    print(f"[CONFIG] num_simulaciones = {num_simulaciones}")

    resultados_escalabilidad = {
        'csharp': {},
        'python_numexpr': {},
        'csharp_1cpu': {},
        'python_numexpr_1cpu': {},
        'python_plano': {},
        'python_plano_1cpu': {}
    }

    # Variables de entorno que fuerzan a NumPy/BLAS a usar un solo hilo,
    # para simular un hosting de 1 sola CPU en el lado Python
    env_1cpu = {
        **os.environ, 'PYTHONUNBUFFERED': '1', 'PYTHONIOENCODING': 'utf-8',
        'OMP_NUM_THREADS': '1', 'OPENBLAS_NUM_THREADS': '1',
        'MKL_NUM_THREADS': '1', 'NUMEXPR_NUM_THREADS': '1',
        'VECLIB_MAXIMUM_THREADS': '1'
    }

    # === COMPILAR C# UNA SOLA VEZ ===
    print(f"[PREP] Compilando C# en Release...")
    resultado_compilacion = subprocess.run(
        ["dotnet", "build", "-c", "Release"],
        cwd=c_sharp_dir,
        capture_output=True,
        text=True,
        timeout=60
    )
    if resultado_compilacion.returncode != 0:
        print(f"❌ ERROR en compilación C#")
        return
    print("✓ C# compilado\n")

    # === BENCHMARK PARA CADA N ===
    for num_empresas in num_empresas_lista:
        print(f"\n{'='*80}")
        print(f"EJECUTANDO CON {num_empresas} EMPRESA(S)")
        print(f"{'='*80}")

        resultados_escalabilidad['csharp'][num_empresas] = []
        resultados_escalabilidad['python_numexpr'][num_empresas] = []

        # --- C# ---
        print(f"\n[C#] {iteraciones} iteraciones con {num_empresas} empresa(s)...")
        for i in range(iteraciones):
            print(f"  Iteración {i+1}/{iteraciones}...", end=" ", flush=True)
            inicio = time.time()
            resultado = subprocess.run(
                ["dotnet", "run", "-c", "Release", "--no-build", "--",
                 str(num_empresas), "-1", str(num_simulaciones)],
                cwd=c_sharp_dir,
                capture_output=True,
                text=True,
                encoding='utf-8',
                errors='replace',
                timeout=300
            )
            tiempo_wall = time.time() - inicio

            if resultado.returncode == 0:
                tiempo_carga, tiempo_sim = parsear_performance(resultado.stdout)
                overhead = (tiempo_wall - tiempo_carga - tiempo_sim) \
                    if tiempo_carga is not None and tiempo_sim is not None else None
                resultados_escalabilidad['csharp'][num_empresas].append({
                    'wall_total': tiempo_wall,
                    'carga_params': tiempo_carga,
                    'simulacion_pura': tiempo_sim,
                    'overhead_proceso': overhead
                })
                print(f"✓ wall={tiempo_wall:.4f}s  carga={tiempo_carga:.4f}s  sim={tiempo_sim:.4f}s")
            else:
                print(f"✗ ERROR")

        # --- Python + NumPy + numexpr (multi-núcleo) ---
        print(f"\n[Python numexpr] {iteraciones} iteraciones con {num_empresas} empresa(s)...")
        for i in range(iteraciones):
            print(f"  Iteración {i+1}/{iteraciones}...", end=" ", flush=True)
            inicio = time.time()
            resultado = subprocess.run(
                [python_cmd, "monte_carlo_numexpr_experimento.py", str(num_empresas), str(num_simulaciones)],
                cwd=python_dir,
                capture_output=True,
                text=True,
                encoding='utf-8',
                errors='replace',
                timeout=300,
                env={**os.environ, 'PYTHONUNBUFFERED': '1', 'PYTHONIOENCODING': 'utf-8'}
            )
            tiempo_wall = time.time() - inicio

            if resultado.returncode == 0:
                tiempo_carga, tiempo_sim = parsear_performance(resultado.stdout)
                overhead = (tiempo_wall - tiempo_carga - tiempo_sim) \
                    if tiempo_carga is not None and tiempo_sim is not None else None
                resultados_escalabilidad['python_numexpr'][num_empresas].append({
                    'wall_total': tiempo_wall,
                    'carga_params': tiempo_carga,
                    'simulacion_pura': tiempo_sim,
                    'overhead_proceso': overhead
                })
                print(f"✓ wall={tiempo_wall:.4f}s  carga={tiempo_carga:.4f}s  sim={tiempo_sim:.4f}s")
            else:
                print(f"✗ ERROR")

        # --- Python + NumPy plano, sin numexpr (multi-núcleo) ---
        # Se usa la MISMA expresion de incremento que la version numexpr (misma
        # forma matematica), solo que evaluada con operaciones NumPy sueltas en
        # vez de fusionadas -- para aislar el efecto de numexpr en si mismo.
        resultados_escalabilidad['python_plano'][num_empresas] = []
        print(f"\n[Python NumPy plano] {iteraciones} iteraciones con {num_empresas} empresa(s)...")
        for i in range(iteraciones):
            print(f"  Iteración {i+1}/{iteraciones}...", end=" ", flush=True)
            inicio = time.time()
            resultado = subprocess.run(
                [python_cmd, "monte_carlo_python_numpy.py", str(num_empresas), str(num_simulaciones)],
                cwd=python_dir,
                capture_output=True,
                text=True,
                encoding='utf-8',
                errors='replace',
                timeout=300,
                env={**os.environ, 'PYTHONUNBUFFERED': '1', 'PYTHONIOENCODING': 'utf-8'}
            )
            tiempo_wall = time.time() - inicio

            if resultado.returncode == 0:
                tiempo_carga, tiempo_sim = parsear_performance(resultado.stdout)
                overhead = (tiempo_wall - tiempo_carga - tiempo_sim) \
                    if tiempo_carga is not None and tiempo_sim is not None else None
                resultados_escalabilidad['python_plano'][num_empresas].append({
                    'wall_total': tiempo_wall,
                    'carga_params': tiempo_carga,
                    'simulacion_pura': tiempo_sim,
                    'overhead_proceso': overhead
                })
                print(f"✓ wall={tiempo_wall:.4f}s  carga={tiempo_carga:.4f}s  sim={tiempo_sim:.4f}s")
            else:
                print(f"✗ ERROR")

        # --- Python + NumPy plano con hilos de BLAS limitados a 1 (escenario 1 CPU) ---
        resultados_escalabilidad['python_plano_1cpu'][num_empresas] = []
        print(f"\n[Python NumPy plano 1-CPU] {iteraciones} iteraciones con {num_empresas} empresa(s)...")
        for i in range(iteraciones):
            print(f"  Iteración {i+1}/{iteraciones}...", end=" ", flush=True)
            inicio = time.time()
            resultado = subprocess.run(
                [python_cmd, "monte_carlo_python_numpy.py", str(num_empresas), str(num_simulaciones)],
                cwd=python_dir,
                capture_output=True,
                text=True,
                encoding='utf-8',
                errors='replace',
                timeout=300,
                env=env_1cpu
            )
            tiempo_wall = time.time() - inicio

            if resultado.returncode == 0:
                tiempo_carga, tiempo_sim = parsear_performance(resultado.stdout)
                overhead = (tiempo_wall - tiempo_carga - tiempo_sim) \
                    if tiempo_carga is not None and tiempo_sim is not None else None
                resultados_escalabilidad['python_plano_1cpu'][num_empresas].append({
                    'wall_total': tiempo_wall,
                    'carga_params': tiempo_carga,
                    'simulacion_pura': tiempo_sim,
                    'overhead_proceso': overhead
                })
                print(f"✓ wall={tiempo_wall:.4f}s  carga={tiempo_carga:.4f}s  sim={tiempo_sim:.4f}s")
            else:
                print(f"✗ ERROR")

        # --- C# con MaxDegreeOfParallelism=1 (simula hosting de 1 sola CPU) ---
        resultados_escalabilidad['csharp_1cpu'][num_empresas] = []
        print(f"\n[C# 1-CPU] {iteraciones} iteraciones con {num_empresas} empresa(s)...")
        for i in range(iteraciones):
            print(f"  Iteración {i+1}/{iteraciones}...", end=" ", flush=True)
            inicio = time.time()
            resultado = subprocess.run(
                ["dotnet", "run", "-c", "Release", "--no-build", "--",
                 str(num_empresas), "1", str(num_simulaciones)],
                cwd=c_sharp_dir,
                capture_output=True,
                text=True,
                encoding='utf-8',
                errors='replace',
                timeout=300
            )
            tiempo_wall = time.time() - inicio

            if resultado.returncode == 0:
                tiempo_carga, tiempo_sim = parsear_performance(resultado.stdout)
                overhead = (tiempo_wall - tiempo_carga - tiempo_sim) \
                    if tiempo_carga is not None and tiempo_sim is not None else None
                resultados_escalabilidad['csharp_1cpu'][num_empresas].append({
                    'wall_total': tiempo_wall,
                    'carga_params': tiempo_carga,
                    'simulacion_pura': tiempo_sim,
                    'overhead_proceso': overhead
                })
                print(f"✓ wall={tiempo_wall:.4f}s  carga={tiempo_carga:.4f}s  sim={tiempo_sim:.4f}s")
            else:
                print(f"✗ ERROR")

        # --- Python + numexpr con NUMEXPR_NUM_THREADS=1 (simula hosting de 1 sola CPU) ---
        resultados_escalabilidad['python_numexpr_1cpu'][num_empresas] = []
        print(f"\n[Python numexpr 1-CPU] {iteraciones} iteraciones con {num_empresas} empresa(s)...")
        for i in range(iteraciones):
            print(f"  Iteración {i+1}/{iteraciones}...", end=" ", flush=True)
            inicio = time.time()
            resultado = subprocess.run(
                [python_cmd, "monte_carlo_numexpr_experimento.py", str(num_empresas), str(num_simulaciones)],
                cwd=python_dir,
                capture_output=True,
                text=True,
                encoding='utf-8',
                errors='replace',
                timeout=300,
                env=env_1cpu
            )
            tiempo_wall = time.time() - inicio

            if resultado.returncode == 0:
                tiempo_carga, tiempo_sim = parsear_performance(resultado.stdout)
                overhead = (tiempo_wall - tiempo_carga - tiempo_sim) \
                    if tiempo_carga is not None and tiempo_sim is not None else None
                resultados_escalabilidad['python_numexpr_1cpu'][num_empresas].append({
                    'wall_total': tiempo_wall,
                    'carga_params': tiempo_carga,
                    'simulacion_pura': tiempo_sim,
                    'overhead_proceso': overhead
                })
                print(f"✓ wall={tiempo_wall:.4f}s  carga={tiempo_carga:.4f}s  sim={tiempo_sim:.4f}s")
            else:
                print(f"✗ ERROR")

    # === ANÁLISIS DE RESULTADOS (tiempo de pared del proceso completo) ===
    print(f"\n\n{'='*80}")
    print("RESULTADOS DE ESCALABILIDAD — TIEMPO TOTAL DE PROCESO (referencia)")
    print("Incluye arranque de runtime + carga de datos + cálculo de parámetros + simulación")
    print(f"{'='*80}\n")

    print(f"{'Empresas':<12} {'C# Promedio':<15} {'Python Promedio':<15} {'Factor':<10} {'Ganador':<15}")
    print("-" * 70)

    for num_empresas in num_empresas_lista:
        corridas_cs = resultados_escalabilidad['csharp'][num_empresas]
        corridas_py = resultados_escalabilidad['python_numexpr'][num_empresas]
        if corridas_cs and corridas_py:
            avg_csharp = promedio(corridas_cs, 'wall_total')
            avg_python = promedio(corridas_py, 'wall_total')

            factor = max(avg_csharp, avg_python) / min(avg_csharp, avg_python)
            ganador = "C#" if avg_csharp < avg_python else "Python"

            print(f"{num_empresas:<12} {avg_csharp:<15.4f} {avg_python:<15.4f} {factor:<10.2f}x {ganador:<15}")

    # === GRÁFICO ASCII (tiempo total de proceso) ===
    print(f"\n{'='*80}")
    print("ESCALA DE PERFORMANCE — TIEMPO TOTAL DE PROCESO (segundos)")
    print(f"{'='*80}\n")

    for num_empresas in num_empresas_lista:
        corridas_cs = resultados_escalabilidad['csharp'][num_empresas]
        corridas_py = resultados_escalabilidad['python_numexpr'][num_empresas]
        if corridas_cs and corridas_py:
            avg_csharp = promedio(corridas_cs, 'wall_total')
            avg_python = promedio(corridas_py, 'wall_total')

            # Escala: cada '#' = 0.01 segundos
            barras_csharp = int(avg_csharp / 0.01)
            barras_python = int(avg_python / 0.01)

            print(f"{num_empresas} empresa(s):")
            print(f"  C#     {'#' * barras_csharp} {avg_csharp:.4f}s")
            print(f"  Python {'#' * barras_python} {avg_python:.4f}s")
            print()

    # === TABLA NUEVA: SOLO SIMULACIÓN PURA (aislada de arranque y carga de datos) ===
    print(f"\n{'='*80}")
    print("SIMULACIÓN PURA — aislada de arranque de proceso y carga de datos")
    print("(medida internamente con Stopwatch / time.time() alrededor de la llamada")
    print(" a SimularMonteCarlo() / MonteCarloNumexprMulti.simular())")
    print(f"{'='*80}\n")

    print(f"{'Empresas':<12} {'C# sim. pura':<15} {'Python sim. pura':<18} {'Factor':<10} {'Ganador':<15}")
    print("-" * 75)

    resumen_simulacion_pura = {}
    for num_empresas in num_empresas_lista:
        corridas_cs = resultados_escalabilidad['csharp'][num_empresas]
        corridas_py = resultados_escalabilidad['python_numexpr'][num_empresas]
        avg_csharp_sim = promedio(corridas_cs, 'simulacion_pura')
        avg_python_sim = promedio(corridas_py, 'simulacion_pura')

        if avg_csharp_sim is not None and avg_python_sim is not None:
            factor_sim = max(avg_csharp_sim, avg_python_sim) / min(avg_csharp_sim, avg_python_sim)
            ganador_sim = "C#" if avg_csharp_sim < avg_python_sim else "Python"

            print(f"{num_empresas:<12} {avg_csharp_sim:<15.4f} {avg_python_sim:<18.4f} {factor_sim:<10.2f}x {ganador_sim:<15}")

            resumen_simulacion_pura[str(num_empresas)] = {
                'csharp_sim_pura': avg_csharp_sim,
                'python_sim_pura': avg_python_sim,
                'factor': factor_sim,
                'ganador': ganador_sim,
                'csharp_carga_params': promedio(corridas_cs, 'carga_params'),
                'python_carga_params': promedio(corridas_py, 'carga_params'),
                'csharp_overhead_proceso': promedio(corridas_cs, 'overhead_proceso'),
                'python_overhead_proceso': promedio(corridas_py, 'overhead_proceso'),
            }

    resultados_escalabilidad['resumen_simulacion_pura'] = resumen_simulacion_pura

    # === TABLA NUEVA: SOLO SIMULACIÓN PURA, ESCENARIO 1 CPU (hosting de un núcleo) ===
    print(f"\n{'='*80}")
    print("SIMULACIÓN PURA — escenario 1 CPU (C# con MaxDegreeOfParallelism=1,")
    print(" Python con OMP/OPENBLAS/MKL_NUM_THREADS=1)")
    print(f"{'='*80}\n")

    print(f"{'Empresas':<12} {'C# sim. pura':<15} {'Python sim. pura':<18} {'Factor':<10} {'Ganador':<15}")
    print("-" * 75)

    resumen_simulacion_pura_1cpu = {}
    for num_empresas in num_empresas_lista:
        corridas_cs = resultados_escalabilidad['csharp_1cpu'][num_empresas]
        corridas_py = resultados_escalabilidad['python_numexpr_1cpu'][num_empresas]
        avg_csharp_sim = promedio(corridas_cs, 'simulacion_pura')
        avg_python_sim = promedio(corridas_py, 'simulacion_pura')

        if avg_csharp_sim is not None and avg_python_sim is not None:
            factor_sim = max(avg_csharp_sim, avg_python_sim) / min(avg_csharp_sim, avg_python_sim)
            ganador_sim = "C#" if avg_csharp_sim < avg_python_sim else "Python"

            print(f"{num_empresas:<12} {avg_csharp_sim:<15.4f} {avg_python_sim:<18.4f} {factor_sim:<10.2f}x {ganador_sim:<15}")

            resumen_simulacion_pura_1cpu[str(num_empresas)] = {
                'csharp_sim_pura': avg_csharp_sim,
                'python_sim_pura': avg_python_sim,
                'factor': factor_sim,
                'ganador': ganador_sim,
            }

    resultados_escalabilidad['resumen_simulacion_pura_1cpu'] = resumen_simulacion_pura_1cpu

    # === TABLA NUEVA: NUMPY PLANO vs NUMPY + NUMEXPR (¿vale la pena numexpr en Python solo?) ===
    print(f"\n{'='*80}")
    print("NUMPY PLANO vs NUMPY + NUMEXPR — ¿numexpr ayuda dentro del mismo Python?")
    print("(esta es la comparación relevante para decidir si sumar numexpr al motor")
    print(" real -- Benchmark 1 compara contra C#, que es una pregunta distinta)")
    print(f"{'='*80}\n")

    for etiqueta, clave_plano, clave_numexpr, resumen_key in [
        ("multi-núcleo", 'python_plano', 'python_numexpr', 'resumen_numexpr_vs_plano_multi'),
        ("1 núcleo (hilo)", 'python_plano_1cpu', 'python_numexpr_1cpu', 'resumen_numexpr_vs_plano_1cpu'),
    ]:
        print(f"--- Escenario: {etiqueta} ---")
        print(f"{'Empresas':<12} {'NumPy plano':<15} {'NumPy+numexpr':<18} {'Factor':<10} {'Ganador':<15}")
        print("-" * 75)

        resumen = {}
        for num_empresas in num_empresas_lista:
            corridas_plano = resultados_escalabilidad[clave_plano][num_empresas]
            corridas_numexpr = resultados_escalabilidad[clave_numexpr][num_empresas]
            avg_plano = promedio(corridas_plano, 'simulacion_pura')
            avg_numexpr = promedio(corridas_numexpr, 'simulacion_pura')

            if avg_plano is not None and avg_numexpr is not None:
                factor = max(avg_plano, avg_numexpr) / min(avg_plano, avg_numexpr)
                ganador = "numexpr" if avg_numexpr < avg_plano else "NumPy plano"

                print(f"{num_empresas:<12} {avg_plano:<15.4f} {avg_numexpr:<18.4f} {factor:<10.2f}x {ganador:<15}")

                resumen[str(num_empresas)] = {
                    'numpy_plano': avg_plano,
                    'numpy_numexpr': avg_numexpr,
                    'factor': factor,
                    'ganador': ganador,
                }
        print()
        resultados_escalabilidad[resumen_key] = resumen

    # Guardar reporte
    with open('benchmark_escalabilidad.json', 'w') as f:
        json.dump(resultados_escalabilidad, f, indent=2)

    print(f"\n{'='*80}")
    print("✓ Reporte guardado en: benchmark_escalabilidad.json")
    print(f"{'='*80}\n")


if __name__ == '__main__':
    ejecutar_benchmark_n_empresas()
