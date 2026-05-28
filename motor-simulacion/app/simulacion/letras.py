import numpy as np


def simular_letra_lecer(
    monto: float,
    tna: float,
    t_venc_meses: int,
    inflacion_mensual: list[float],
) -> list[float]:
    """
    Devuelve la trayectoria nominal mensual [V(0), V(1), ..., V(t_venc)].

    Precondición: t_venc_meses <= T_meses (garantizado por el backend).
    inflacion_mensual tiene exactamente t_venc_meses elementos.
    """
    factor_acum = np.empty(t_venc_meses + 1)
    factor_acum[0] = 1.0
    factor_acum[1:] = np.cumprod(1 + np.asarray(inflacion_mensual))

    vn0 = monto * (1 + tna * t_venc_meses / 12)

    t = np.arange(t_venc_meses + 1)
    t_restante_anos = (t_venc_meses - t) / 12

    return (vn0 * factor_acum / (1 + tna * t_restante_anos)).tolist()


def simular_letra_lecap(
    monto: float,
    tna: float,
    t_venc_meses: int,
) -> list[float]:
    """
    Devuelve la trayectoria nominal mensual [V(0), V(1), ..., V(t_venc)].

    Precondición: t_venc_meses <= T_meses (garantizado por el backend).
    Valuación por interés simple (convención corto plazo).
    """
    vn = monto * (1 + tna * t_venc_meses / 12)

    t = np.arange(t_venc_meses + 1)
    t_restante_anos = (t_venc_meses - t) / 12

    return (vn / (1 + tna * t_restante_anos)).tolist()
