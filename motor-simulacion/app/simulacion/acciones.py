import numpy as np


def simular_accion_vectorizado(
    monto: float,
    mu: float,
    sigma: float,
    T_meses: int,
    z_matrix: np.ndarray,   # (N, T_meses) — shocks combinados (rho * z_indice + √(1-ρ²) * z_propio)
) -> np.ndarray:            # (N, T_meses+1)
    N = z_matrix.shape[0]
    retornos_log = (mu - 0.5 * sigma**2) / 12 + sigma / np.sqrt(12) * z_matrix
    retornos_acum = np.hstack([np.zeros((N, 1)), np.cumsum(retornos_log, axis=1)])
    return monto * np.exp(retornos_acum)
