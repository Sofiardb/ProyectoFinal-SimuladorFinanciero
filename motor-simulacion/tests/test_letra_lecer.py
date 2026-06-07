import numpy as np
import pytest
from app.simulacion.letras import simular_letra_lecer_vectorizado, simular_letra_lecap

N = 5


def _factor_acum(pi, t_venc):
    t = np.arange(t_venc + 1)
    return np.tile((1 + pi) ** t, (N, 1))


def test_forma_output():
    resultado = simular_letra_lecer_vectorizado(1000.0, 0.0, 6, _factor_acum(0.05, 6))
    assert resultado.shape == (N, 7)


def test_v0_es_monto():
    resultado = simular_letra_lecer_vectorizado(2000.0, 0.24, 6, _factor_acum(0.05, 6))
    assert resultado[:, 0] == pytest.approx(np.full(N, 2000.0))


def test_inflacion_cero_igual_a_lecap():
    monto, tna, t_venc = 1000.0, 0.36, 6
    resultado = simular_letra_lecer_vectorizado(monto, tna, t_venc, _factor_acum(0.0, t_venc))
    lecap = simular_letra_lecap(monto, tna, t_venc)
    assert resultado == pytest.approx(np.tile(lecap, (N, 1)))


def test_valor_al_vencimiento_incluye_inflacion():
    monto, tna, t_venc, pi = 1000.0, 0.0, 3, 0.05
    resultado = simular_letra_lecer_vectorizado(monto, tna, t_venc, _factor_acum(pi, t_venc))
    vn_ajustado = monto * (1 + pi) ** t_venc
    assert resultado[:, t_venc] == pytest.approx(np.full(N, vn_ajustado))


def test_formula_analitica():
    monto, tna, t_venc, pi = 1000.0, 0.12, 6, 0.03
    resultado = simular_letra_lecer_vectorizado(monto, tna, t_venc, _factor_acum(pi, t_venc))
    vn0 = monto * (1 + tna * t_venc / 12)
    for t in range(t_venc + 1):
        esperado = vn0 * (1 + pi) ** t / (1 + tna * (t_venc - t) / 12)
        assert resultado[:, t] == pytest.approx(np.full(N, esperado))


def test_simulaciones_independientes():
    t_venc = 6
    pis = [0.01, 0.03, 0.05, 0.08, 0.12]
    t = np.arange(t_venc + 1)
    fac = np.array([(1 + pi) ** t for pi in pis])
    resultado = simular_letra_lecer_vectorizado(1000.0, 0.10, t_venc, fac)
    assert len(set(resultado[:, -1].round(6))) == N
