import numpy as np


def simular_bono_tasa_fija(
    monto: float,
    flujos: list[dict],        # [{"mes": int, "monto": float}, ...]
    tir: float,                # TIR anual en decimal, ej: 0.55 = 55%
) -> list[float]:
    """
    flujos: lista de pagos con mes relativo al inicio de simulación y monto nominal.
    Precondición: max(f["mes"] for f in flujos) <= T (garantizado por backend).
    Retorna [V(0), ..., V(último_mes)].
    """
    meses = np.array([f["mes"] for f in flujos])
    montos_flujos = np.array([f["monto"] for f in flujos])
    t_venc = int(meses.max())

    t = np.arange(t_venc + 1)
    delta = meses[:, np.newaxis] - t[np.newaxis, :]  # (n_flujos, t_venc+1)

    # delta > 0: flujo futuro → descontar; delta <= 0: ya cobrado → valor nominal
    factores_descuento = np.where(delta > 0, (1 + tir) ** (-delta / 12), 1.0)
    trayectoria = (montos_flujos[:, np.newaxis] * factores_descuento).sum(axis=0)

    return trayectoria.tolist()


def simular_bono_indexado_vectorizado(
    monto: float,
    flujos_base: list[dict],
    tir_real: float,
    factor_acum_slice: np.ndarray,  # (N, t_venc+1) — factor_acum_matrix[:, :t_venc+1]
) -> np.ndarray:                    # (N, t_venc+1)
    meses = np.array([f["mes"] for f in flujos_base])
    bases = np.array([f["capital_adj"] + f["interest_adj"] for f in flujos_base])
    t_venc = int(meses.max())

    t = np.arange(t_venc + 1)
    delta = meses[:, np.newaxis] - t[np.newaxis, :]   # (n_flujos, t_venc+1)

    # flujos futuros: base * descuento_real * factor_acum[t]
    future_disc = np.where(delta > 0, (1 + tir_real) ** (-delta / 12), 0.0)
    contrib_futura = factor_acum_slice * (bases @ future_disc)   # (N, t_venc+1)

    # flujos ya cobrados: base * factor_acum[mes_i], constante para t >= mes_i
    flujo_ya_cobrado = (delta <= 0).astype(float)                        # (n_flujos, t_venc+1)
    contrib_cobrada = (factor_acum_slice[:, meses] * bases) @ flujo_ya_cobrado  # (N, t_venc+1)

    return contrib_futura + contrib_cobrada


