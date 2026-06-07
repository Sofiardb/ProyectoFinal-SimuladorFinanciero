import numpy as np


def simular_letra_lecer_vectorizado(
    monto: float,
    tna: float,
    t_venc_meses: int,
    factor_acum_slice: np.ndarray,  # (N, t_venc_meses+1) — factor_acum_matrix[:, :t_venc+1]
) -> np.ndarray:                    # (N, t_venc_meses+1)
    vn0 = monto * (1 + tna * t_venc_meses / 12)
    t = np.arange(t_venc_meses + 1)
    t_restante_anos = (t_venc_meses - t) / 12
    return vn0 * factor_acum_slice / (1 + tna * t_restante_anos)


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
