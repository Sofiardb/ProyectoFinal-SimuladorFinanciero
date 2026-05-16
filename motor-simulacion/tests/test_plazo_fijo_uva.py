import pytest
import numpy as np
from app.simulacion.plazo_fijo import simular_plazo_fijo_uva


def test_longitud_trayectoria():
    inflacion = [0.03] * 12
    tray = simular_plazo_fijo_uva(1000, 0.0, 6, False, 12, inflacion)
    assert len(tray) == 13


def test_valor_inicial_es_monto():
    inflacion = [0.05] * 6
    tray = simular_plazo_fijo_uva(2000, 0.12, 3, False, 6, inflacion)
    assert tray[0] == pytest.approx(2000.0)


def test_inflacion_cero_tasa_cero():
    # Sin inflación ni tasa real: capital constante
    inflacion = [0.0] * 6
    tray = simular_plazo_fijo_uva(1000, 0.0, 6, False, 6, inflacion)
    for v in tray:
        assert v == pytest.approx(1000.0)


def test_solo_inflacion_sin_tasa_real():
    # Tasa real = 0: V(t) = monto * (1+π)^t con inflación constante
    pi = 0.10
    inflacion = [pi] * 6
    tray = simular_plazo_fijo_uva(1000, 0.0, 12, False, 6, inflacion)
    for t in range(7):
        assert tray[t] == pytest.approx(1000 * (1 + pi) ** t)


def test_crecimiento_nominal_con_inflacion_y_tasa():
    # V(t) = monto * (1+π)^t * (1+r_m)^t con ambas constantes
    pi, tasa_real_anual = 0.05, 0.12
    r_m = tasa_real_anual / 12
    inflacion = [pi] * 6
    tray = simular_plazo_fijo_uva(1000, tasa_real_anual, 12, False, 6, inflacion)
    for t in range(7):
        esperado = 1000 * (1 + pi) ** t * (1 + r_m) ** t
        assert tray[t] == pytest.approx(esperado)


def test_vence_antes_sin_reinversion():
    pi = 0.05
    inflacion = [pi] * 6
    tray = simular_plazo_fijo_uva(1000, 0.0, 2, False, 6, inflacion)

    m_venc = 1000 * (1 + pi) ** 2
    assert tray[2] == pytest.approx(m_venc)
    assert tray[3] == pytest.approx(m_venc)
    assert tray[6] == pytest.approx(m_venc)


def test_vence_antes_con_reinversion():
    # Reinversión: crecimiento continuo = monto * factor_acum[t] para todo t
    pi = 0.05
    inflacion = [pi] * 6
    tray = simular_plazo_fijo_uva(1000, 0.0, 2, True, 6, inflacion)
    for t in range(7):
        assert tray[t] == pytest.approx(1000 * (1 + pi) ** t)


def test_continuidad_en_vencimiento():
    # V(t_venc) debe ser igual desde ambos lados del vencimiento
    pi = 0.04
    inflacion = [pi] * 6
    tray = simular_plazo_fijo_uva(1000, 0.0, 3, False, 6, inflacion)
    assert tray[3] == pytest.approx(tray[3])  # trivial
    # Sin reinversión: V(4) == V(3)
    assert tray[4] == pytest.approx(tray[3])


def test_vence_exactamente_en_T():
    pi, tasa_real_anual = 0.03, 0.12
    r_m = tasa_real_anual / 12
    inflacion = [pi] * 6
    tray = simular_plazo_fijo_uva(1000, tasa_real_anual, 6, False, 6, inflacion)
    esperado = 1000 * (1 + pi) ** 6 * (1 + r_m) ** 6
    assert tray[6] == pytest.approx(esperado)
