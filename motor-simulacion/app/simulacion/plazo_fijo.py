import numpy as np


def simular_plazo_fijo_uva(
    monto: float,
    tasa_real_anual: float,
    t_venc_meses: int,
    reinvertir: bool,
    T_meses: int,
    inflacion_mensual: list[float],
) -> list[float]:
    """
    Devuelve la trayectoria nominal mensual [V(0), V(1), ..., V(T)].

    tasa_real_anual: tasa real anual en decimal (ej: 0.01 para 1% real)
    inflacion_mensual: [π₁, ..., π_T] generada por el orquestador — afecta
                       el valor nominal del instrumento.
    """
    r_m = tasa_real_anual / 12

    factor_acum = np.empty(T_meses + 1)
    factor_acum[0] = 1.0
    factor_acum[1:] = np.cumprod(1 + np.asarray(inflacion_mensual))

    t = np.arange(T_meses + 1)
    trayectoria = monto * factor_acum * (1 + r_m) ** t

    if not reinvertir and t_venc_meses <= T_meses:
        m_venc = float(trayectoria[t_venc_meses])
        trayectoria[t > t_venc_meses] = m_venc

    return trayectoria.tolist()


def simular_plazo_fijo_tradicional(
    monto: float,
    tna: float,
    t_venc_meses: int,
    reinvertir: bool,
    T_meses: int,
) -> list[float]:
    """
    Devuelve la trayectoria nominal mensual [V(0), V(1), ..., V(T)].

    tna: tasa nominal anual en decimal (ej: 0.42 para 42%)
    t_venc_meses: duración del depósito en meses
    reinvertir: si el plazo vence antes de T, reinvierte en mismo instrumento
    """
    r_m = tna / 12
    t = np.arange(T_meses + 1)
    trayectoria = monto * (1 + r_m) ** t

    if not reinvertir and t_venc_meses <= T_meses:
        m_venc = float(trayectoria[t_venc_meses])
        trayectoria[t > t_venc_meses] = m_venc

    return trayectoria.tolist()
