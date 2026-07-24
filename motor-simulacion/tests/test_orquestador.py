import copy

import numpy as np
import pytest

from app.simulacion.orquestador import simular_portfolio


# flujos bullet priced at par: flujo = monto * (1+tir)^(t_venc/12)
# garantiza que DCF en t=0 == monto, que es el invariante del sistema
_MONTO_BONO_FIJO   = 8000.0
_TIR_BONO_FIJO     = 0.55
_FLUJO_BONO_FIJO   = _MONTO_BONO_FIJO * (1 + _TIR_BONO_FIJO) ** (3 / 12)

_MONTO_BONO_IDX    = 8000.0
_TIR_REAL_BONO_IDX = 0.05
_FLUJO_BASE_BONO_IDX = _MONTO_BONO_IDX * (1 + _TIR_REAL_BONO_IDX) ** (3 / 12)

PARAMS_BASE = {
    "T_meses": 3,
    "escenarios": {
        "favorable":    {"inflacion_mensual_min": 0.02, "inflacion_mensual_max": 0.03, "inflacion_mensual_min_usd": 0.000, "inflacion_mensual_max_usd": 0.002},
        "moderado":     {"inflacion_mensual_min": 0.04, "inflacion_mensual_max": 0.06, "inflacion_mensual_min_usd": 0.002, "inflacion_mensual_max_usd": 0.004},
        "desfavorable": {"inflacion_mensual_min": 0.08, "inflacion_mensual_max": 0.12, "inflacion_mensual_min_usd": 0.004, "inflacion_mensual_max_usd": 0.008},
    },
    "instrumentos": [
        {
            "id": "accion_1",
            "tipo": "accion",
            "monto": 10000.0,
            "mu": 0.15,
            "sigma": 0.30,
            "rho": 0.6,
            "mercado": "usd",
        },
        {
            "id": "lecap_1",
            "tipo": "lecap",
            "monto": 5000.0,
            "tna": 0.50,
            "t_venc_meses": 2,  # < T_meses → activa padding
        },
        {
            "id": "lecer_1",
            "tipo": "lecer",
            "monto": 5000.0,
            "tna": 0.05,
            "t_venc_meses": 3,
        },
        {
            "id": "bono_fijo_1",
            "tipo": "bono_tasa_fija",
            "monto": _MONTO_BONO_FIJO,
            "flujos": [{"mes": 3, "monto": _FLUJO_BONO_FIJO}],
            "tir": _TIR_BONO_FIJO,
        },
        {
            "id": "bono_idx_1",
            "tipo": "bono_indexado",
            "monto": _MONTO_BONO_IDX,
            "flujos_base": [{"mes": 3, "capital_adj": _FLUJO_BASE_BONO_IDX, "interest_adj": 0.0}],
            "tir_real": _TIR_REAL_BONO_IDX,
        },
        {
            "id": "pf_trad_1",
            "tipo": "plazo_fijo_tradicional",
            "monto": 5000.0,
            "tna": 0.42,
            "t_venc_meses": 3,
            "reinvertir": True,
        },
        {
            "id": "pf_uva_1",
            "tipo": "plazo_fijo_uva",
            "monto": 5000.0,
            "tasa_real_anual": 0.01,
            "t_venc_meses": 3,
            "reinvertir": True,
        },
    ],
}


_MONTO_BONO_FIJO_LARGO   = 8000.0
_TIR_BONO_FIJO_LARGO     = 0.55
_MES_VENC_LARGO          = 6  # > T_meses=3
_FLUJO_BONO_FIJO_LARGO   = _MONTO_BONO_FIJO_LARGO * (1 + _TIR_BONO_FIJO_LARGO) ** (_MES_VENC_LARGO / 12)

_MONTO_BONO_IDX_LARGO      = 8000.0
_TIR_REAL_BONO_IDX_LARGO   = 0.05
_FLUJO_BASE_BONO_IDX_LARGO = _MONTO_BONO_IDX_LARGO * (1 + _TIR_REAL_BONO_IDX_LARGO) ** (_MES_VENC_LARGO / 12)

# Todos los instrumentos financieros (lecap/lecer/bonos) vencen después del horizonte simulado
# (T_meses=3), salvo lecap_corto que vence antes — para probar que ambos casos conviven en el
# mismo portfolio sin mismatch de shapes.
PARAMS_VENCE_DESPUES_HORIZONTE = {
    "T_meses": 3,
    "escenarios": {
        "favorable":    {"inflacion_mensual_min": 0.02, "inflacion_mensual_max": 0.03, "inflacion_mensual_min_usd": 0.000, "inflacion_mensual_max_usd": 0.002},
        "moderado":     {"inflacion_mensual_min": 0.04, "inflacion_mensual_max": 0.06, "inflacion_mensual_min_usd": 0.002, "inflacion_mensual_max_usd": 0.004},
        "desfavorable": {"inflacion_mensual_min": 0.08, "inflacion_mensual_max": 0.12, "inflacion_mensual_min_usd": 0.004, "inflacion_mensual_max_usd": 0.008},
    },
    "instrumentos": [
        {
            "id": "lecap_corto",
            "tipo": "lecap",
            "monto": 5000.0,
            "tna": 0.50,
            "t_venc_meses": 2,
        },
        {
            "id": "lecap_largo",
            "tipo": "lecap",
            "monto": 5000.0,
            "tna": 0.50,
            "t_venc_meses": _MES_VENC_LARGO,
        },
        {
            "id": "lecer_largo",
            "tipo": "lecer",
            "monto": 5000.0,
            "tna": 0.05,
            "t_venc_meses": _MES_VENC_LARGO,
        },
        {
            "id": "bono_fijo_largo",
            "tipo": "bono_tasa_fija",
            "monto": _MONTO_BONO_FIJO_LARGO,
            "flujos": [{"mes": _MES_VENC_LARGO, "monto": _FLUJO_BONO_FIJO_LARGO}],
            "tir": _TIR_BONO_FIJO_LARGO,
        },
        {
            "id": "bono_idx_largo",
            "tipo": "bono_indexado",
            "monto": _MONTO_BONO_IDX_LARGO,
            "flujos_base": [{"mes": _MES_VENC_LARGO, "capital_adj": _FLUJO_BASE_BONO_IDX_LARGO, "interest_adj": 0.0}],
            "tir_real": _TIR_REAL_BONO_IDX_LARGO,
        },
    ],
}


@pytest.fixture
def params():
    return copy.deepcopy(PARAMS_BASE)


@pytest.fixture
def params_vence_despues():
    return copy.deepcopy(PARAMS_VENCE_DESPUES_HORIZONTE)

# Tests de estructura y longitud

METRICAS_STATS = ("media", "mediana", "p25", "p75", "minimo", "maximo")


def test_longitud_output(params):
    resultado = simular_portfolio(params)
    T = params["T_meses"]

    assert "instrumentos"  in resultado
    assert "portfolio_ars" in resultado
    assert "portfolio_usd" in resultado

    for sub_portfolio in ("portfolio_ars", "portfolio_usd"):
        for capa in ("patrimonio", "ganancias_nominales", "ganancias_reales"):
            for escenario in ("global", "favorable", "moderado", "desfavorable"):
                for metrica in METRICAS_STATS:
                    serie = resultado[sub_portfolio][capa][escenario][metrica]
                    assert len(serie) == T + 1

    for inst in params["instrumentos"]:
        stats_inst = resultado["instrumentos"][inst["id"]]
        for capa in ("patrimonio", "ganancias_nominales", "ganancias_reales"):
            for escenario in ("global", "favorable", "moderado", "desfavorable"):
                for metrica in METRICAS_STATS:
                    serie = stats_inst[capa][escenario][metrica]
                    assert len(serie) == T + 1


def test_estructura_output(params):
    resultado = simular_portfolio(params)

    ids_input  = {inst["id"] for inst in params["instrumentos"]}
    ids_output = set(resultado["instrumentos"].keys())
    assert ids_input == ids_output


# Tests de correctitud — patrimonio

def test_semilla_en_output(params):
    resultado = simular_portfolio(params)
    assert isinstance(resultado["semilla"], int)


def test_v0_portfolio_es_suma_montos(params):
    def _es_usd(inst):
        return inst["tipo"] == "accion" and inst.get("mercado", "ars") == "usd"

    monto_ars = sum(i["monto"] for i in params["instrumentos"] if not _es_usd(i))
    monto_usd = sum(i["monto"] for i in params["instrumentos"] if     _es_usd(i))

    resultado = simular_portfolio(params)
    assert resultado["portfolio_ars"]["patrimonio"]["global"]["media"][0] == pytest.approx(monto_ars)
    assert resultado["portfolio_usd"]["patrimonio"]["global"]["media"][0] == pytest.approx(monto_usd)


def test_instrumento_deterministico_sin_dispersion(params):
    resultado = simular_portfolio(params)

    for id_inst in ("lecap_1", "bono_fijo_1"):
        stats = resultado["instrumentos"][id_inst]["patrimonio"]["global"]
        assert stats["media"] == pytest.approx(stats["minimo"])
        assert stats["media"] == pytest.approx(stats["maximo"])


def test_escenarios_media_ordenada(params):
    resultado = simular_portfolio(params)

    for id_inst in ("lecer_1", "bono_idx_1", "pf_uva_1"):
        media_fav  = resultado["instrumentos"][id_inst]["patrimonio"]["favorable"]["media"][-1]
        media_desf = resultado["instrumentos"][id_inst]["patrimonio"]["desfavorable"]["media"][-1]
        assert media_desf > media_fav


def test_padding_letras(params):
    resultado = simular_portfolio(params)

    # lecap_1 vence en mes 2 (< T_meses=3) → V(3) debe ser igual a V(2) por padding
    media = resultado["instrumentos"]["lecap_1"]["patrimonio"]["global"]["media"]
    assert media[3] == pytest.approx(media[2])

# Tests de correctitud — ganancias

def test_ganancias_nominales_v0_es_cero(params):
    resultado = simular_portfolio(params)

    for inst in params["instrumentos"]:
        media_0 = resultado["instrumentos"][inst["id"]]["ganancias_nominales"]["global"]["media"][0]
        assert media_0 == pytest.approx(0.0)

    for sub_portfolio in ("portfolio_ars", "portfolio_usd"):
        media_0 = resultado[sub_portfolio]["ganancias_nominales"]["global"]["media"][0]
        assert media_0 == pytest.approx(0.0)


def test_ganancias_reales_v0_es_cero(params):
    # en t=0 factor_acum=1 → ganancia_real = V(0)/1 - monto = 0
    resultado = simular_portfolio(params)

    for inst in params["instrumentos"]:
        media_0 = resultado["instrumentos"][inst["id"]]["ganancias_reales"]["global"]["media"][0]
        assert media_0 == pytest.approx(0.0)

    for sub_portfolio in ("portfolio_ars", "portfolio_usd"):
        media_0 = resultado[sub_portfolio]["ganancias_reales"]["global"]["media"][0]
        assert media_0 == pytest.approx(0.0)


def test_ganancias_reales_menores_que_nominales_inflacion_positiva(params):
    # con inflación > 0, factor_acum > 1 → V/factor < V → ganancia_real < ganancia_nominal
    resultado = simular_portfolio(params)

    for id_inst in ("lecap_1", "lecer_1", "pf_trad_1", "pf_uva_1"):
        for escenario in ("favorable", "moderado", "desfavorable"):
            gan_nom  = resultado["instrumentos"][id_inst]["ganancias_nominales"][escenario]["media"][-1]
            gan_real = resultado["instrumentos"][id_inst]["ganancias_reales"][escenario]["media"][-1]
            assert gan_real < gan_nom

    for escenario in ("favorable", "moderado", "desfavorable"):
        gan_nom_p  = resultado["portfolio_ars"]["ganancias_nominales"][escenario]["media"][-1]
        gan_real_p = resultado["portfolio_ars"]["ganancias_reales"][escenario]["media"][-1]
        assert gan_real_p < gan_nom_p

# Tests de inflacion_acumulada 

def test_inflacion_acumulada_t0_es_uno(params):
    resultado = simular_portfolio(params)
    for escenario in ("global", "favorable", "moderado", "desfavorable"):
        serie = resultado["inflacion_acumulada"][escenario]["media"]
        assert serie[0] == pytest.approx(1.0)


def test_inflacion_acumulada_crece_con_escenario(params):
    resultado = simular_portfolio(params)
    media_fav  = resultado["inflacion_acumulada"]["favorable"]["media"][-1]
    media_desf = resultado["inflacion_acumulada"]["desfavorable"]["media"][-1]
    assert media_desf > media_fav

# Tests de vencimiento posterior al horizonte de simulación

def test_instrumentos_vencen_despues_del_horizonte_no_rompen(params_vence_despues):
    # Antes de truncar en el orquestador, esto rompía: shape mismatch (lecap/lecer/bono_tasa_fija)
    # o IndexError directo (bono_indexado, por indexar factor_cer_matrix fuera de sus T_meses+1 columnas).
    resultado = simular_portfolio(params_vence_despues)
    T = params_vence_despues["T_meses"]

    for inst in params_vence_despues["instrumentos"]:
        serie = resultado["instrumentos"][inst["id"]]["patrimonio"]["global"]["media"]
        assert len(serie) == T + 1


def test_truncado_no_llega_a_la_par(params_vence_despues):
    # Vencen en el mes 6 pero el horizonte es 3 → V(3) todavía no debe alcanzar el valor final
    # de vencimiento (ni haber quedado en el precio de compra).
    resultado = simular_portfolio(params_vence_despues)

    vn_lecap = 5000.0 * (1 + 0.50 * _MES_VENC_LARGO / 12)
    v3_lecap = resultado["instrumentos"]["lecap_largo"]["patrimonio"]["global"]["media"][-1]
    assert 5000.0 < v3_lecap < vn_lecap

    v3_bono = resultado["instrumentos"]["bono_fijo_largo"]["patrimonio"]["global"]["media"][-1]
    assert _MONTO_BONO_FIJO_LARGO < v3_bono < _FLUJO_BONO_FIJO_LARGO


def test_portfolio_mixto_vencimientos_distintos_agrega_sin_error(params_vence_despues):
    # lecap_corto vence en el mes 2 (< T=3), el resto vence en el mes 6 (> T=3) — deben poder
    # sumarse en el mismo portfolio_ars sin mismatch de shapes.
    resultado = simular_portfolio(params_vence_despues)
    T = params_vence_despues["T_meses"]

    media_portfolio = resultado["portfolio_ars"]["patrimonio"]["global"]["media"]
    assert len(media_portfolio) == T + 1

    suma_instrumentos = sum(
        resultado["instrumentos"][inst["id"]]["patrimonio"]["global"]["media"][-1]
        for inst in params_vence_despues["instrumentos"]
    )
    assert media_portfolio[-1] == pytest.approx(suma_instrumentos)
