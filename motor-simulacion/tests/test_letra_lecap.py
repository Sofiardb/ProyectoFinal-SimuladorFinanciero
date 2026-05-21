import pytest
import numpy as np
from app.simulacion.letras import simular_letra_lecap


def test_longitud_trayectoria():
    tray = simular_letra_lecap(1000, 0.60, 6, 12)
    assert len(tray) == 13


def test_valor_inicial_es_monto():
    tray = simular_letra_lecap(1000, 0.60, 6, 12)
    assert tray[0] == pytest.approx(1000.0)


def test_valor_al_vencimiento_es_vn():
    monto, tna, t_venc = 1000.0, 0.60, 6
    vn = monto * (1 + tna * t_venc / 12)
    tray = simular_letra_lecap(monto, tna, t_venc, 12)
    assert tray[t_venc] == pytest.approx(vn)


def test_valor_constante_despues_del_vencimiento():
    monto, tna, t_venc = 1000.0, 0.60, 3
    tray = simular_letra_lecap(monto, tna, t_venc, 8)
    vn = tray[t_venc]
    for t in range(t_venc, 9):
        assert tray[t] == pytest.approx(vn)


def test_crecimiento_monotono_antes_del_vencimiento():
    tray = simular_letra_lecap(1000, 0.48, 6, 6)
    for t in range(len(tray) - 1):
        assert tray[t + 1] >= tray[t]


def test_tna_cero():
    # Sin rendimiento: V(t) = monto para todo t
    tray = simular_letra_lecap(1000, 0.0, 6, 12)
    for v in tray:
        assert v == pytest.approx(1000.0)


def test_no_vence_dentro_del_horizonte():
    # t_venc > T: la letra nunca madura, V(T) < VN
    monto, tna, t_venc, T = 1000.0, 0.60, 12, 6
    vn = monto * (1 + tna * t_venc / 12)
    tray = simular_letra_lecap(monto, tna, t_venc, T)
    assert tray[T] < vn
    assert tray[T] > monto


def test_formula_analitica_intermedia():
    # Verifica V(t) = VN / (1 + tna * (t_venc - t) / 12) para un t dado
    monto, tna, t_venc = 1000.0, 0.36, 6
    vn = monto * (1 + tna * t_venc / 12)
    tray = simular_letra_lecap(monto, tna, t_venc, 6)
    for t in range(t_venc + 1):
        esperado = vn / (1 + tna * (t_venc - t) / 12)
        assert tray[t] == pytest.approx(esperado)
