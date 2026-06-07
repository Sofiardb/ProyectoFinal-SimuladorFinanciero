import numpy as np


def simular_plazo_fijo_uva_vectorizado(
    monto: float,
    tasa_real_anual: float,
    t_venc_meses: int,
    reinvertir: bool,
    T_meses: int,
    factor_acum_matrix: np.ndarray,  # (N, T_meses+1)
) -> np.ndarray:                     # (N, T_meses+1)
    r_m = tasa_real_anual / 12
    t = np.arange(T_meses + 1)
    trayectoria = monto * factor_acum_matrix * (1 + r_m) ** t
    if not reinvertir and t_venc_meses <= T_meses:
        trayectoria[:, t_venc_meses + 1:] = trayectoria[:, t_venc_meses:t_venc_meses + 1]
    return trayectoria


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
