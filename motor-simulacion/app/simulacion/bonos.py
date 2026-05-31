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


def simular_bono_indexado(
    monto: float,
    flujos_base: list[dict],   # [{"mes": int, "capital_adj": float, "interest_adj": float}, ...]
    tir_real: float,           # TIR real anual en decimal
    inflacion_mensual: list[float],  # largo = mes del último flujo
) -> list[float]:
    """
    flujos_base: flujos ajustados por CER a t=0. La inflación simulada los reajusta.
    inflacion_mensual tiene largo igual al mes del último flujo.
    Retorna [V(0), ..., V(último_mes)].
    """
    meses = np.array([f["mes"] for f in flujos_base])
    bases = np.array([f["capital_adj"] + f["interest_adj"] for f in flujos_base])
    t_venc = int(meses.max())

    factor_acum = np.empty(t_venc + 1)
    factor_acum[0] = 1.0
    factor_acum[1:] = np.cumprod(1 + np.asarray(inflacion_mensual))

    t = np.arange(t_venc + 1)
    delta = meses[:, np.newaxis] - t[np.newaxis, :]  # (n_flujos, t_venc+1)

    # ya cobrado: flujo nominal real recibido en m_i
    montos_cobrados = (bases * factor_acum[meses])[:, np.newaxis]  # (n, 1)
    # futuro: DCF real descontado a t, luego convertido a nominal × factor_acum[t]
    contrib_futura = (
        bases[:, np.newaxis]
        * (1 + tir_real) ** (-delta / 12)
        * factor_acum[np.newaxis, :]
    )

    trayectoria = np.where(delta > 0, contrib_futura, montos_cobrados).sum(axis=0)

    return trayectoria.tolist()
