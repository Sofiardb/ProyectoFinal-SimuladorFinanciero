# APIs de datos de mercado

Este documento describe las fuentes de datos externas que consume el backend para construir los inputs del motor de simulación. Para cada instrumento se detalla qué API provee cada dato, el endpoint exacto, los campos relevantes y cómo se derivan los parámetros que el motor necesita.

---

## Resumen por instrumento

| Instrumento | API | Datos obtenidos |
|---|---|---|
| Plazo fijo tradicional | — | Sin datos externos (el usuario ingresa la TNA) |
| Plazo fijo UVA | — | Sin datos externos (la inflación la genera el orquestador) |
| LECAP | BYMA Open Data | Precio, vencimiento → TNA derivada |
| LECER | BYMA Open Data + Docta Capital | BYMA: precio. Docta: TIR real (spread sobre CER) |
| Bono tasa fija | BYMA Open Data + Docta Capital | BYMA: precio de cotización. Docta: catálogo, flujos de caja, TIR |
| Bono CER | BYMA Open Data + Docta Capital | BYMA: precio de cotización. Docta: catálogo, flujos base, TIR real |
| Acciones USA | Alpha Vantage | Histórico de precios ajustados → μ, σ, S₀, ρ |

---

## 1. BYMA Open Data — Letras del Tesoro

**URL base:** `https://open.bymadata.com.ar`  
**Autenticación:** Sesión implícita (cookie establecida en el primer GET a la home). Sin credenciales explícitas.  
**Librería de referencia:** [PyOBD](https://github.com/franco-lamas/PyOBD) (Python, sin autenticación)

### Endpoint

```
POST /vanoms-be-core/rest/api/bymadata/free/lebacs

Body:
{
  "excludeZeroPxAndQty": false,
  "T2": false,
  "T1": true,
  "T0": false,
  "Content-Type": "application/json"
}
```

> **Nota sobre settlement:** Los datos con precio disponible están en `T1` (liquidación 24hs). `T2` devuelve array vacío durante la sesión bursátil.

### Campos relevantes

| Campo API | Tipo | Uso |
|---|---|---|
| `symbol` | string | Identificador del instrumento |
| `settlementPrice` | number | Precio de mercado (usar este; `closingPrice` siempre es 0) |
| `maturityDate` | string (YYYY-MM-DD) | Fecha de vencimiento |
| `daysToMaturity` | integer | Días al vencimiento (pre-calculado por BYMA) |
| `denominationCcy` | string | Moneda: `"ARS"` = pesos, `"USD"`, `"EXT"` |

### Filtros aplicados por el backend

```
denominationCcy == "ARS"
AND settlementPrice > 0
AND symbol[0] in ('S', 'X')
```

### Convención de nomenclatura de tickers

La Secretaría de Finanzas asigna el ticker en cada licitación publicada en [argentina.gob.ar](https://www.argentina.gob.ar/economia/finanzas). La primera letra identifica el tipo:

| Prefijo | Tipo | Descripción |
|---|---|---|
| `S` | LECAP | Letra Capitalizable en Pesos a tasa fija |
| `X` | LECER | Letra ajustada por CER a descuento |
| `M` | LETAMAR | Letra a Tasa TAMAR |
| `D` | LELINK | Letra Vinculada al Dólar |

El simulador procesa únicamente LECAP (`S`) y LECER (`X`). El resto se ignora.

### Derivación de parámetros del motor

**Para LECAP** — TNA derivada directamente del precio:

```
tna = (100 / settlementPrice - 1) × (365 / daysToMaturity)
```

**Para LECER** — la TNA real (spread sobre CER) no puede derivarse del precio de BYMA sin conocer el factor CER diario del BCRA. En su lugar, el backend consulta el endpoint de yields de Docta Capital (ver sección 3.3). Si Docta no devuelve yield para un ticker LECER, ese instrumento se omite del catálogo (la columna `tasa` en DB es NOT NULL).

---

## 2. BYMA Open Data — Precio de cotización de bonos soberanos

El precio de cotización del bono (precio al que el usuario compra, input del motor) se obtiene de BYMA. Docta Capital no provee precio de mercado directamente.

**Endpoint:**

```
POST /vanoms-be-core/rest/api/bymadata/free/public-bonds

Body:
{
  "excludeZeroPxAndQty": false,
  "T2": false,
  "T1": true,
  "T0": false,
  "Content-Type": "application/json"
}
```

**Campo de precio:** `settlementPrice` (mismo criterio que letras; el campo `closingPrice` es siempre 0).

**Uso:** el backend descarga el diccionario `{ ticker → settlementPrice }` de todos los bonos con precio > 0 y lo cruza con el catálogo de Docta para enriquecer cada bono con su precio actual.

---

## 3. Docta Capital — Bonos soberanos argentinos

**URL base:** `https://api.doctacapital.com.ar`  
**Documentación:** `https://docs.doctacapital.com.ar`  
**Autenticación:** OAuth 2.0 client credentials con cuerpo JSON (no form-encoded):

```
POST /api/v1/auth/token
Content-Type: application/json

{
  "grant_type": "client_credentials",
  "client_id": "<client_id>",
  "client_secret": "<client_secret>"
}

→ { "access_token": "...", "expires_in": 3600, ... }
```

El token se reutiliza hasta 60 segundos antes de su expiración. Credenciales guardadas en .NET User Secrets, nunca en `appsettings.json`.

Todas las llamadas posteriores incluyen:
```
Authorization: Bearer {access_token}
```

### 3.1 Catálogo de bonos disponibles

```
GET /api/v1/bonds/instruments?sub_asset_class={tipo}&limit=100
```

| `sub_asset_class` | Instrumento del simulador |
|---|---|
| `FIXED_RATE` | Bono soberano tasa fija |
| `CER` | Bono soberano ajustado por CER |

**Campos relevantes:**

| Campo | Uso |
|---|---|
| `ticker` | Identificador del bono |
| `sub_asset_class` | Confirma el tipo del instrumento |

### 3.2 Flujos de caja

```
GET /api/v1/bonds/analytics/{symbol}/cashflow?nominal_units=100
```

Los flujos vienen normalizados a $100 de valor nominal. El backend los almacena así en la tabla `flujo_bono`. La escala a pesos reales (monto invertido / precio) ocurre en `SimulacionService` al construir el input del motor.

**Campos relevantes:**

| Campo | Uso en bono tasa fija | Uso en bono CER |
|---|---|---|
| `payment_date` | Fecha de pago del cupón | Fecha de pago del cupón |
| `cash_flow` | Flujo total (capital + interés) → `monto_cupon` | — |
| `adj_capital` | — | Capital ajustado base → `monto_capital` |
| `adj_interest_amount` | — | Interés ajustado base → `monto_cupon` |

La frecuencia de cupón (`frecuencia_cupon_meses`) se deduce del intervalo entre las primeras dos fechas de pago.

### 3.3 TIR y spread del instrumento

```
GET /api/v1/bonds/yields/{symbol}/intraday
```

**Estructura de respuesta:**

```json
{
  "ticker": "AL30",
  "data": [
    {
      "tir": 0.09887,
      "tna": 0.11777,
      "dtm": 1663,
      "margen": null
    }
  ]
}
```

**Campos usados:**

| Campo | Uso |
|---|---|
| `tir` | Tasa interna de retorno → `tasa_descuento` del bono en DB |
| `dtm` | Días al vencimiento — referencia para filtrar por horizonte T |

> Para bonos CER, se asume que la `tir` devuelta es real (calculada sobre los flujos base ajustados por CER). Para LECER (`X`), esta misma tasa se usa como spread real.

---

## 4. Alpha Vantage — Acciones estadounidenses y S&P 500

**URL base:** `https://www.alphavantage.co`  
**Autenticación:** API key como query parameter (`&apikey={KEY}`). Guardada en .NET User Secrets.  
**Plan requerido:** Premium (el free tier limita a 25 requests por día, insuficiente para recalcular los 20 tickers semanalmente).

### 4.1 Histórico de precios ajustados (por acción)

```
GET /query
  ?function=TIME_SERIES_DAILY_ADJUSTED
  &symbol={TICKER}
  &outputsize=full
  &apikey={KEY}
```

Devuelve hasta 20 años de datos diarios OHLCV ajustados por splits y dividendos.

**Estructura de respuesta:**

```json
{
  "Meta Data": { "2. Symbol": "AAPL", ... },
  "Time Series (Daily)": {
    "2026-06-26": {
      "1. open": "...",
      "5. adjusted close": "198.45",
      ...
    }
  }
}
```

**Campo usado:** `5. adjusted close` — precio ajustado por splits y dividendos. Correcto para retornos logarítmicos.

> Alpha Vantage devuelve `"Note"` o `"Information"` en el JSON (con HTTP 200) cuando se excede el rate limit. El backend detecta ambas claves y registra el warning.

**Cálculo de parámetros GBM:**

El motor trabaja con paso de tiempo mensual (21 días bursátiles). Los parámetros se calculan en escala diaria y se escalan a mensual:

```python
retornos_log = np.diff(np.log(precios_ajustados))   # últimos 10 años

mu_diario    = retornos_log.mean()
sigma_diario = retornos_log.std()

mu_mensual    = mu_diario    * 21         # E[R] en 21 días
sigma_mensual = sigma_diario * sqrt(21)   # volatilidad en 21 días
```

Los tres parámetros (`mu_retorno_esperado`, `sigma_volatilidad`, `rho_correlacion_indice`) y `precio_actual` se almacenan en la tabla `accion`.

**Frecuencia de recálculo:** semanal, via `CatalogoRefreshJob` (7 días) o manualmente vía `POST /admin/catalogo/refresh/acciones/{ticker}`.

### 4.2 Índice S&P 500 (benchmark para ρ)

El orquestador usa el S&P 500 para modelar el shock sistemático compartido por todas las acciones:

```
z_accion[t] = ρ × z_indice[t] + √(1 − ρ²) × z_propio[t]
```

El backend usa el índice SPX real (no el ETF SPY) a través del endpoint `INDEX_DATA`:

```
GET /query
  ?function=INDEX_DATA
  &symbol=SPX
  &interval=daily
  &apikey={KEY}
```

**Estructura de respuesta:**

```json
{
  "symbol": "SPX",
  "interval": "daily",
  "data": [
    { "date": "2026-06-26", "open": "...", "high": "...", "low": "...", "close": "7354.02" },
    ...
  ]
}
```

**Campo usado:** `close` (índice sin ajuste de dividendos, correcto para un índice de precio).

**Cálculo de ρ:**

```python
retornos_accion = np.diff(np.log(precios_accion))
retornos_spx    = np.diff(np.log(precios_spx))

# Alinear por fecha antes de calcular correlación (no todos los días coinciden)
rho = np.corrcoef(retornos_accion_alineados, retornos_spx_alineados)[0, 1]
```

La serie SPX se cachea 24 horas en memoria para evitar una llamada a la API por cada ticker durante el recálculo semanal.

### 4.3 Universo de acciones disponibles

El catálogo de acciones es fijo: 50 instrumentos sembrados directamente en `db/01_schema.sql` en la tabla `accion`. No se usa el endpoint `LISTING_STATUS`.

| Ticker | Empresa | Sector |
|---|---|---|
| AAPL | Apple Inc. | Tecnología |
| MSFT | Microsoft Corporation | Tecnología / Cloud |
| NVDA | NVIDIA Corporation | Semiconductores |
| AMD | Advanced Micro Devices, Inc. | Semiconductores |
| AVGO | Broadcom Inc. | Semiconductores |
| QCOM | Qualcomm Incorporated | Semiconductores |
| INTC | Intel Corporation | Semiconductores |
| MU | Micron Technology, Inc. | Memorias |
| AMZN | Amazon.com, Inc. | E-commerce / Cloud |
| GOOGL | Alphabet Inc. (Class A) | Internet |
| META | Meta Platforms, Inc. | Redes sociales |
| NFLX | Netflix, Inc. | Streaming |
| SPOT | Spotify Technology S.A. | Streaming de música |
| UBER | Uber Technologies, Inc. | Transporte |
| ABNB | Airbnb, Inc. | Turismo |
| TSLA | Tesla, Inc. | Automotriz |
| RIVN | Rivian Automotive, Inc. | Vehículos eléctricos |
| F | Ford Motor Company | Automotriz |
| GM | General Motors Company | Automotriz |
| JPM | JPMorgan Chase & Co. | Banca |
| GS | Goldman Sachs Group, Inc. | Banca de inversión |
| BAC | Bank of America Corporation | Banca |
| C | Citigroup Inc. | Banca |
| V | Visa Inc. | Medios de pago |
| MA | Mastercard Incorporated | Medios de pago |
| PYPL | PayPal Holdings, Inc. | Fintech |
| COIN | Coinbase Global, Inc. | Cripto |
| BRK.B | Berkshire Hathaway Inc. (Class B) | Holding |
| JNJ | Johnson & Johnson | Salud |
| PFE | Pfizer Inc. | Farmacéutica |
| MRK | Merck & Co., Inc. | Farmacéutica |
| LLY | Eli Lilly and Company | Farmacéutica |
| ABBV | AbbVie Inc. | Biotecnología |
| UNH | UnitedHealth Group Incorporated | Salud |
| XOM | Exxon Mobil Corporation | Energía |
| CVX | Chevron Corporation | Energía |
| SLB | SLB (Schlumberger Limited) | Servicios petroleros |
| COP | ConocoPhillips | Energía |
| CAT | Caterpillar Inc. | Maquinaria |
| BA | Boeing Company | Aeroespacial |
| GE | GE Aerospace | Aeroespacial |
| DE | Deere & Company | Maquinaria agrícola |
| LMT | Lockheed Martin Corporation | Defensa |
| RTX | RTX Corporation | Defensa |
| NKE | NIKE, Inc. | Consumo |
| WMT | Walmart Inc. | Retail |
| COST | Costco Wholesale Corporation | Retail |
| KO | Coca-Cola Company | Bebidas |
| PEP | PepsiCo, Inc. | Alimentos y bebidas |
| DIS | The Walt Disney Company | Entretenimiento |

---

## Notas de implementación

**Frecuencias de actualización:**

| Dato | Frecuencia | Mecanismo |
|---|---|---|
| Precios de letras (TNA LECAP, TIR LECER) | Cada 15 min en horario bursátil | `CatalogoRefreshJob` |
| Yields de bonos (TIR) | Cada 15 min en horario bursátil | `CatalogoRefreshJob` |
| Flujos de caja de bonos | Cada 24 h | `CatalogoRefreshJob` |
| Parámetros GBM de acciones (μ, σ, ρ, S₀) | Cada 7 días | `CatalogoRefreshJob` |
| Refresco manual | Inmediato | `POST /admin/catalogo/refresh/*` (requiere JWT) |

**Horario bursátil:** lunes a viernes, 11:00–17:00 ART (America/Argentina/Buenos_Aires). Fuera de este rango, `CatalogoRefreshJob` omite el ciclo.

**Instrumentos sin precio:** se filtra `settlementPrice > 0` en BYMA antes de persistir. Un instrumento sin precio no puede incluirse en un portfolio.

**Caché de SPX:** la serie histórica del índice S&P 500 se mantiene en memoria durante 24 horas. Durante el recálculo semanal (20 tickers), solo se hace una llamada a la API por la serie SPX.

**Credenciales:** `DoctaCapital:ClientId`, `DoctaCapital:ClientSecret` y `AlphaVantage:ApiKey` se configuran exclusivamente vía .NET User Secrets:

```bash
dotnet user-secrets set "DoctaCapital:ClientId"     "<id>"
dotnet user-secrets set "DoctaCapital:ClientSecret"  "<secret>"
dotnet user-secrets set "AlphaVantage:ApiKey"        "<key>"
```
