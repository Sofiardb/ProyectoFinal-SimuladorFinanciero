import pytest
import numpy as np
from app.simulacion.letras import simular_letra_lecer


def test_longitud_trayectoria():
    tray = simular_letra_lecer(1000, 0.0, 6, 12, [0.05] * 12)
    assert len(tray) == 13


def test_valor_inicial_es_monto():
    tray = simular_letra_lecer(2000, 0.24, 6, 12, [0.05] * 12)
    assert tray[0] == pytest.approx(2000.0)


def test_inflacion_cero_igual_a_lecap():
    # Sin inflación, LECER debe comportarse exactamente igual que LECAP
    from app.simulacion.letras import simular_letra_lecap
    monto, tna, t_venc, T = 1000.0, 0.36, 6, 12
    lecer = simular_letra_lecer(monto, tna, t_venc, T, [0.0] * T)
    lecap = simular_letra_lecap(monto, tna, t_venc, T)
    for v_lecer, v_lecap in zip(lecer, lecap):
        assert v_lecer == pytest.approx(v_lecap)


def test_valor_al_vencimiento_incluye_inflacion():
    monto, tna, t_venc, pi = 1000.0, 0.0, 3, 0.05
    inflacion = [pi] * 12
    tray = simular_letra_lecer(monto, tna, t_venc, 12, inflacion)
    vn_ajustado = monto * (1 + pi) ** t_venc
    assert tray[t_venc] == pytest.approx(vn_ajustado)


def test_constante_despues_del_vencimiento():
    tray = simular_letra_lecer(1000, 0.0, 3, 8, [0.05] * 8)
    vn = tray[3]
    for t in range(3, 9):
        assert tray[t] == pytest.approx(vn)


def test_formula_analitica_antes_del_vencimiento():
    monto, tna, t_venc, pi = 1000.0, 0.12, 6, 0.03
    inflacion = [pi] * 12
    vn0 = monto * (1 + tna * t_venc / 12)
    tray = simular_letra_lecer(monto, tna, t_venc, 12, inflacion)

    for t in range(t_venc + 1):
        inflation_factor = (1 + pi) ** t
        t_restante = (t_venc - t) / 12
        esperado = vn0 * inflation_factor / (1 + tna * t_restante)
        assert tray[t] == pytest.approx(esperado)


def test_no_vence_dentro_del_horizonte():
    # t_venc > T: inflacion llega hasta t_venc (el orquestador genera hasta max(T, t_venc))
    monto, tna, t_venc, T, pi = 1000.0, 0.0, 12, 6, 0.05
    tray = simular_letra_lecer(monto, tna, t_venc, T, [pi] * t_venc)
    vn0 = monto  # tna=0
    inflation_factor_T = (1 + pi) ** T
    t_restante_T = (t_venc - T) / 12
    esperado = vn0 * inflation_factor_T / (1 + tna * t_restante_T)
    assert tray[T] == pytest.approx(esperado)
