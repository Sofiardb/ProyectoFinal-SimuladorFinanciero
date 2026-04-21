"""
Microservicio Flask - Motor de simulación Monte Carlo
Carga datos una vez al arrancar (patrón cache diario) y expone endpoints HTTP.
"""
import os
import sys
import time

from data_loader import DatosAccionesLoader
from monte_carlo_python_numpy import Empresa, MonteCarloPythonNumPyMulti
from flask import Flask, jsonify, request

app = Flask(__name__)

# Carga única al iniciar el servidor (simula caché diario)
_json_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), '../../DatosAccionesDiaria.json')
_loader = DatosAccionesLoader(_json_path)
_mu, _sigma = _loader.calcular_parametros_gbm()
_S0 = _loader.get_precio_inicial()


@app.route('/ping')
def ping():
    """Endpoint no-op para medir overhead puro de IPC."""
    return jsonify({'status': 'ok'})


@app.route('/simular', methods=['POST'])
def simular():
    """Ejecuta simulación Monte Carlo y devuelve resultados + tiempo de cómputo."""
    data = request.get_json()
    num_empresas    = data.get('num_empresas', 1)
    T               = data.get('T', 1)
    pasos           = data.get('pasos', 12)
    num_simulaciones = data.get('num_simulaciones', 10000)

    empresas = [
        Empresa(
            f'E{i+1}',
            _mu + (0.005 * ((i % 3) - 1)),
            _sigma,
            _S0,
            0.5 + (0.1 * ((i % 3) - 1)),
            100
        )
        for i in range(num_empresas)
    ]

    mc = MonteCarloPythonNumPyMulti(empresas)
    t0 = time.perf_counter()
    resultados = mc.simular_monte_carlo_vectorizado(T, pasos, num_simulaciones)
    tiempo_sim_ms = (time.perf_counter() - t0) * 1000

    return jsonify({
        **{k: round(v, 4) for k, v in resultados.items()},
        'tiempo_simulacion_ms': round(tiempo_sim_ms, 2),
        'num_empresas': num_empresas,
    })


if __name__ == '__main__':
    print(f'[API] Datos cargados: mu={_mu:.4f} sigma={_sigma:.4f} S0={_S0:.2f}', flush=True)
    print('[API] Servidor listo en http://127.0.0.1:5050', flush=True)
    app.run(host='127.0.0.1', port=5050, debug=False, use_reloader=False)
