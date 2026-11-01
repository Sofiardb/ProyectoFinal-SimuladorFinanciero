"""
Prueba prospectiva: simulaciones de control lanzadas hoy, comparadas con la realidad al vencer el horizonte.

Dos pasos, usando la API del backend (no toca la base de datos directamente):

  1) REGISTRAR (el día que se lanzan las simulaciones):
         python -m benchmarks.control_prospectivo registrar --simulaciones 101 102 103 104 105 106
     Guarda en benchmarks/control/registro.json, para cada simulación: cabecera (fecha, horizonte,
     semilla), todos los resultados estadísticos y la composición del portfolio con precios de compra.

  2) COMPARAR (en la fecha final: +2 meses o +3 meses):
         python -m benchmarks.control_prospectivo comparar
         python -m benchmarks.control_prospectivo comparar --inflacion 0.021 0.019 --uva 1650.2 1742.9
     Lee los precios actuales de cada tenencia desde la API (mismo catálogo que usa el sistema:
     Alpha Vantage, BYMA, Docta), calcula el valor real de cada instrumento y de cada sub-portfolio,
     y lo ubica dentro de la distribución simulada al mes final (mín, p25, mediana, p75, máx).
     Opcional: --precios archivo.csv  (columnas: ambito,precio) para pisar precios a mano.
               --inflacion  variaciones mensuales INDEC del período (decimal) -> escenario ocurrido.
               --uva INI FIN valor de la UVA al inicio y al final (para plazos fijos UVA).
     Salida: benchmarks/control/comparacion_<fecha>.csv y .md

Autenticación: variable de entorno INVESTLAB_TOKEN con el JWT, o se pide usuario y contraseña
por consola (la contraseña no se guarda). URL base: INVESTLAB_API (por defecto, producción).
"""
import argparse
import csv
import getpass
import json
import os
import sys
import urllib.error
import urllib.request
from datetime import date, datetime
from pathlib import Path

API = os.environ.get("INVESTLAB_API", "https://proyectofinal-simuladorfinanciero-1.onrender.com").rstrip("/")
CARPETA = Path(__file__).parent / "control"
REGISTRO = CARPETA / "registro.json"
_TOKEN = None


# ----------------------------------------------------------------------------- API
def _pedir(metodo, ruta, cuerpo=None, token=True):
    headers = {"Content-Type": "application/json", "Accept": "application/json"}
    if token:
        headers["Authorization"] = f"Bearer {obtener_token()}"
    data = json.dumps(cuerpo).encode() if cuerpo is not None else None
    req = urllib.request.Request(API + ruta, data=data, headers=headers, method=metodo)
    try:
        with urllib.request.urlopen(req, timeout=120) as r:   # Render gratuito puede tardar en despertar
            return json.loads(r.read().decode() or "null")
    except urllib.error.HTTPError as e:
        sys.exit(f"Error {e.code} en {metodo} {ruta}: {e.read().decode()[:400]}")


def obtener_token():
    global _TOKEN
    if _TOKEN:
        return _TOKEN
    _TOKEN = os.environ.get("INVESTLAB_TOKEN")
    if not _TOKEN:
        usuario = input("Usuario o email: ")
        clave = getpass.getpass("Contraseña: ")
        _TOKEN = _pedir("POST", "/auth/login", {"identificador": usuario, "password": clave}, token=False)["token"]
    return _TOKEN


def get(ruta):
    return _pedir("GET", ruta)


# ----------------------------------------------------------------------------- utilidades
def _k(d, *nombres, default=None):
    """Lee un campo aceptando camelCase o PascalCase."""
    for n in nombres:
        for v in (n, n[:1].upper() + n[1:]):
            if isinstance(d, dict) and v in d:
                return d[v]
    return default


def tenencias_por_ambito(portfolio):
    """ambito del motor -> {tipo, nombre, cantidad, precio_compra, precio_actual, moneda}"""
    out = {}
    for a in _k(portfolio, "acciones", default=[]):
        out[f"accion_{_k(a, 'idAccion')}"] = dict(tipo="accion", nombre=_k(a, "ticker"), moneda="USD",
            cantidad=float(_k(a, "cantidad")), precio_compra=float(_k(a, "precioCompra")),
            precio_actual=_k(a, "precioActual"))
    for l in _k(portfolio, "letras", default=[]):
        out[f"letra_{_k(l, 'idLetra')}"] = dict(tipo="letra", nombre=_k(l, "ticker"), moneda="ARS",
            cantidad=float(_k(l, "cantidad")), precio_compra=float(_k(l, "precioCompra")),
            precio_actual=_k(l, "precioActual"))
    for b in _k(portfolio, "bonos", default=[]):
        out[f"bono_{_k(b, 'idBono')}"] = dict(tipo="bono", nombre=_k(b, "ticker"), moneda="ARS",
            cantidad=float(_k(b, "cantidad")), precio_compra=float(_k(b, "precioCompra")),
            precio_actual=_k(b, "precioActual"))
    for p in _k(portfolio, "plazosFijos", default=[]):
        out[f"plazo_fijo_{_k(p, 'idPortfolioPlazoFijo')}"] = dict(
            tipo="plazo_fijo_uva" if "UVA" in str(_k(p, "nombreTipoPlazoFijo", default="")).upper() else "plazo_fijo",
            nombre=f"{_k(p, 'nombreTipoPlazoFijo')} {_k(p, 'entidadFinanciera')}",
            moneda=_k(p, "codigoMoneda", default="ARS"), cantidad=1.0,
            precio_compra=float(_k(p, "montoInvertido")), precio_actual=None)
    return out


def stats_finales(resultados, ambito, escenario="global", metrica="patrimonio"):
    for r in resultados:
        if _k(r, "ambito") == ambito and _k(r, "escenario") == escenario and _k(r, "metrica") == metrica:
            s = _k(r, "stats")
            s = json.loads(s) if isinstance(s, str) else s
            return {k: float(v[-1]) for k, v in s.items()}, {k: float(v[0]) for k, v in s.items()}
    return None, None


def ubicar(real, s):
    """Tramo y percentil aproximado (interpolación lineal entre mín, p25, mediana, p75 y máx)."""
    pts = [(s["minimo"], 0), (s["p25"], 25), (s["mediana"], 50), (s["p75"], 75), (s["maximo"], 100)]
    if real < pts[0][0]:
        return "debajo del mínimo", 0.0
    if real > pts[-1][0]:
        return "encima del máximo", 100.0
    nombres = ["mín–p25", "p25–mediana", "mediana–p75", "p75–máx"]
    for i in range(4):
        (x0, p0), (x1, p1) = pts[i], pts[i + 1]
        if x0 <= real <= x1:
            pct = p0 if x1 == x0 else p0 + (p1 - p0) * (real - x0) / (x1 - x0)
            return nombres[i], pct
    return "?", float("nan")


def escenario_ocurrido(inflacion, rangos):
    import math
    media = math.prod(1 + x for x in inflacion) ** (1 / len(inflacion)) - 1   # promedio geométrico mensual
    for nombre, (lo, hi) in rangos.items():
        if lo <= media < hi:
            return nombre, media
    return "fuera de rango", media


# ----------------------------------------------------------------------------- comandos
def registrar(ids):
    CARPETA.mkdir(exist_ok=True)
    reg = json.loads(REGISTRO.read_text()) if REGISTRO.exists() else {}
    for i in ids:
        cab = get(f"/simulaciones/{i}")
        res = get(f"/simulaciones/{i}/resultados")
        id_port = _k(cab, "idPortfolio")
        port = get(f"/portfolios/{id_port}")
        reg[str(i)] = {"registrado": datetime.now().isoformat(timespec="seconds"),
                       "cabecera": cab, "portfolio": port, "resultados": res}
        print(f"Simulación {i}: portfolio '{_k(port, 'nombre')}', horizonte {_k(cab, 'horizonteMeses')} meses, "
              f"{len(res)} filas de resultados, {len(tenencias_por_ambito(port))} tenencias.")
    REGISTRO.write_text(json.dumps(reg, indent=1, ensure_ascii=False, default=str))
    print(f"Guardado en {REGISTRO}")


def comparar(precios_csv=None, inflacion=None, uva=None):
    if not REGISTRO.exists():
        sys.exit("No hay registro. Primero: registrar --simulaciones ...")
    reg = json.loads(REGISTRO.read_text())
    manual = {}
    if precios_csv:
        with open(precios_csv, newline="", encoding="utf-8") as f:
            manual = {r["ambito"]: float(r["precio"]) for r in csv.DictReader(f)}
    rangos = {}
    try:
        tipos = {_k(t, "idTipoEscenario"): str(_k(t, "nombre")).lower() for t in get("/referencia/tipos-escenario")}
        for e in get("/referencia/escenarios-economicos"):
            rangos[tipos.get(_k(e, "idTipoEscenario"), "?")] = (float(_k(e, "inflacionMensualMin")), float(_k(e, "inflacionMensualMax")))
    except SystemExit:
        pass
    esc_real, infl_media = (escenario_ocurrido(inflacion, rangos) if inflacion and rangos else (None, None))

    filas = []
    for sid, r in reg.items():
        cab, port_ini, res = r["cabecera"], r["portfolio"], r["resultados"]
        horizonte = int(_k(cab, "horizonteMeses"))
        fecha_ini = str(_k(cab, "fechaEjecucion"))[:10]
        ini = tenencias_por_ambito(port_ini)
        ahora = tenencias_por_ambito(get(f"/portfolios/{_k(cab, 'idPortfolio')}"))
        totales = {"ARS": 0.0, "USD": 0.0}
        faltan = {"ARS": False, "USD": False}
        for amb, t in ini.items():
            s_fin, s_ini = stats_finales(res, amb)
            if s_fin is None:
                continue
            if amb in manual:
                real, fuente = t["cantidad"] * manual[amb], "manual"
            elif t["tipo"] == "plazo_fijo":
                real, fuente = s_fin["mediana"], "determinístico (contrato)"
            elif t["tipo"] == "plazo_fijo_uva" and uva:
                # V(T) = V(0) * UVA_fin/UVA_ini * (1 + tasa/12)^T  (misma fórmula que el motor)
                tasa = next((float(_k(p, "tnaPactada")) for p in _k(port_ini, "plazosFijos", default=[])
                             if amb == f"plazo_fijo_{_k(p, 'idPortfolioPlazoFijo')}"), 0.0)
                real, fuente = s_ini["mediana"] * uva[1] / uva[0] * (1 + tasa / 12) ** horizonte, "UVA informada"
            else:
                p = (ahora.get(amb) or {}).get("precio_actual")
                real, fuente = (t["cantidad"] * float(p), "API (precio actual)") if p is not None else (None, "sin precio")
            fila = {"simulacion": sid, "portfolio": _k(port_ini, "nombre"), "horizonte_meses": horizonte,
                    "fecha_inicio": fecha_ini, "ambito": amb, "instrumento": t["nombre"], "moneda": t["moneda"],
                    "valor_inicial": round(s_ini["mediana"], 2), "valor_real": None if real is None else round(real, 2),
                    "fuente_precio": fuente}
            fila.update({f"sim_{k}": round(v, 2) for k, v in s_fin.items() if k in ("minimo", "p25", "mediana", "p75", "maximo")})
            if real is not None:
                tramo, pct = ubicar(real, s_fin)
                fila.update(tramo=tramo, percentil_aprox=round(pct, 1),
                            error_mediana_pct=round(100 * (s_fin["mediana"] - real) / real, 2))
                totales[t["moneda"]] += real
            else:
                faltan[t["moneda"]] = True
            filas.append(fila)
        for moneda in ("ARS", "USD"):
            amb = f"portfolio_{moneda.lower()}"
            s_fin, s_ini = stats_finales(res, amb)
            if s_fin is None or s_ini["mediana"] == 0:
                continue
            real = None if faltan[moneda] else totales[moneda]
            fila = {"simulacion": sid, "portfolio": _k(port_ini, "nombre"), "horizonte_meses": horizonte,
                    "fecha_inicio": fecha_ini, "ambito": amb, "instrumento": f"TOTAL {moneda}", "moneda": moneda,
                    "valor_inicial": round(s_ini["mediana"], 2), "valor_real": None if real is None else round(real, 2),
                    "fuente_precio": "suma de tenencias" if real is not None else "falta algún precio"}
            fila.update({f"sim_{k}": round(v, 2) for k, v in s_fin.items() if k in ("minimo", "p25", "mediana", "p75", "maximo")})
            if real is not None:
                tramo, pct = ubicar(real, s_fin)
                fila.update(tramo=tramo, percentil_aprox=round(pct, 1),
                            error_mediana_pct=round(100 * (s_fin["mediana"] - real) / real, 2))
                if esc_real in ("favorable", "moderado", "desfavorable"):
                    s_esc, _ = stats_finales(res, amb, esc_real)
                    t2, p2 = ubicar(real, s_esc)
                    fila.update(escenario_ocurrido=esc_real, tramo_en_escenario=t2, percentil_en_escenario=round(p2, 1))
            filas.append(fila)

    hoy = date.today().isoformat()
    cols = ["simulacion", "portfolio", "horizonte_meses", "fecha_inicio", "ambito", "instrumento", "moneda",
            "valor_inicial", "valor_real", "fuente_precio", "sim_minimo", "sim_p25", "sim_mediana", "sim_p75",
            "sim_maximo", "tramo", "percentil_aprox", "error_mediana_pct", "escenario_ocurrido",
            "tramo_en_escenario", "percentil_en_escenario"]
    CARPETA.mkdir(exist_ok=True)
    with open(CARPETA / f"comparacion_{hoy}.csv", "w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=cols, extrasaction="ignore")
        w.writeheader()
        w.writerows(filas)

    lineas = [f"# Prueba prospectiva — comparación al {hoy}", ""]
    if esc_real:
        lineas += [f"Inflación mensual promedio del período (INDEC): {100 * infl_media:.2f}% → escenario **{esc_real}**.", ""]
    lineas += ["| Portfolio | Horizonte | Instrumento | Valor real | p25 | Mediana | p75 | Tramo | Percentil aprox. |",
               "|---|---|---|---|---|---|---|---|---|"]
    for f in filas:
        lineas.append(f"| {f['portfolio']} | {f['horizonte_meses']} m | {f['instrumento']} | {f.get('valor_real')} | "
                      f"{f.get('sim_p25')} | {f.get('sim_mediana')} | {f.get('sim_p75')} | {f.get('tramo', '-')} | {f.get('percentil_aprox', '-')} |")
    con_real = [f for f in filas if f.get("tramo")]
    if con_real:
        dentro_iqr = sum(f["tramo"] in ("p25–mediana", "mediana–p75") for f in con_real)
        dentro_rango = sum(f["tramo"] not in ("debajo del mínimo", "encima del máximo") for f in con_real)
        lineas += ["", f"Dentro de p25–p75: {dentro_iqr} de {len(con_real)} (esperado ~50%). "
                        f"Dentro de mínimo–máximo: {dentro_rango} de {len(con_real)}."]
    (CARPETA / f"comparacion_{hoy}.md").write_text("\n".join(lineas), encoding="utf-8")
    print("\n".join(lineas))
    for sid, r in reg.items():
        fin = _k(r["cabecera"], "fechaEjecucion")[:10]
        print(f"(simulación {sid}: lanzada {fin}, horizonte {_k(r['cabecera'], 'horizonteMeses')} meses)")
    print(f"\nArchivos: {CARPETA / f'comparacion_{hoy}.csv'} y .md")


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    sub = ap.add_subparsers(dest="cmd", required=True)
    a = sub.add_parser("registrar")
    a.add_argument("--simulaciones", nargs="+", type=int, required=True)
    b = sub.add_parser("comparar")
    b.add_argument("--precios")
    b.add_argument("--inflacion", nargs="+", type=float)
    b.add_argument("--uva", nargs=2, type=float, metavar=("UVA_INICIO", "UVA_FIN"))
    args = ap.parse_args()
    if args.cmd == "registrar":
        registrar(args.simulaciones)
    else:
        comparar(args.precios, args.inflacion, args.uva)


if __name__ == "__main__":
    main()
