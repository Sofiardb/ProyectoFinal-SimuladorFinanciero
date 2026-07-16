import numpy as np


def simular_bono_tasa_fija(
    monto: float,
    flujos: list[dict],        # [{"mes": int, "monto": float}, ...]
    tir: float,                # TIR anual en decimal, ej: 0.55 = 55%
) -> list[float]:
    """
    flujos: lista de pagos con mes relativo al inicio de simulación y monto nominal.
    Si el vencimiento real supera el horizonte de simulación, el orquestador trunca la
    salida — esta función siempre calcula hasta el último flujo.
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
    factor_acum_slice: np.ndarray,  # (N, t_emit+1) — t_emit = min(vencimiento_real, T_meses), decidido por el llamador
) -> np.ndarray:                    # (N, t_emit+1)
    """
    El ancho de `factor_acum_slice` determina hasta qué mes se emite la trayectoria. Si el
    bono vence después del horizonte de simulación, sus flujos posteriores a `t_emit` nunca
    caen en el rango "ya cobrado" (quedan enmascarados por `flujo_ya_cobrado`), pero sí
    participan del descuento de flujos futuros.
    """
    meses = np.array([f["mes"] for f in flujos_base])
    bases = np.array([f["capital_adj"] + f["interest_adj"] for f in flujos_base])
    t_emit = factor_acum_slice.shape[1] - 1

    t = np.arange(t_emit + 1)
    delta = meses[:, np.newaxis] - t[np.newaxis, :]   # (n_flujos, t_emit+1)

    # flujos futuros: base * descuento_real * factor_acum[t]
    future_disc = np.where(delta > 0, (1 + tir_real) ** (-delta / 12), 0.0)
    contrib_futura = factor_acum_slice * (bases @ future_disc)   # (N, t_emit+1)

    # flujos ya cobrados: base * factor_acum[mes_i], constante para t >= mes_i.
    # idx_seguro capa los meses de flujo que caen después de t_emit para no indexar fuera de
    # rango — esos flujos nunca están "ya cobrados" dentro de la ventana emitida, así que el
    # valor de factor_acum usado ahí queda descartado por la máscara de todos modos.
    flujo_ya_cobrado = (delta <= 0).astype(float)                        # (n_flujos, t_emit+1)
    idx_seguro = np.minimum(meses, t_emit)
    contrib_cobrada = (factor_acum_slice[:, idx_seguro] * bases) @ flujo_ya_cobrado  # (N, t_emit+1)

    return contrib_futura + contrib_cobrada


