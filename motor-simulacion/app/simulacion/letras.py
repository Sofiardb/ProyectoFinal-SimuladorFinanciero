import numpy as np


def simular_letra_lecer(
    monto: float,
    tna: float,
    t_venc_meses: int,
    T_meses: int,
    inflacion_mensual: list[float],
) -> list[float]:
    """
    Devuelve la trayectoria nominal mensual [V(0), V(1), ..., V(T)].

    inflacion_mensual: largo >= max(T, t_venc_meses) — el orquestador genera
    inflación hasta el mayor vencimiento del portfolio, no solo hasta T.
    Esto permite calcular el VN ajustado completo aunque t_venc > T.
    """
    inflacion = np.asarray(inflacion_mensual)
    N = len(inflacion)
    factor_acum = np.empty(N + 1)
    factor_acum[0] = 1.0
    factor_acum[1:] = np.cumprod(1 + inflacion)

    vn0 = monto * (1 + tna * t_venc_meses / 12)

    t = np.arange(T_meses + 1)

    # Inflación acumulada hasta min(t, t_venc): después del vencimiento el CER queda fijo
    # factor_acum[t_venc_meses] siempre es válido porque len(inflacion) >= t_venc_meses
    t_para_inflacion = np.minimum(t, t_venc_meses)
    inflation_factor = factor_acum[t_para_inflacion]

    t_restante_anos = np.maximum((t_venc_meses - t) / 12, 0)

    return (vn0 * inflation_factor / (1 + tna * t_restante_anos)).tolist()


def simular_letra_lecap(
    monto: float,
    tna: float,
    t_venc_meses: int,
    T_meses: int,
) -> list[float]:
    """
    Devuelve la trayectoria nominal mensual [V(0), V(1), ..., V(T)].

    monto: precio de compra (lo que el usuario paga en t=0)
    tna: rendimiento anualizado en decimal (ej: 0.60 para 60%)
    t_venc_meses: meses hasta el vencimiento desde t=0

    Valuación: interés simple (convención corto plazo).
    La inflación no afecta el valor nominal — el rendimiento real
    lo calcula el orquestador.
    """
    vn = monto * (1 + tna * t_venc_meses / 12)

    t = np.arange(T_meses + 1)
    t_restante_anos = np.maximum((t_venc_meses - t) / 12, 0)

    return (vn / (1 + tna * t_restante_anos)).tolist()
