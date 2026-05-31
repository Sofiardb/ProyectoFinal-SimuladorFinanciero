import pytest
import numpy as np
from app.simulacion.bonos import simular_bono_tasa_fija


FLUJOS_BULLET = [{"mes": 12, "monto": 1100.0}]
MONTO_BULLET = 1000.0
TIR_BULLET = 0.10  # 1100 / (1.10)^1 = 1000.0


def test_longitud_trayectoria():
    tray = simular_bono_tasa_fija(MONTO_BULLET, FLUJOS_BULLET, TIR_BULLET)
    assert len(tray) == 13  # t_venc=12 → indices 0..12


def test_v0_es_monto():
    tray = simular_bono_tasa_fija(MONTO_BULLET, FLUJOS_BULLET, TIR_BULLET)
    assert tray[0] == pytest.approx(MONTO_BULLET)


def test_ultimo_valor_es_suma_flujos():
    tray = simular_bono_tasa_fija(MONTO_BULLET, FLUJOS_BULLET, TIR_BULLET)
    suma = sum(f["monto"] for f in FLUJOS_BULLET)
    assert tray[-1] == pytest.approx(suma)


def test_crecimiento_monotono_bono_bullet():
    tray = simular_bono_tasa_fija(MONTO_BULLET, FLUJOS_BULLET, TIR_BULLET)
    for t in range(len(tray) - 1):
        assert tray[t + 1] >= tray[t]


def test_v0_es_monto_con_cupones():
    flujos = [
        {"mes": 6,  "monto": 300.0},
        {"mes": 12, "monto": 800.0},
    ]
    tir = 0.40
    monto = sum(f["monto"] * (1 + tir) ** (-f["mes"] / 12) for f in flujos)
    tray = simular_bono_tasa_fija(monto, flujos, tir)
    assert tray[0] == pytest.approx(monto)


def test_formula_analitica_bono_bullet():
    monto, tir, t_venc = 1000.0, 0.10, 12
    flujos = [{"mes": t_venc, "monto": monto * (1 + tir)}]
    tray = simular_bono_tasa_fija(monto, flujos, tir)
    for t in range(t_venc + 1):
        esperado = monto * (1 + tir) ** (t / 12)
        assert tray[t] == pytest.approx(esperado)


def test_longitud_con_multiples_flujos():
    flujos = [
        {"mes": 3, "monto": 200.0},
        {"mes": 6, "monto": 200.0},
        {"mes": 9, "monto": 800.0},
    ]
    tray = simular_bono_tasa_fija(1000.0, flujos, 0.30)
    assert len(tray) == 10  # t_venc=9
