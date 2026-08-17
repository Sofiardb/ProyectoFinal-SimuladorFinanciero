"""
Benchmark de costo de integracion del motor Python: Subprocess vs HTTP
Mide el overhead de cada mecanismo y lo compara con el ahorro de simulacion.
No compara contra C# -- esa comparacion es el Benchmark 1 (run_benchmark_escalable.py).
"""
import subprocess
import time
import json
import sys
import os
import platform
import urllib.request
import urllib.error


PYTHON_CMD  = 'python' if platform.system() == 'Windows' else 'python3'
PYTHON_DIR  = os.path.join('piloto-python', 'src')
FLASK_URL   = 'http://127.0.0.1:5050'
ITERACIONES = 5
N_LISTA     = [1, 5, 10, 20]


# ---------------------------------------------
# Utilidades HTTP
# ---------------------------------------------

def http_get(url, timeout=10):
    with urllib.request.urlopen(url, timeout=timeout) as r:
        return json.loads(r.read())


def http_post(url, payload, timeout=60):
    body = json.dumps(payload).encode('utf-8')
    req  = urllib.request.Request(url, data=body, headers={'Content-Type': 'application/json'})
    with urllib.request.urlopen(req, timeout=timeout) as r:
        return json.loads(r.read())


def esperar_servidor(url, timeout=30):
    """Espera hasta que el servidor responda o agota el timeout."""
    deadline = time.time() + timeout
    while time.time() < deadline:
        try:
            http_get(url, timeout=2)
            return True
        except Exception:
            time.sleep(0.3)
    return False


# ---------------------------------------------
# Mediciones de subprocess
# ---------------------------------------------

def medir_subprocess_noop():
    """Costo de arrancar el interprete Python (sin NumPy)."""
    tiempos = []
    for _ in range(ITERACIONES):
        t0 = time.perf_counter()
        subprocess.run([PYTHON_CMD, '-c', 'print("ok")'],
                       capture_output=True, timeout=30)
        tiempos.append((time.perf_counter() - t0) * 1000)
    return sum(tiempos) / len(tiempos)


def medir_subprocess_numpy():
    """Costo de arrancar Python + importar NumPy."""
    tiempos = []
    for _ in range(ITERACIONES):
        t0 = time.perf_counter()
        subprocess.run([PYTHON_CMD, '-c', 'import numpy; print("ok")'],
                       capture_output=True, timeout=30, cwd=PYTHON_DIR)
        tiempos.append((time.perf_counter() - t0) * 1000)
    return sum(tiempos) / len(tiempos)


def medir_subprocess_simulacion(n):
    """Costo total subprocess: startup + NumPy + carga datos + simulacion."""
    tiempos = []
    for _ in range(ITERACIONES):
        t0 = time.perf_counter()
        resultado = subprocess.run(
            [PYTHON_CMD, 'monte_carlo_python_numpy.py', str(n)],
            capture_output=True, timeout=120, cwd=PYTHON_DIR
        )
        tiempos.append((time.perf_counter() - t0) * 1000)
        if resultado.returncode != 0:
            print(f'  ERR Error subprocess N={n}: {resultado.stderr[:200]}')
    return sum(tiempos) / len(tiempos)


# ---------------------------------------------
# Mediciones HTTP
# ---------------------------------------------

def medir_http_ping():
    """Overhead puro de IPC: round-trip HTTP sin computo."""
    # Warmup
    http_get(f'{FLASK_URL}/ping')

    tiempos = []
    for _ in range(ITERACIONES * 3):   # mas iteraciones -> mas estable
        t0 = time.perf_counter()
        http_get(f'{FLASK_URL}/ping')
        tiempos.append((time.perf_counter() - t0) * 1000)
    return sum(tiempos) / len(tiempos)


def medir_http_simulacion(n):
    """Costo HTTP total: IPC + simulacion (datos ya cargados en servidor)."""
    tiempos_total = []
    tiempos_sim   = []

    for _ in range(ITERACIONES):
        t0 = time.perf_counter()
        resp = http_post(f'{FLASK_URL}/simular',
                         {'num_empresas': n, 'T': 1, 'pasos': 12, 'num_simulaciones': 3000})
        tiempos_total.append((time.perf_counter() - t0) * 1000)
        tiempos_sim.append(resp.get('tiempo_simulacion_ms', 0))

    return (sum(tiempos_total) / len(tiempos_total),
            sum(tiempos_sim)   / len(tiempos_sim))


# ---------------------------------------------
# Main
# ---------------------------------------------

def main():
    print('\n' + '=' * 75)
    print('BENCHMARK DE COSTO DE INTEGRACION -- Subprocess vs HTTP (motor Python)')
    print('=' * 75)

    # -- Verificar Flask ------------------------------------------------------
    try:
        import flask
    except ImportError:
        print('\n[PREP] Instalando Flask...')
        subprocess.run([PYTHON_CMD, '-m', 'pip', 'install', 'flask'],
                       check=True, capture_output=True)
        print('  OK Flask instalado')

    resultados = {}

    # -- FASE 1: overhead subprocess -----------------------------------------
    print('\n' + '-' * 75)
    print('FASE 1 -- Overhead de subprocess (sin simulacion)')
    print('-' * 75)

    print(f'  Midiendo startup Python ({ITERACIONES} iters)...', end=' ', flush=True)
    noop_ms = medir_subprocess_noop()
    print(f'{noop_ms:.1f} ms')

    print(f'  Midiendo startup Python + NumPy ({ITERACIONES} iters)...', end=' ', flush=True)
    numpy_ms = medir_subprocess_numpy()
    print(f'{numpy_ms:.1f} ms')

    resultados['overhead_subprocess_noop_ms']  = noop_ms
    resultados['overhead_subprocess_numpy_ms'] = numpy_ms

    # -- FASE 2: arrancar servidor Flask -------------------------------------
    print('\n' + '-' * 75)
    print('FASE 2 -- Iniciando servidor Flask...')
    print('-' * 75)

    flask_proc = subprocess.Popen(
        [PYTHON_CMD, 'api_simulador.py'],
        cwd=PYTHON_DIR,
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL
    )

    print('  Esperando que el servidor este listo...', end=' ', flush=True)
    if not esperar_servidor(f'{FLASK_URL}/ping'):
        print('ERR Timeout'); flask_proc.terminate(); return
    print('OK Servidor listo')

    try:
        # -- FASE 3: overhead HTTP --------------------------------------------
        print('\n' + '-' * 75)
        print('FASE 3 -- Overhead HTTP puro (/ping, servidor ya caliente)')
        print('-' * 75)

        print(f'  Midiendo round-trip HTTP ({ITERACIONES * 3} iters)...', end=' ', flush=True)
        ping_ms = medir_http_ping()
        print(f'{ping_ms:.2f} ms')
        resultados['overhead_http_ping_ms'] = ping_ms

        # -- FASE 4: simulaciones por mecanismo -------------------------------
        print('\n' + '-' * 75)
        print('FASE 4 -- Tiempos totales por N empresas')
        print('-' * 75)

        datos_n = {}
        for n in N_LISTA:
            print(f'\n  N = {n} empresa(s):')

            print(f'    Subprocess ...', end=' ', flush=True)
            sub_total_ms = medir_subprocess_simulacion(n)
            print(f'{sub_total_ms:.1f} ms total')

            print(f'    HTTP       ...', end=' ', flush=True)
            http_total_ms, http_sim_ms = medir_http_simulacion(n)
            http_overhead_ms = http_total_ms - http_sim_ms
            print(f'{http_total_ms:.1f} ms total  (sim={http_sim_ms:.1f} ms, overhead={http_overhead_ms:.1f} ms)')

            datos_n[n] = {
                'subprocess_total_ms':   sub_total_ms,
                'subprocess_overhead_ms': sub_total_ms - http_sim_ms,
                'http_total_ms':         http_total_ms,
                'http_sim_ms':           http_sim_ms,
                'http_overhead_ms':      http_overhead_ms,
            }

        resultados['por_n'] = datos_n

    finally:
        flask_proc.terminate()
        flask_proc.wait(timeout=5)
        print('\n  [Servidor Flask detenido]')

    # -- RESULTADOS -----------------------------------------------------------
    print('\n' + '=' * 75)
    print('RESUMEN -- OVERHEAD vs SIMULACION')
    print('=' * 75)

    print(f'\n{"Overhead fijo de integracion":}')
    print(f'  Python startup (sin NumPy):  {noop_ms:7.1f} ms')
    print(f'  Python startup + NumPy:      {numpy_ms:7.1f} ms')
    print(f'  HTTP round-trip (/ping):     {ping_ms:7.2f} ms')

    print(f'\n{"N":>4}  {"Subprocess":>12}  {"HTTP total":>12}  {"Sim. pura":>10}  {"Sub. overhead%":>14}  {"HTTP overhead%":>14}')
    print('-' * 80)
    for n, d in datos_n.items():
        sub_pct  = (d['subprocess_overhead_ms'] / d['subprocess_total_ms'] * 100)
        http_pct = (d['http_overhead_ms']        / d['http_total_ms']        * 100)
        print(f'{n:>4}  {d["subprocess_total_ms"]:>11.1f}ms'
              f'  {d["http_total_ms"]:>11.1f}ms'
              f'  {d["http_sim_ms"]:>9.1f}ms'
              f'  {sub_pct:>13.0f}%'
              f'  {http_pct:>13.0f}%')

    # Punto de cruce HTTP vs Subprocess
    print(f'\n{"PUNTO DE CRUCE":}')
    cruces_http = [n for n, d in datos_n.items() if d['http_total_ms'] < d['subprocess_total_ms']]

    if cruces_http:
        print(f'  HTTP supera a Subprocess a partir de N={min(cruces_http)}')
    else:
        print(f'  HTTP nunca supera a Subprocess en el rango medido')

    # Guardar reporte
    with open('benchmark_integracion.json', 'w') as f:
        json.dump(resultados, f, indent=2)

    print(f'\n{"=" * 75}')
    print('OK Reporte guardado en: benchmark_integracion.json')
    print('=' * 75 + '\n')


if __name__ == '__main__':
    main()
