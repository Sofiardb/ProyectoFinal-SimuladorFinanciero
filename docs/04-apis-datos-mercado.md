# APIs de datos de mercado

Este documento describe las fuentes de datos externas que consume el backend para construir los inputs del motor de simulación. Para cada instrumento se detalla qué API provee cada dato, el endpoint exacto, los campos relevantes y cómo se derivan los parámetros que el motor necesita.

| Instrumento | API | Datos obtenidos |
|---|---|---|
| Plazo fijo tradicional | — | Sin datos externos (el usuario ingresa la TNA) |
| Plazo fijo UVA | — | Sin datos externos (la inflación la genera el orquestador) |
| LECAP | BYMA Open Data + Docta Capital | BYMA: precio. Docta: TNA real |
| LECER | BYMA Open Data + Docta Capital | BYMA: precio. Docta: TIR real (spread sobre CER) |
| Bono tasa fija | ArgentinaDatos + Docta Capital | ArgentinaDatos: precio de cotización. Docta: catálogo, flujos de caja, TIR |
| Bono CER | ArgentinaDatos + Docta Capital | ArgentinaDatos: precio de cotización. Docta: catálogo, flujos base, TIR real |
| Acciones USA | Alpha Vantage | Histórico de precios ajustados → μ, σ, S₀, ρ |

## 1. BYMA Open Data — Letras del Tesoro

**URL base:** `https://open.bymadata.com.ar`
**Autenticación:** sesión implícita (cookie establecida en el primer GET a la home), sin credenciales explícitas.

El catálogo de letras se obtiene de un único endpoint:

```
POST /vanoms-be-core/rest/api/bymadata/free/lebacs

De la respuesta, el backend usa `symbol` como identificador, `settlementPrice` como precio de mercado (`closingPrice` siempre viene en 0, por lo que no es utilizable), `maturityDate` como fecha de vencimiento, `daysToMaturity` como referencia pre-calculada de días al vencimiento y `denominationCcy` para distinguir la moneda de denominación (`"ARS"`, `"USD"`, `"EXT"`). El backend filtra `denominationCcy == "ARS" AND settlementPrice > 0 AND symbol[0] in ('S', 'X')` antes de persistir.

El prefijo del ticker identifica el tipo de letra, según la convención que asigna la Secretaría de Finanzas en cada licitación publicada en [argentina.gob.ar](https://www.argentina.gob.ar/economia/finanzas):

| Prefijo | Tipo | Descripción |
|---|---|---|
| `S` | LECAP | Letra Capitalizable en Pesos a tasa fija |
| `X` | LECER | Letra ajustada por CER a descuento |
| `M` | LETAMAR | Letra a Tasa TAMAR |
| `D` | LELINK | Letra Vinculada al Dólar |

El simulador procesa únicamente LECAP (`S`) y LECER (`X`); el resto se ignora.

Ni la TNA de la LECAP ni el spread real de la LECER pueden derivarse del precio de BYMA por sí solo. Para la LECAP, al ser un instrumento capitalizable, su valor técnico crece por sobre 100 durante toda su vida — `settlementPrice > 100` es el caso normal, no una excepción cerca del vencimiento —, así que una fórmula de descuento ingenua invertiría el signo de la tasa; el backend en cambio consulta el endpoint de yields de Docta Capital (sección 3.3) y usa el campo `tna` directamente. Para la LECER, la TNA real (spread sobre CER) tampoco puede derivarse del precio sin conocer el factor CER diario del BCRA, así que el backend consulta el mismo endpoint de Docta y usa el campo `tir` como spread real. En ambos casos, si Docta no devuelve yield para un ticker, ese instrumento se omite del catálogo, porque la columna `tasa` en la base de datos es `NOT NULL`.

## 2. ArgentinaDatos — Precio de cotización de bonos del Tesoro

El precio de cotización del bono — el precio al que el usuario compra, input del motor — se obtiene de ArgentinaDatos, una API pública no oficial que agrega datos de mercado argentino (`https://argentinadatos.com`, sin autenticación). Docta Capital no provee precio de mercado directamente, solo TIR/TEA a partir de un precio objetivo (la dirección inversa; ver sección 3.3), y BYMA Open Data —usado para letras en la sección 1— no cotiza LECAP/BONTE/BONCER en sus endpoints gratuitos: `/lebacs` y `/public-bonds` cubren únicamente bonos soberanos reestructurados (AL/AE/AN/AO), deuda provincial/municipal y letras de corto plazo, ningún ticker de los que Docta lista como `FIXED_RATE`/`CER`. Esto se verificó cruzando ambos endpoints de BYMA contra el catálogo completo de Docta, con cero coincidencias — por eso el precio de bonos se toma de una fuente distinta a la de letras.

El endpoint `GET https://api.argentinadatos.com/v1/finanzas/letras` cubre, a pesar del nombre, LECAP y BONTE (tasa fija) — todo lo que Docta lista bajo `FIXED_RATE` —, con el precio en el campo `vpv` (valor por VN 100). El endpoint `GET https://api.argentinadatos.com/v1/finanzas/bonos-cer` cubre BONCER (ajustados por CER) — lo que Docta lista bajo `CER` —, con respuesta `{ bonos: [...] }` y precio en `precioArs` (también por VN 100). El backend arma un diccionario `{ ticker → precio }` combinando ambos endpoints y lo cruza contra el catálogo de Docta, que es la fuente de verdad de qué tickers existen, su TIR y sus flujos.

Docta se consulta primero por ser la fuente de verdad de qué instrumentos existen, y un bono solo queda `activo = TRUE` si aparece en ambas fuentes — Docta y ArgentinaDatos con precio. Si Docta deja de listar un ticker (venció, fue delisteado), o lo lista pero ArgentinaDatos no tiene precio para él, el bono se desactiva en el próximo refresh (`BonoRepository.DesactivarNoListadosAsync`), lo que evita instrumentos huérfanos con datos stale que ninguna fuente vuelve a tocar.

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

El token se reutiliza hasta 60 segundos antes de su expiración, y las credenciales se guardan en .NET User Secrets, nunca en `appsettings.json`. Todas las llamadas posteriores incluyen `Authorization: Bearer {access_token}`.

### 3.1 Catálogo de bonos disponibles

`GET /api/v1/bonds/instruments?sub_asset_class={tipo}&limit=100` devuelve el catálogo por tipo: `sub_asset_class=FIXED_RATE` para bono soberano tasa fija, `sub_asset_class=CER` para bono soberano ajustado por CER. De la respuesta se usan `ticker` como identificador del bono y `sub_asset_class` para confirmar el tipo del instrumento.

### 3.2 Flujos de caja

`GET /api/v1/bonds/analytics/{symbol}/cashflow?nominal_units=100` devuelve los flujos normalizados a $100 de valor nominal; el backend los almacena así en la tabla `flujo_bono`, y la escala a pesos reales (monto invertido / precio) ocurre recién en `SimulacionService` al construir el input del motor. De la respuesta se usa `payment_date` como fecha de pago del cupón en ambos tipos de bono; para bono tasa fija, `cash_flow` (flujo total, capital + interés) alimenta `monto_cupon`; para bono CER, `adj_capital` alimenta `monto_capital` y `adj_interest_amount` alimenta `monto_cupon`. La frecuencia de cupón (`frecuencia_cupon_meses`) se deduce del intervalo entre las primeras dos fechas de pago.

### 3.3 TIR y spread del instrumento

`GET /api/v1/bonds/yields/{symbol}/intraday` devuelve la estructura:

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

De ahí se usa `tir` (tasa interna de retorno) como `tasa_descuento` del bono en la base de datos, y `dtm` (días al vencimiento) como referencia para filtrar por horizonte `T`. Para bonos CER se asume que la `tir` devuelta es real, calculada sobre los flujos base ya ajustados por CER; para LECER (`X`), esa misma tasa se reutiliza como spread real (sección 1).

## 4. Alpha Vantage — Acciones estadounidenses y S&P 500

**URL base:** `https://www.alphavantage.co`
**Autenticación:** API key como query parameter (`&apikey={KEY}`), guardada en .NET User Secrets.

### 4.1 Histórico de precios ajustados (por acción)

`GET /query?function=TIME_SERIES_DAILY_ADJUSTED&symbol={TICKER}&outputsize=full&apikey={KEY}` devuelve hasta 20 años de datos diarios OHLCV ajustados por splits y dividendos:

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

Se usa el campo `5. adjusted close` — precio ajustado por splits y dividendos, correcto para calcular retornos logarítmicos. Alpha Vantage devuelve `"Note"` o `"Information"` en el JSON (con HTTP 200, sin marcar error) cuando se excede el rate limit; el backend detecta ambas claves y registra el warning correspondiente.

El motor trabaja con paso de tiempo mensual (21 días bursátiles); los parámetros GBM se calculan en escala diaria sobre los últimos 10 años de retornos logarítmicos y se escalan a mensual:

```python
retornos_log = np.diff(np.log(precios_ajustados))   # últimos 10 años

mu_diario    = retornos_log.mean()
sigma_diario = retornos_log.std()

mu_mensual    = mu_diario    * 21         # E[R] en 21 días
sigma_mensual = sigma_diario * sqrt(21)   # volatilidad en 21 días
```

Los tres parámetros (`mu_retorno_esperado`, `sigma_volatilidad`, `rho_correlacion_indice`) y `precio_actual` se almacenan en la tabla `accion`, con recálculo semanal vía `CatalogoRefreshJob` (cada 7 días) o manual vía `POST /admin/catalogo/refresh/acciones/{ticker}`.

### 4.2 Índice S&P 500 (benchmark para ρ)

El orquestador usa el S&P 500 para modelar el shock sistemático compartido por todas las acciones (`z_accion[t] = ρ × z_indice[t] + √(1 − ρ²) × z_propio[t]`, ver `docs/02-orquestador-montecarlo.md`). El backend usa el índice SPX real, no el ETF SPY, a través de `GET /query?function=INDEX_DATA&symbol=SPX&interval=daily&apikey={KEY}`:

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

Se usa el campo `close` — índice sin ajuste de dividendos, que es lo correcto para un índice de precio. `ρ` se calcula alineando por fecha los retornos logarítmicos de la acción y del SPX (no todos los días bursátiles coinciden entre ambas series) y tomando su coeficiente de correlación:

```python
retornos_accion = np.diff(np.log(precios_accion))
retornos_spx    = np.diff(np.log(precios_spx))

rho = np.corrcoef(retornos_accion_alineados, retornos_spx_alineados)[0, 1]
```

La serie SPX se cachea 24 horas en memoria para evitar una llamada a la API por cada ticker durante el recálculo semanal.

### 4.3 Universo de acciones disponibles

El catálogo de acciones es fijo: 50 instrumentos sembrados directamente en `db/01_schema.sql`, en la tabla `accion`. No se usa el endpoint `LISTING_STATUS` de Alpha Vantage para descubrir tickers dinámicamente.

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

## 5. Operación y mantenimiento

Cada dato de mercado se refresca a una frecuencia acorde a su volatilidad: los precios de letras (TNA LECAP, TIR LECER) y los yields de bonos (TIR) se actualizan cada 15 minutos en horario bursátil; los flujos de caja de bonos, cada 24 horas; y los parámetros GBM de acciones (μ, σ, ρ, S₀), cada 7 días — todo a través de `CatalogoRefreshJob`. Un refresco manual inmediato está disponible vía `POST /admin/catalogo/refresh/*` (requiere JWT). El horario bursátil considerado es de lunes a viernes, 11:00–17:00 ART (America/Argentina/Buenos_Aires); fuera de ese rango, `CatalogoRefreshJob` omite el ciclo.

Un instrumento sin precio no puede incluirse en un portfolio: para letras se filtra `settlementPrice > 0` en BYMA antes de persistir, y para bonos se filtra `vpv`/`precioArs > 0` en ArgentinaDatos, activando el ticker solo si Docta también lo lista (sección 2). La serie histórica del S&P 500 se mantiene en caché de memoria durante 24 horas, de modo que el recálculo semanal de los 50 tickers del catálogo solo necesita una llamada a la API por la serie SPX.

Las credenciales (`DoctaCapital:ClientId`, `DoctaCapital:ClientSecret`, `AlphaVantage:ApiKey`) se configuran exclusivamente vía .NET User Secrets:

```bash
dotnet user-secrets set "DoctaCapital:ClientId"     "<id>"
dotnet user-secrets set "DoctaCapital:ClientSecret"  "<secret>"
dotnet user-secrets set "AlphaVantage:ApiKey"        "<key>"
```
