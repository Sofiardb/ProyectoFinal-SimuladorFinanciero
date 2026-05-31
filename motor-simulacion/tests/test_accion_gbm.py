import pytest
import numpy as np
from app.simulacion.acciones import simular_accion

MU = 0.15       # 15% anual
SIGMA = 0.30    # 30% anual
MONTO = 1000.0
T = 12


def _shocks_nulos(t): return [0.0] * t


def test_longitud_trayectoria():
    tray = simular_accion(MONTO, MU, SIGMA, T, _shocks_nulos(T))
    assert len(tray) == T + 1


def test_v0_es_monto():
    tray = simular_accion(MONTO, MU, SIGMA, T, _shocks_nulos(T))
    assert tray[0] == pytest.approx(MONTO)


def test_shocks_nulos_trayectoria_determinista():
    # Sin ruido la trayectoria sigue el drift puro: V(t) = monto * exp(t * (μ - 0.5σ²)/12)
    tray = simular_accion(MONTO, MU, SIGMA, T, _shocks_nulos(T))
    deriva_mensual = (MU - 0.5 * SIGMA**2) / 12
    for t in range(T + 1):
        assert tray[t] == pytest.approx(MONTO * np.exp(t * deriva_mensual))


def test_linealidad_en_monto():
    shocks = [0.5, -0.3, 0.1, 0.8]
    tray1 = simular_accion(MONTO, MU, SIGMA, 4, shocks)
    tray2 = simular_accion(2 * MONTO, MU, SIGMA, 4, shocks)
    for v1, v2 in zip(tray1, tray2):
        assert v2 == pytest.approx(2 * v1)


def test_shocks_positivos_superan_negativos():
    shocks_pos = [3.0] * T
    shocks_neg = [-3.0] * T
    tray_pos = simular_accion(MONTO, MU, SIGMA, T, shocks_pos)
    tray_neg = simular_accion(MONTO, MU, SIGMA, T, shocks_neg)
    assert tray_pos[-1] > tray_neg[-1]


def test_retornos_log_correctos():
    shocks = [0.5, -0.2, 1.0, 0.0, -0.7]
    tray = simular_accion(MONTO, MU, SIGMA, 5, shocks)
    for t in range(1, 6):
        retorno_esperado = (MU - 0.5 * SIGMA**2) / 12 + SIGMA / np.sqrt(12) * shocks[t - 1]
        assert np.log(tray[t] / tray[t - 1]) == pytest.approx(retorno_esperado)


def test_t1_formula_analitica():
    shock = 0.5
    tray = simular_accion(MONTO, MU, SIGMA, 1, [shock])
    esperado = MONTO * np.exp((MU - 0.5 * SIGMA**2) / 12 + SIGMA / np.sqrt(12) * shock)
    assert tray[1] == pytest.approx(esperado)
