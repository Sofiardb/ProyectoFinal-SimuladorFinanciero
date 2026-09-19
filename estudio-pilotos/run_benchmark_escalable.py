"""
Benchmark 1 -- C# vs Python, arquitectura fiel a produccion (motor-simulacion/
app/simulacion/orquestador.py): loop secuencial de N instrumentos, funcion
pura por instrumento, sin batchear entre instrumentos y sin cargar datos de
un archivo (mu/sigma llegan como constantes, igual que en produccion).

5 variantes:
  - C# for secuencial
  - C# Parallel.For
  - Python for secuencial (sin NumPy)
  - Python for paralelizado (multiprocessing, pool persistente)
  - Python NumPy vectorizado (importa la funcion real de produccion)
"""
import subprocess
import json
import re
import statistics
import time
import os
import sys
import platform


PATRON_TIEMPO_SIM = re.compile(r"Tiempo total:\s*([\d.]+)s")

C_SHARP_DIR = "piloto-csharp"
PYTHON_DIR = "piloto-python/src"
PYTHON_CMD = "python" if platform.system() == "Windows" else "python3"

NUM_INSTRUMENTOS_LISTA = [1, 5, 10, 20]
ITERACIONES = 10  # mediana de 10 corridas por punto


def parsear_tiempo_total(stdout):
    m = PATRON_TIEMPO_SIM.search(stdout)
    return float(m.group(1)) if m else None


def mediana(valores):
    valores = [v for v in valores if v is not None]
    return statistics.median(valores) if valores else None


def correr_csharp(num_instrumentos, variante, num_simulaciones):
    resultado = subprocess.run(
        ["dotnet", "run", "-c", "Release", "--no-build", "--",
         str(num_instrumentos), variante, str(num_simulaciones)],
        cwd=C_SHARP_DIR, capture_output=True, text=True,
        encoding="utf-8", errors="replace", timeout=300,
    )
    if resultado.returncode != 0:
        print(f"    ERROR C# ({variante}): {resultado.stderr[:300]}")
        return None
    return parsear_tiempo_total(resultado.stdout)


def correr_python(script, num_instrumentos, num_simulaciones):
    resultado = subprocess.run(
        [PYTHON_CMD, script, str(num_instrumentos), str(num_simulaciones)],
        cwd=PYTHON_DIR, capture_output=True, text=True,
        encoding="utf-8", errors="replace", timeout=300,
        env={**os.environ, "PYTHONUNBUFFERED": "1", "PYTHONIOENCODING": "utf-8"},
    )
    if resultado.returncode != 0:
        print(f"    ERROR Python ({script}): {resultado.stderr[:300]}")
        return None
    return parsear_tiempo_total(resultado.stdout)


VARIANTES = [
    ("csharp_for",      lambda n, s: correr_csharp(n, "for", s)),
    ("csharp_parallel", lambda n, s: correr_csharp(n, "parallel", s)),
    ("python_for",           lambda n, s: correr_python("accion_secuencial.py", n, s)),
    ("python_multiprocessing", lambda n, s: correr_python("accion_multiprocessing.py", n, s)),
    ("python_numpy",         lambda n, s: correr_python("accion_numpy.py", n, s)),
]

ETIQUETAS = {
    "csharp_for": "C# for secuencial",
    "csharp_parallel": "C# Parallel.For",
    "python_for": "Python for secuencial",
    "python_multiprocessing": "Python multiprocessing",
    "python_numpy": "Python NumPy vectorizado",
}


def ejecutar_benchmark():
    print("\n" + "=" * 80)
    print("BENCHMARK 1 -- C# vs Python, arquitectura fiel a produccion")
    print("=" * 80)

    num_simulaciones = int(sys.argv[1]) if len(sys.argv) > 1 else 3000
    print(f"[CONFIG] num_simulaciones = {num_simulaciones}, iteraciones por punto = {ITERACIONES}")

    print("\n[PREP] Compilando C# en Release...")
    resultado = subprocess.run(["dotnet", "build", "-c", "Release"],
                                cwd=C_SHARP_DIR, capture_output=True, text=True, timeout=60)
    if resultado.returncode != 0:
        print("ERROR en compilacion C#:", resultado.stderr[:500])
        return
    print("OK C# compilado")

    resultados = {clave: {} for clave, _ in VARIANTES}

    for num_instrumentos in NUM_INSTRUMENTOS_LISTA:
        print(f"\n{'=' * 80}\nEJECUTANDO CON {num_instrumentos} INSTRUMENTO(S)\n{'=' * 80}")

        for clave, funcion in VARIANTES:
            print(f"\n[{ETIQUETAS[clave]}] {ITERACIONES} iteraciones...")
            tiempos = []
            for i in range(ITERACIONES):
                print(f"  Iteracion {i + 1}/{ITERACIONES}...", end=" ", flush=True)
                t = funcion(num_instrumentos, num_simulaciones)
                tiempos.append(t)
                print(f"{t:.4f}s" if t is not None else "ERROR")
            resultados[clave][num_instrumentos] = {
                "tiempos": tiempos,
                "mediana": mediana(tiempos),
            }

    # === RESUMEN ===
    print(f"\n\n{'=' * 80}\nRESUMEN -- mediana de tiempo total por variante (segundos)\n{'=' * 80}\n")

    encabezado = f"{'Instrumentos':<14}" + "".join(f"{ETIQUETAS[c][:22]:<24}" for c, _ in VARIANTES)
    print(encabezado)
    print("-" * len(encabezado))
    for num_instrumentos in NUM_INSTRUMENTOS_LISTA:
        fila = f"{num_instrumentos:<14}"
        for clave, _ in VARIANTES:
            m = resultados[clave][num_instrumentos]["mediana"]
            fila += f"{(f'{m:.4f}' if m is not None else 'ERROR'):<24}"
        print(fila)

    with open("benchmark_escalabilidad.json", "w") as f:
        json.dump(resultados, f, indent=2)

    print(f"\n{'=' * 80}\nOK Reporte guardado en: benchmark_escalabilidad.json\n{'=' * 80}\n")


if __name__ == "__main__":
    ejecutar_benchmark()
