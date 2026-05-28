import pytest
import numpy as np
from app.simulacion.letras import simular_letra_lecer


def test_longitud_trayectoria():
    tray = simular_letra_lecer(1000, 0.0, 6, [0.05] * 6)
    assert len(tray) == 7


def test_valor_inicial_es_monto():
    tray = simular_letra_lecer(2000, 0.24, 6, [0.05] * 6)
    assert tray[0] == pytest.approx(2000.0)


def test_inflacion_cero_igual_a_lecap():
    from app.simulacion.letras import simular_letra_lecap
    monto, tna, t_venc = 1000.0, 0.36, 6
    lecer = simular_letra_lecer(monto, tna, t_venc, [0.0] * t_venc)
    lecap = simular_letra_lecap(monto, tna, t_venc)
    for v_lecer, v_lecap in zip(lecer, lecap):
        assert v_lecer == pytest.approx(v_lecap)


def test_valor_al_vencimiento_incluye_inflacion():
    monto, tna, t_venc, pi = 1000.0, 0.0, 3, 0.05
    tray = simular_letra_lecer(monto, tna, t_venc, [pi] * t_venc)
    vn_ajustado = monto * (1 + pi) ** t_venc
    assert tray[t_venc] == pytest.approx(vn_ajustado)


def test_formula_analitica():
    monto, tna, t_venc, pi = 1000.0, 0.12, 6, 0.03
    inflacion = [pi] * t_venc
    vn0 = monto * (1 + tna * t_venc / 12)
    tray = simular_letra_lecer(monto, tna, t_venc, inflacion)

    for t in range(t_venc + 1):
        inflation_factor = (1 + pi) ** t
        t_restante = (t_venc - t) / 12
        esperado = vn0 * inflation_factor / (1 + tna * t_restante)
        assert tray[t] == pytest.approx(esperado)
