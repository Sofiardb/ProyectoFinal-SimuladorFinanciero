import numpy as np
import pytest
from app.simulacion.bonos import simular_bono_indexado_vectorizado, simular_bono_tasa_fija

N = 5


def _factor_acum(pi, t_venc):
    t = np.arange(t_venc + 1)
    return np.tile((1 + pi) ** t, (N, 1))


def test_forma_output():
    flujos_base = [{"mes": 12, "capital_adj": 1000.0, "interest_adj": 100.0}]
    resultado = simular_bono_indexado_vectorizado(1000.0, flujos_base, 0.10, _factor_acum(0.05, 12))
    assert resultado.shape == (N, 13)


def test_v0_es_monto():
    # bases=1100, tir_real=0.10 → V(0) = 1100/(1.10)^1 = 1000.0
    flujos_base = [{"mes": 12, "capital_adj": 1000.0, "interest_adj": 100.0}]
    resultado = simular_bono_indexado_vectorizado(1000.0, flujos_base, 0.10, _factor_acum(0.05, 12))
    assert resultado[:, 0] == pytest.approx(np.full(N, 1000.0))


def test_ultimo_valor_incluye_inflacion():
    flujos_base = [{"mes": 6, "capital_adj": 900.0, "interest_adj": 100.0}]
    pi, tir_real = 0.04, 0.20
    monto = 1000.0 / (1 + tir_real) ** (6 / 12)
    resultado = simular_bono_indexado_vectorizado(monto, flujos_base, tir_real, _factor_acum(pi, 6))
    esperado = 1000.0 * (1 + pi) ** 6
    assert resultado[:, -1] == pytest.approx(np.full(N, esperado))


def test_inflacion_cero_igual_a_bono_fijo():
    flujos_base = [{"mes": 12, "capital_adj": 1000.0, "interest_adj": 100.0}]
    tir = 0.10
    monto = 1100.0 / (1 + tir)
    resultado = simular_bono_indexado_vectorizado(monto, flujos_base, tir, _factor_acum(0.0, 12))
    tray_fija = simular_bono_tasa_fija(monto, [{"mes": 12, "monto": 1100.0}], tir)
    assert resultado == pytest.approx(np.tile(tray_fija, (N, 1)))


def test_mayor_inflacion_mayor_valor_final():
    flujos_base = [{"mes": 6, "capital_adj": 900.0, "interest_adj": 100.0}]
    tir_real = 0.10
    monto = 1000.0 / (1 + tir_real) ** (6 / 12)
    pis = [0.02, 0.04, 0.06, 0.08, 0.10]
    t = np.arange(7)
    fac = np.array([(1 + pi) ** t for pi in pis])
    resultado = simular_bono_indexado_vectorizado(monto, flujos_base, tir_real, fac)
    assert np.all(np.diff(resultado[:, -1]) > 0)


def test_no_crashea_cuando_flujo_excede_ancho_del_slice():
    # El orquestador pasa un factor_acum_slice más angosto que el vencimiento real cuando el bono
    # vence después del horizonte simulado — antes esto lanzaba IndexError al indexar
    # factor_acum_slice[:, meses] con un mes fuera de rango.
    flujos_base = [{"mes": 12, "capital_adj": 1000.0, "interest_adj": 100.0}]
    t_emit = 6
    resultado = simular_bono_indexado_vectorizado(1000.0, flujos_base, 0.10, _factor_acum(0.05, t_emit))

    assert resultado.shape == (N, t_emit + 1)
    assert resultado[:, 0] == pytest.approx(np.full(N, 1000.0))
    assert np.all(np.isfinite(resultado))


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
    resultado = simular_bono_indexado_vectorizado(monto, flujos_base, tir_real, _factor_acum(0.03, 12))
    assert resultado[:, 0] == pytest.approx(np.full(N, monto))
