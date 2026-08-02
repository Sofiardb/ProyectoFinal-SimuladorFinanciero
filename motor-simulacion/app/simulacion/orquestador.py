import numpy as np

from app.simulacion.acciones import simular_accion_vectorizado
from app.simulacion.bonos import simular_bono_indexado_vectorizado, simular_bono_tasa_fija
from app.simulacion.letras import simular_letra_lecap, simular_letra_lecer_vectorizado
from app.simulacion.plazo_fijo import simular_plazo_fijo_tradicional, simular_plazo_fijo_uva_vectorizado


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

    # (N, T_meses+1) — tasa mensual sin acumular, para graficar junto a la acumulada. t=0 no tuvo
    # inflación todavía (recién arranca la simulación), por eso queda en 0.
    inflacion_mensual_matrix = np.zeros((N_simulaciones, T_meses + 1))
    inflacion_mensual_matrix[:, 1:] = inflacion

    # Inflación USD, alineada al mismo escenario (misma partición de tercios que ARS, muestreo
    # independiente dentro del rango USD de cada tercio) — no es un cross-product ARS×USD. Se usa
    # para deflactar portfolio_usd y los instrumentos en dólares en vez de la inflación argentina.
    inflacion_usd = np.vstack([
        rng.uniform(esc_favorable["inflacion_mensual_min_usd"],    esc_favorable["inflacion_mensual_max_usd"],    (n_favorable,    T_meses)),
        rng.uniform(esc_moderado["inflacion_mensual_min_usd"],     esc_moderado["inflacion_mensual_max_usd"],     (n_moderado,     T_meses)),
        rng.uniform(esc_desfavorable["inflacion_mensual_min_usd"], esc_desfavorable["inflacion_mensual_max_usd"], (n_desfavorable, T_meses)),
    ])
    factor_acum_usd_matrix = np.ones((N_simulaciones, T_meses + 1))
    factor_acum_usd_matrix[:, 1:] = np.cumprod(1 + inflacion_usd, axis=1)

    inflacion_mensual_usd_matrix = np.zeros((N_simulaciones, T_meses + 1))
    inflacion_mensual_usd_matrix[:, 1:] = inflacion_usd

    # CER/UVA incorpora inflación con ~2 meses de rezago (T-2):
    # factor_cer[t] = factor_acum[t-2] para t>=2; = 1 para t<2
    # (la inflación anterior a t=0 ya está incorporada en el precio de compra)
    factor_cer_matrix = np.ones((N_simulaciones, T_meses + 1))
    factor_cer_matrix[:, 2:] = factor_acum_matrix[:, :-2]

    # índice de mercado único (SP500/USD) compartido entre todas las acciones
    z_indice = rng.standard_normal((N_simulaciones, T_meses))

    # shock idiosincrático por acción
    z_propios_accion = {
        inst["id"]: rng.standard_normal((N_simulaciones, T_meses))
        for inst in instrumentos
        if inst["tipo"] == "accion"
    }

    def _es_usd(inst):
        return inst["tipo"] in ("accion", "plazo_fijo_usd")

    matrices_trayectorias = {}

    for inst in instrumentos:
        tipo  = inst["tipo"]
        id_inst = inst["id"]

        if tipo == "accion":
            rho = inst["rho"]
            z_accion = rho * z_indice + np.sqrt(1 - rho**2) * z_propios_accion[id_inst]
            matrices_trayectorias[id_inst] = simular_accion_vectorizado(
                inst["monto"], inst["mu"], inst["sigma"], T_meses, z_accion
            )

        elif tipo == "lecap":
            tray_1d = simular_letra_lecap(inst["monto"], inst["tna"], inst["t_venc_meses"])
            if len(tray_1d) > T_meses + 1:
                tray_1d = tray_1d[:T_meses + 1]
            elif len(tray_1d) < T_meses + 1:
                tray_1d = tray_1d + [tray_1d[-1]] * (T_meses + 1 - len(tray_1d))
            matrices_trayectorias[id_inst] = np.tile(tray_1d, (N_simulaciones, 1))

        elif tipo == "lecer":
            meses_venc = inst["t_venc_meses"]
            t_emit = min(meses_venc, T_meses)
            tray_2d = simular_letra_lecer_vectorizado(
                inst["monto"], inst["tna"], meses_venc,
                factor_cer_matrix[:, :t_emit + 1]
            )
            if t_emit < T_meses:
                padding = np.repeat(tray_2d[:, -1:], T_meses - t_emit, axis=1)
                tray_2d = np.hstack([tray_2d, padding])
            matrices_trayectorias[id_inst] = tray_2d

        elif tipo == "bono_tasa_fija":
            tray_1d = simular_bono_tasa_fija(inst["monto"], inst["flujos"], inst["tir"])
            if len(tray_1d) > T_meses + 1:
                tray_1d = tray_1d[:T_meses + 1]
            elif len(tray_1d) < T_meses + 1:
                tray_1d = tray_1d + [tray_1d[-1]] * (T_meses + 1 - len(tray_1d))
            matrices_trayectorias[id_inst] = np.tile(tray_1d, (N_simulaciones, 1))

        elif tipo == "bono_indexado":
            meses_venc = max(f["mes"] for f in inst["flujos_base"])
            t_emit = min(meses_venc, T_meses)
            tray_2d = simular_bono_indexado_vectorizado(
                inst["monto"], inst["flujos_base"], inst["tir_real"],
                factor_cer_matrix[:, :t_emit + 1]
            )
            if t_emit < T_meses:
                padding = np.repeat(tray_2d[:, -1:], T_meses - t_emit, axis=1)
                tray_2d = np.hstack([tray_2d, padding])
            matrices_trayectorias[id_inst] = tray_2d

        elif tipo == "plazo_fijo_tradicional":
            tray_1d = simular_plazo_fijo_tradicional(
                inst["monto"], inst["tna"], inst["t_venc_meses"], inst["reinvertir"], T_meses
            )
            matrices_trayectorias[id_inst] = np.tile(tray_1d, (N_simulaciones, 1))

        elif tipo == "plazo_fijo_uva":
            matrices_trayectorias[id_inst] = simular_plazo_fijo_uva_vectorizado(
                inst["monto"], inst["tasa_real_anual"], inst["t_venc_meses"],
                inst["reinvertir"], T_meses, factor_cer_matrix
            )

        elif tipo == "plazo_fijo_usd":
            tray_1d = simular_plazo_fijo_tradicional(
                inst["monto"], inst["tna"], inst["t_venc_meses"], inst["reinvertir"], T_meses
            )
            matrices_trayectorias[id_inst] = np.tile(tray_1d, (N_simulaciones, 1))

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

    def metricas_completas(matriz, monto, matriz_real):
        return {
            "patrimonio":          estadisticas_por_escenario(matriz),
            "ganancias_nominales": estadisticas_por_escenario(matriz - monto),
            "ganancias_reales":    estadisticas_por_escenario(matriz_real - monto),
        }

    # deflactor de inflación por instrumento (sin congelar en el vencimiento): el capital que
    # queda parado como efectivo después de vencer sigue expuesto a la inflación corriendo, así
    # que "ganancia real" sigue cayendo aunque el nominal ya esté planchado por padding (Decisión 7).
    matriz_real_por_instrumento = {
        inst["id"]: matrices_trayectorias[inst["id"]] / (
            factor_acum_usd_matrix if _es_usd(inst) else factor_acum_matrix
        )
        for inst in instrumentos
    }

    estadisticas_instrumentos = {}
    for inst in instrumentos:
        id_inst = inst["id"]
        estadisticas_instrumentos[id_inst] = metricas_completas(
            matrices_trayectorias[id_inst], inst["monto"], matriz_real_por_instrumento[id_inst]
        )

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

    matriz_real_ars = matriz_ars / factor_acum_matrix
    matriz_real_usd = matriz_usd / factor_acum_usd_matrix

    return {
        "semilla":                 semilla,
        "inflacion_acumulada":     estadisticas_por_escenario(factor_acum_matrix),
        "inflacion_acumulada_usd": estadisticas_por_escenario(factor_acum_usd_matrix),
        "inflacion_mensual":       estadisticas_por_escenario(inflacion_mensual_matrix),
        "inflacion_mensual_usd":   estadisticas_por_escenario(inflacion_mensual_usd_matrix),
        "cer_acumulado":           estadisticas_por_escenario(factor_cer_matrix),
        "instrumentos":            estadisticas_instrumentos,
        "portfolio_ars":           metricas_completas(matriz_ars, monto_ars, matriz_real_ars),
        "portfolio_usd":           metricas_completas(matriz_usd, monto_usd, matriz_real_usd),
    }
