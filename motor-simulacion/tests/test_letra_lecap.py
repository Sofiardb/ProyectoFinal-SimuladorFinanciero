import pytest
import numpy as np
from app.simulacion.letras import simular_letra_lecap


def test_longitud_trayectoria():
    tray = simular_letra_lecap(1000, 0.60, 6)
    assert len(tray) == 7


def test_valor_inicial_es_monto():
    tray = simular_letra_lecap(1000, 0.60, 6)
    assert tray[0] == pytest.approx(1000.0)


def test_valor_al_vencimiento_es_vn():
    monto, tna, t_venc = 1000.0, 0.60, 6
    vn = monto * (1 + tna * t_venc / 12)
    tray = simular_letra_lecap(monto, tna, t_venc)
    assert tray[t_venc] == pytest.approx(vn)


def test_crecimiento_monotono():
    tray = simular_letra_lecap(1000, 0.48, 6)
    for t in range(len(tray) - 1):
        assert tray[t + 1] >= tray[t]


def test_tna_cero():
    tray = simular_letra_lecap(1000, 0.0, 6)
    for v in tray:
        assert v == pytest.approx(1000.0)


def test_formula_analitica():
    monto, tna, t_venc = 1000.0, 0.36, 6
    vn = monto * (1 + tna * t_venc / 12)
    tray = simular_letra_lecap(monto, tna, t_venc)
    for t in range(t_venc + 1):
        esperado = vn / (1 + tna * (t_venc - t) / 12)
        assert tray[t] == pytest.approx(esperado)
