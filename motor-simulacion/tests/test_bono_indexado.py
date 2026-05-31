import pytest
import numpy as np
from app.simulacion.bonos import simular_bono_indexado, simular_bono_tasa_fija


def test_longitud_trayectoria():
    flujos_base = [{"mes": 12, "capital_adj": 1000.0, "interest_adj": 100.0}]
    tray = simular_bono_indexado(1000.0, flujos_base, 0.10, [0.05] * 12)
    assert len(tray) == 13


def test_v0_es_monto():
    # bases=1100, tir_real=0.10 → monto = 1100/(1.10)^1 = 1000.0
    # factor_acum[0]=1 siempre, por lo que V(0) = monto sin importar la inflación futura
    flujos_base = [{"mes": 12, "capital_adj": 1000.0, "interest_adj": 100.0}]
    tray = simular_bono_indexado(1000.0, flujos_base, 0.10, [0.05] * 12)
    assert tray[0] == pytest.approx(1000.0)


def test_ultimo_valor_incluye_inflacion():
    # V(t_venc) = base * factor_acum[t_venc]
    flujos_base = [{"mes": 6, "capital_adj": 900.0, "interest_adj": 100.0}]
    pi = 0.04
    factor_acum_6 = (1 + pi) ** 6
    esperado = 1000.0 * factor_acum_6

    tir_real = 0.20
    monto = 1000.0 / (1 + tir_real) ** (6 / 12)
    tray = simular_bono_indexado(monto, flujos_base, tir_real, [pi] * 6)
    assert tray[-1] == pytest.approx(esperado)


def test_inflacion_cero_igual_a_fija_real():
    # Con inflación cero, factor_acum[t]=1 siempre → idéntico al bono tasa fija
    flujos_base = [{"mes": 12, "capital_adj": 1000.0, "interest_adj": 100.0}]
    tir = 0.10
    monto = 1100.0 / (1 + tir)

    tray_idx = simular_bono_indexado(monto, flujos_base, tir, [0.0] * 12)
    tray_fija = simular_bono_tasa_fija(monto, [{"mes": 12, "monto": 1100.0}], tir)

    for v_idx, v_fija in zip(tray_idx, tray_fija):
        assert v_idx == pytest.approx(v_fija)


def test_mayor_inflacion_mayor_valor_final():
    flujos_base = [{"mes": 6, "capital_adj": 900.0, "interest_adj": 100.0}]
    tir_real = 0.10
    monto = 1000.0 / (1 + tir_real) ** (6 / 12)

    tray_baja = simular_bono_indexado(monto, flujos_base, tir_real, [0.02] * 6)
    tray_alta = simular_bono_indexado(monto, flujos_base, tir_real, [0.10] * 6)

    assert tray_alta[-1] > tray_baja[-1]


def test_v0_es_monto_multiples_flujos():
    flujos_base = [
        {"mes": 6,  "capital_adj": 0.0,    "interest_adj": 50.0},
        {"mes": 12, "capital_adj": 1000.0, "interest_adj": 50.0},
    ]
    tir_real = 0.12
    monto = sum(
        (f["capital_adj"] + f["interest_adj"]) / (1 + tir_real) ** (f["mes"] / 12)
        for f in flujos_base
    )
    tray = simular_bono_indexado(monto, flujos_base, tir_real, [0.03] * 12)
    assert tray[0] == pytest.approx(monto)
