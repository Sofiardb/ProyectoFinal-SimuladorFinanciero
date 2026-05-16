import pytest
from app.simulacion.plazo_fijo import simular_plazo_fijo_tradicional


def test_longitud_trayectoria():
    tray = simular_plazo_fijo_tradicional(1000, 0.12, 6, False, 12)
    assert len(tray) == 13  # T+1 valores: mes 0 hasta mes 12


def test_valor_inicial_es_monto():
    tray = simular_plazo_fijo_tradicional(5000, 0.24, 3, False, 6)
    assert tray[0] == pytest.approx(5000.0)


def test_crecimiento_nominal_sin_vencimiento():
    # Plazo vence en mes 12, horizonte es 6 → nunca vence dentro de T
    monto, tna = 1000.0, 0.12
    r_m = tna / 12
    tray = simular_plazo_fijo_tradicional(monto, tna, 12, False, 6)
    for t in range(7):
        esperado = monto * (1 + r_m) ** t
        assert tray[t] == pytest.approx(esperado)


def test_vence_antes_sin_reinversion():
    # Vence en mes 2, horizonte 5 → desde mes 2 el valor queda fijo
    monto, tna = 1000.0, 0.24
    r_m = tna / 12
    tray = simular_plazo_fijo_tradicional(monto, tna, 2, False, 5)

    m_venc = monto * (1 + r_m) ** 2
    assert tray[2] == pytest.approx(m_venc)
    assert tray[3] == pytest.approx(m_venc)
    assert tray[5] == pytest.approx(m_venc)


def test_vence_antes_con_reinversion():
    # Reinvierte: el crecimiento debe ser continuo como si fuera un solo plazo
    monto, tna = 1000.0, 0.24
    r_m = tna / 12
    tray = simular_plazo_fijo_tradicional(monto, tna, 2, True, 5)

    # Con reinversión, V(t) = monto * (1 + r_m)^t para todo t
    for t in range(6):
        assert tray[t] == pytest.approx(monto * (1 + r_m) ** t)


def test_vence_exactamente_en_T():
    monto, tna = 2000.0, 0.36
    r_m = tna / 12
    tray = simular_plazo_fijo_tradicional(monto, tna, 6, False, 6)
    assert tray[6] == pytest.approx(monto * (1 + r_m) ** 6)


def test_tna_cero():
    # Con tasa cero el capital no crece nunca
    tray = simular_plazo_fijo_tradicional(1000, 0.0, 3, True, 6)
    for v in tray:
        assert v == pytest.approx(1000.0)
