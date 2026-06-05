import numpy as np

from app.simulacion.acciones import simular_accion
from app.simulacion.bonos import simular_bono_indexado, simular_bono_tasa_fija
from app.simulacion.letras import simular_letra_lecap, simular_letra_lecer
from app.simulacion.plazo_fijo import simular_plazo_fijo_tradicional, simular_plazo_fijo_uva


def calcular_estadisticas(matriz):
    p25, p50, p75 = np.percentile(matriz, [25, 50, 75], axis=0)
    return {
        "media":   np.mean(matriz, axis=0).tolist(),
        "mediana": p50.tolist(),
        "p25":     p25.tolist(),
        "p75":     p75.tolist(),
        "minimo":  np.min(matriz, axis=0).tolist(),
        "maximo":  np.max(matriz, axis=0).tolist(),
    }


N_SIMULACIONES = 1000


def simular_portfolio(parametros: dict) -> dict:
    T_meses = parametros["T_meses"]
    N_simulaciones = N_SIMULACIONES
    escenarios = parametros["escenarios"]
    instrumentos = parametros["instrumentos"]

    semilla = parametros.get("semilla")
    if semilla is None:
        semilla = int(np.random.default_rng().integers(0, 2**31))
    rng = np.random.default_rng(semilla)

    n_favorable    = N_simulaciones // 3
    n_moderado     = N_simulaciones // 3
    n_desfavorable = N_simulaciones - n_favorable - n_moderado

    esc_favorable    = escenarios["favorable"]
    esc_moderado     = escenarios["moderado"]
    esc_desfavorable = escenarios["desfavorable"]

    # (N, T_meses) — filas 0..n_fav-1 favorable, luego moderado, luego desfavorable
    inflacion = np.vstack([
        rng.uniform(esc_favorable["inflacion_mensual_min"],    esc_favorable["inflacion_mensual_max"],    (n_favorable,    T_meses)),
        rng.uniform(esc_moderado["inflacion_mensual_min"],     esc_moderado["inflacion_mensual_max"],     (n_moderado,     T_meses)),
        rng.uniform(esc_desfavorable["inflacion_mensual_min"], esc_desfavorable["inflacion_mensual_max"], (n_desfavorable, T_meses)),
    ])

    # (N, T_meses+1) — factor_acum[n, t] = producto acumulado de (1+π) hasta el mes t
    factor_acum_matrix = np.ones((N_simulaciones, T_meses + 1))
    factor_acum_matrix[:, 1:] = np.cumprod(1 + inflacion, axis=1)

    # índice de mercado único (SP500/USD) compartido entre todas las acciones
    z_indice = rng.standard_normal((N_simulaciones, T_meses))

    # shock idiosincrático por acción
    z_propios_accion = {
        inst["id"]: rng.standard_normal((N_simulaciones, T_meses))
        for inst in instrumentos
        if inst["tipo"] == "accion"
    }

    matrices_trayectorias = {inst["id"]: np.empty((N_simulaciones, T_meses + 1)) for inst in instrumentos}

    for n in range(N_simulaciones):
        inflacion_n = inflacion[n]

        for inst in instrumentos:
            tipo = inst["tipo"]

            if tipo == "accion":
                rho = inst["rho"]
                z_accion_n = rho * z_indice[n] + np.sqrt(1 - rho**2) * z_propios_accion[inst["id"]][n]
                trayectoria = simular_accion(inst["monto"], inst["mu"], inst["sigma"], T_meses, z_accion_n.tolist())

            elif tipo == "lecap":
                trayectoria = simular_letra_lecap(inst["monto"], inst["tna"], inst["t_venc_meses"])

            elif tipo == "lecer":
                meses_venc = inst["t_venc_meses"]
                trayectoria = simular_letra_lecer(inst["monto"], inst["tna"], meses_venc, inflacion_n[:meses_venc].tolist())

            elif tipo == "bono_tasa_fija":
                trayectoria = simular_bono_tasa_fija(inst["monto"], inst["flujos"], inst["tir"])

            elif tipo == "bono_indexado":
                meses_venc = max(f["mes"] for f in inst["flujos_base"])
                trayectoria = simular_bono_indexado(
                    inst["monto"], inst["flujos_base"], inst["tir_real"], inflacion_n[:meses_venc].tolist()
                )

            elif tipo == "plazo_fijo_tradicional":
                trayectoria = simular_plazo_fijo_tradicional(
                    inst["monto"], inst["tna"], inst["t_venc_meses"], inst["reinvertir"], T_meses
                )

            elif tipo == "plazo_fijo_uva":
                trayectoria = simular_plazo_fijo_uva(
                    inst["monto"], inst["tasa_real_anual"], inst["t_venc_meses"],
                    inst["reinvertir"], T_meses, inflacion_n.tolist()
                )

            if len(trayectoria) < T_meses + 1:
                trayectoria = trayectoria + [trayectoria[-1]] * (T_meses + 1 - len(trayectoria))

            matrices_trayectorias[inst["id"]][n] = trayectoria

    corte_favorable    = slice(0, n_favorable)
    corte_moderado     = slice(n_favorable, n_favorable + n_moderado)
    corte_desfavorable = slice(n_favorable + n_moderado, N_simulaciones)

    def estadisticas_por_escenario(matriz):
        return {
            "global":       calcular_estadisticas(matriz),
            "favorable":    calcular_estadisticas(matriz[corte_favorable]),
            "moderado":     calcular_estadisticas(matriz[corte_moderado]),
            "desfavorable": calcular_estadisticas(matriz[corte_desfavorable]),
        }

    def metricas_completas(matriz, monto):
        return {
            "patrimonio":          estadisticas_por_escenario(matriz),
            "ganancias_nominales": estadisticas_por_escenario(matriz - monto),
            "ganancias_reales":    estadisticas_por_escenario(matriz / factor_acum_matrix - monto),
        }

    estadisticas_instrumentos = {}
    for inst in instrumentos:
        estadisticas_instrumentos[inst["id"]] = metricas_completas(
            matrices_trayectorias[inst["id"]], inst["monto"]
        )

    def _es_usd(inst):
        return inst["tipo"] == "accion" and inst.get("mercado", "ars") == "usd"

    def _agregar_portfolio(lista):
        if not lista:
            return np.zeros((N_simulaciones, T_meses + 1)), 0.0
        return (
            sum(matrices_trayectorias[i["id"]] for i in lista),
            sum(i["monto"] for i in lista),
        )

    insts_ars = [i for i in instrumentos if not _es_usd(i)]
    insts_usd = [i for i in instrumentos if     _es_usd(i)]

    matriz_ars, monto_ars = _agregar_portfolio(insts_ars)
    matriz_usd, monto_usd = _agregar_portfolio(insts_usd)

    return {
        "semilla":       semilla,
        "instrumentos":  estadisticas_instrumentos,
        "portfolio_ars": metricas_completas(matriz_ars, monto_ars),
        "portfolio_usd": metricas_completas(matriz_usd, monto_usd),
    }
