"""
Descarga series diarias de precios ajustados de Alpha Vantage para el backtesting reciente.

Usa el mismo endpoint que el backend (TIME_SERIES_DAILY_ADJUSTED, "5. adjusted close") y la misma
API key: la toma de la variable de entorno ALPHAVANTAGE_API_KEY o, si no está definida, de
backend/SimuladorFinanciero.Api/appsettings.Development.json o appsettings.json (clave AlphaVantage:ApiKey).
La key nunca se imprime ni se guarda en los archivos descargados.

Uso (desde motor-simulacion/, con conexión a internet):
    python -m benchmarks.descargar_series                  # IBM, KO y NVDA
    python -m benchmarks.descargar_series AAPL JNJ         # otros tickers

Salida: benchmarks/datos/<ticker>_diario_ajustado.json
El plan gratuito de Alpha Vantage admite 5 consultas por minuto: el script espera 15 s entre tickers.
"""
import json
import os
import re
import sys
import time
import urllib.request
from pathlib import Path

DATOS = Path(__file__).parent / "datos"
RAIZ = Path(__file__).resolve().parents[2]
TICKERS_POR_DEFECTO = ["IBM", "KO", "NVDA"]


def api_key():
    k = os.environ.get("ALPHAVANTAGE_API_KEY")
    if k:
        return k
    for nombre in ("appsettings.Development.json", "appsettings.json"):
        p = RAIZ / "backend" / "SimuladorFinanciero.Api" / nombre
        if p.exists():
            texto = p.read_text(encoding="utf-8-sig")
            m = re.search(r'"AlphaVantage"\s*:\s*\{[^}]*?"ApiKey"\s*:\s*"([^"]+)"', texto, re.S)
            if m and m.group(1).strip():
                return m.group(1).strip()
    sys.exit("No se encontró la API key: definir ALPHAVANTAGE_API_KEY o AlphaVantage:ApiKey en appsettings.")


def descargar(ticker, key):
    url = ("https://www.alphavantage.co/query?function=TIME_SERIES_DAILY_ADJUSTED"
           f"&symbol={ticker}&outputsize=full&apikey={key}")
    with urllib.request.urlopen(url, timeout=120) as r:
        d = json.loads(r.read().decode("utf-8"))
    serie = d.get("Time Series (Daily)")
    if not serie:
        aviso = d.get("Note") or d.get("Information") or d.get("Error Message") or str(d)[:200]
        raise RuntimeError(f"{ticker}: Alpha Vantage no devolvió la serie ({aviso})")
    precios = {f: float(v["5. adjusted close"]) for f, v in serie.items()}
    return {"ticker": ticker, "fuente": "Alpha Vantage TIME_SERIES_DAILY_ADJUSTED (5. adjusted close)",
            "descargado": time.strftime("%Y-%m-%d"), "precios": dict(sorted(precios.items()))}


def main():
    tickers = [t.upper() for t in sys.argv[1:]] or TICKERS_POR_DEFECTO
    key = api_key()
    DATOS.mkdir(exist_ok=True)
    for i, t in enumerate(tickers):
        if i:
            time.sleep(15)
        d = descargar(t, key)
        f = DATOS / f"{t.lower()}_diario_ajustado.json"
        f.write_text(json.dumps(d))
        fechas = list(d["precios"])
        print(f"{t}: {len(fechas)} ruedas, {fechas[0]} a {fechas[-1]} -> {f.name}")


if __name__ == "__main__":
    main()
