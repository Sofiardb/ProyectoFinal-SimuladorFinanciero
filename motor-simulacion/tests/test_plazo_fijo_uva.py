import numpy as np
import pytest
from app.simulacion.plazo_fijo import simular_plazo_fijo_uva_vectorizado

N = 5


def _factor_acum(pi, T):
    t = np.arange(T + 1)
    return np.tile((1 + pi) ** t, (N, 1))


def test_forma_output():
    resultado = simular_plazo_fijo_uva_vectorizado(1000.0, 0.0, 6, False, 12, _factor_acum(0.03, 12))
    assert resultado.shape == (N, 13)


def test_v0_es_monto():
    resultado = simular_plazo_fijo_uva_vectorizado(2000.0, 0.12, 3, False, 6, _factor_acum(0.05, 6))
    assert resultado[:, 0] == pytest.approx(np.full(N, 2000.0))


def test_inflacion_cero_tasa_cero():
    resultado = simular_plazo_fijo_uva_vectorizado(1000.0, 0.0, 6, False, 6, _factor_acum(0.0, 6))
    assert resultado == pytest.approx(np.full((N, 7), 1000.0))


def test_solo_inflacion_sin_tasa_real():
    pi, T = 0.10, 6
    resultado = simular_plazo_fijo_uva_vectorizado(1000.0, 0.0, 12, False, T, _factor_acum(pi, T))
    for t in range(T + 1):
        assert resultado[:, t] == pytest.approx(np.full(N, 1000.0 * (1 + pi) ** t))


def test_crecimiento_nominal_con_inflacion_y_tasa():
    pi, tasa_real_anual, T = 0.05, 0.12, 6
    r_m = tasa_real_anual / 12
    resultado = simular_plazo_fijo_uva_vectorizado(1000.0, tasa_real_anual, 12, False, T, _factor_acum(pi, T))
    for t in range(T + 1):
        esperado = 1000.0 * (1 + pi) ** t * (1 + r_m) ** t
        assert resultado[:, t] == pytest.approx(np.full(N, esperado))


def test_vence_antes_sin_reinversion():
    pi, T, t_venc = 0.05, 6, 2
    resultado = simular_plazo_fijo_uva_vectorizado(1000.0, 0.0, t_venc, False, T, _factor_acum(pi, T))
    m_venc = 1000.0 * (1 + pi) ** t_venc
    assert resultado[:, t_venc]     == pytest.approx(np.full(N, m_venc))
    assert resultado[:, t_venc + 1] == pytest.approx(np.full(N, m_venc))
    assert resultado[:, T]          == pytest.approx(np.full(N, m_venc))


def test_vence_antes_con_reinversion():
    pi, T = 0.05, 6
    resultado = simular_plazo_fijo_uva_vectorizado(1000.0, 0.0, 2, True, T, _factor_acum(pi, T))
    for t in range(T + 1):
        assert resultado[:, t] == pytest.approx(np.full(N, 1000.0 * (1 + pi) ** t))


def test_simulaciones_independientes():
    T = 6
    pis = [0.01, 0.03, 0.05, 0.08, 0.12]
    t = np.arange(T + 1)
    fac = np.array([(1 + pi) ** t for pi in pis])
    resultado = simular_plazo_fijo_uva_vectorizado(1000.0, 0.05, 12, True, T, fac)
    assert len(set(resultado[:, -1].round(6))) == N


def test_vence_exactamente_en_T():
    pi, tasa_real_anual, T = 0.03, 0.12, 6
    r_m = tasa_real_anual / 12
    resultado = simular_plazo_fijo_uva_vectorizado(1000.0, tasa_real_anual, T, False, T, _factor_acum(pi, T))
    esperado = 1000.0 * (1 + pi) ** T * (1 + r_m) ** T
    assert resultado[:, T] == pytest.approx(np.full(N, esperado))
