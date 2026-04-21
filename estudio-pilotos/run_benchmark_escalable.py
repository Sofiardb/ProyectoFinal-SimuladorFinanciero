"""
Script de benchmark ESCALABLE - C# vs Python (NumPy) con N empresas
Mide cómo escala la performance con múltiples empresas
"""
import subprocess
import json
import time
import os
import sys
import platform


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
    print("BENCHMARK ESCALABLE - C# vs Python (NumPy) - N Empresas con Correlaciones")
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

    resultados_escalabilidad = {
        'csharp': {},
        'python_numpy': {}
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
        resultados_escalabilidad['python_numpy'][num_empresas] = []

        # --- C# ---
        print(f"\n[C#] {iteraciones} iteraciones con {num_empresas} empresa(s)...")
        for i in range(iteraciones):
            print(f"  Iteración {i+1}/{iteraciones}...", end=" ", flush=True)
            inicio = time.time()
            resultado = subprocess.run(
                ["dotnet", "run", "-c", "Release", "--no-build", "--", str(num_empresas)],
                cwd=c_sharp_dir,
                capture_output=True,
                text=True,
                timeout=300
            )
            tiempo = time.time() - inicio

            if resultado.returncode == 0:
                resultados_escalabilidad['csharp'][num_empresas].append(tiempo)
                print(f"✓ {tiempo:.4f}s")
            else:
                print(f"✗ ERROR")

        # --- Python + NumPy ---
        print(f"\n[Python] {iteraciones} iteraciones con {num_empresas} empresa(s)...")
        for i in range(iteraciones):
            print(f"  Iteración {i+1}/{iteraciones}...", end=" ", flush=True)
            inicio = time.time()
            resultado = subprocess.run(
                [python_cmd, "monte_carlo_python_numpy.py", str(num_empresas)],
                cwd=python_dir,
                capture_output=True,
                text=True,
                timeout=300,
                env={**os.environ, 'PYTHONUNBUFFERED': '1'}
            )
            tiempo = time.time() - inicio

            if resultado.returncode == 0:
                resultados_escalabilidad['python_numpy'][num_empresas].append(tiempo)
                print(f"✓ {tiempo:.4f}s")
            else:
                print(f"✗ ERROR")

    # === ANÁLISIS DE RESULTADOS ===
    print(f"\n\n{'='*80}")
    print("RESULTADOS DE ESCALABILIDAD")
    print(f"{'='*80}\n")

    print(f"{'Empresas':<12} {'C# Promedio':<15} {'Python Promedio':<15} {'Factor':<10} {'Ganador':<15}")
    print("-" * 70)

    for num_empresas in num_empresas_lista:
        if resultados_escalabilidad['csharp'][num_empresas] and resultados_escalabilidad['python_numpy'][num_empresas]:
            avg_csharp = sum(resultados_escalabilidad['csharp'][num_empresas]) / len(resultados_escalabilidad['csharp'][num_empresas])
            avg_python = sum(resultados_escalabilidad['python_numpy'][num_empresas]) / len(resultados_escalabilidad['python_numpy'][num_empresas])

            factor = max(avg_csharp, avg_python) / min(avg_csharp, avg_python)
            ganador = "C#" if avg_csharp < avg_python else "Python"

            print(f"{num_empresas:<12} {avg_csharp:<15.4f} {avg_python:<15.4f} {factor:<10.2f}x {ganador:<15}")

    # === GRÁFICO ASCII ===
    print(f"\n{'='*80}")
    print("ESCALA DE PERFORMANCE (Tiempo en segundos)")
    print(f"{'='*80}\n")

    for num_empresas in num_empresas_lista:
        if resultados_escalabilidad['csharp'][num_empresas] and resultados_escalabilidad['python_numpy'][num_empresas]:
            avg_csharp = sum(resultados_escalabilidad['csharp'][num_empresas]) / len(resultados_escalabilidad['csharp'][num_empresas])
            avg_python = sum(resultados_escalabilidad['python_numpy'][num_empresas]) / len(resultados_escalabilidad['python_numpy'][num_empresas])

            # Escala: cada '#' = 0.01 segundos
            barras_csharp = int(avg_csharp / 0.01)
            barras_python = int(avg_python / 0.01)

            print(f"{num_empresas} empresa(s):")
            print(f"  C#     {'#' * barras_csharp} {avg_csharp:.4f}s")
            print(f"  Python {'#' * barras_python} {avg_python:.4f}s")
            print()

    # Guardar reporte
    with open('benchmark_escalabilidad.json', 'w') as f:
        json.dump(resultados_escalabilidad, f, indent=2)

    print(f"{'='*80}")
    print("✓ Reporte guardado en: benchmark_escalabilidad.json")
    print(f"{'='*80}\n")


if __name__ == '__main__':
    ejecutar_benchmark_n_empresas()
