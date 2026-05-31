import numpy as np


def simular_accion(
    monto: float,
    mu: float,              # retorno esperado anual en decimal, ej: 0.15 = 15%
    sigma: float,           # volatilidad anual en decimal, ej: 0.30 = 30%
    T_meses: int,           # horizonte de simulación
    z_accion: list[float],  # largo = T_meses, generados por el orquestador
) -> list[float]:
    """
    Retorna [V(0), V(1), ..., V(T)], largo = T_meses + 1.
    V(0) = monto.  V(t) = monto * exp(Σ log returns hasta t).
    """
    shocks = np.asarray(z_accion)
    retornos_log = (mu - 0.5 * sigma**2) / 12 + sigma / np.sqrt(12) * shocks
    retornos_acum = np.concatenate([[0.0], np.cumsum(retornos_log)])
    return (monto * np.exp(retornos_acum)).tolist()
