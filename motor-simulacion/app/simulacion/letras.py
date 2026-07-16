import numpy as np


def simular_letra_lecer_vectorizado(
    monto: float,
    tna: float,
    t_venc_meses: int,
    factor_acum_slice: np.ndarray,  # (N, t_emit+1) — t_emit = min(t_venc_meses, T_meses), decidido por el llamador
) -> np.ndarray:                    # (N, t_emit+1)
    """
    El descuento a la par usa siempre el vencimiento real `t_venc_meses`; el ancho de
    `factor_acum_slice` es quien determina hasta qué mes se emite la trayectoria (puede ser
    menor a `t_venc_meses` si el instrumento vence después del horizonte de simulación).
    """
    vn0 = monto * (1 + tna * t_venc_meses / 12)
    t_emit = factor_acum_slice.shape[1] - 1
    t = np.arange(t_emit + 1)
    t_restante_anos = (t_venc_meses - t) / 12
    return vn0 * factor_acum_slice / (1 + tna * t_restante_anos)


def simular_letra_lecap(
    monto: float,
    tna: float,
    t_venc_meses: int,
) -> list[float]:
    """
    Devuelve la trayectoria nominal mensual [V(0), V(1), ..., V(t_venc)].

    Si `t_venc_meses` supera el horizonte de simulación, el orquestador trunca la salida —
    esta función siempre calcula hasta el vencimiento real.
    Valuación por interés simple (convención corto plazo).
    """
    vn = monto * (1 + tna * t_venc_meses / 12)

    t = np.arange(t_venc_meses + 1)
    t_restante_anos = (t_venc_meses - t) / 12

    return (vn / (1 + tna * t_restante_anos)).tolist()
