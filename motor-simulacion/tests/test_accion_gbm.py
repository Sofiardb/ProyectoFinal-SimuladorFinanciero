import numpy as np
import pytest
from app.simulacion.acciones import simular_accion_vectorizado

MU = 0.15
SIGMA = 0.30
MONTO = 1000.0
T = 12
N = 5


def _z_ceros():
    return np.zeros((N, T))


def test_forma_output():
    resultado = simular_accion_vectorizado(MONTO, MU, SIGMA, T, _z_ceros())
    assert resultado.shape == (N, T + 1)


def test_v0_es_monto():
    resultado = simular_accion_vectorizado(MONTO, MU, SIGMA, T, _z_ceros())
    assert resultado[:, 0] == pytest.approx(np.full(N, MONTO))


def test_shocks_nulos_siguen_drift():
    resultado = simular_accion_vectorizado(MONTO, MU, SIGMA, T, _z_ceros())
    deriva_mensual = (MU - 0.5 * SIGMA**2) / 12
    for t in range(T + 1):
        assert resultado[:, t] == pytest.approx(np.full(N, MONTO * np.exp(t * deriva_mensual)))


def test_linealidad_en_monto():
    z = np.random.default_rng(0).standard_normal((N, T))
    r1 = simular_accion_vectorizado(MONTO, MU, SIGMA, T, z)
    r2 = simular_accion_vectorizado(2 * MONTO, MU, SIGMA, T, z)
    assert r2 == pytest.approx(2 * r1)


def test_retornos_log_correctos():
    z = np.random.default_rng(42).standard_normal((N, T))
    resultado = simular_accion_vectorizado(MONTO, MU, SIGMA, T, z)
    retornos_esperados = (MU - 0.5 * SIGMA**2) / 12 + SIGMA / np.sqrt(12) * z
    retornos_obtenidos = np.log(resultado[:, 1:] / resultado[:, :-1])
    assert retornos_obtenidos == pytest.approx(retornos_esperados)


def test_formula_analitica():
    shock = 0.5
    z = np.full((N, 1), shock)
    resultado = simular_accion_vectorizado(MONTO, MU, SIGMA, 1, z)
    esperado = MONTO * np.exp((MU - 0.5 * SIGMA**2) / 12 + SIGMA / np.sqrt(12) * shock)
    assert resultado[:, 1] == pytest.approx(np.full(N, esperado))


def test_simulaciones_independientes():
    z = np.random.default_rng(7).standard_normal((N, T))
    resultado = simular_accion_vectorizado(MONTO, MU, SIGMA, T, z)
    assert len(set(resultado[:, -1].round(6))) == N
