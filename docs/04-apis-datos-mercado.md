# APIs de datos de mercado

Este documento resume de dónde sale cada dato de mercado que usa el simulador y para qué se usa.

| Instrumento | Fuente del precio | Fuente de la tasa / catálogo |
|---|---|---|
| Plazo fijo tradicional | — (lo ingresa el usuario) | — |
| Plazo fijo UVA | — | — (la inflación la genera el orquestador) |
| LECAP | data912 (`/live/arg_notes`) | BYMA Open Data (catálogo, vencimiento) + Docta Capital (TNA) |
| LECER | data912 (`/live/arg_notes`) | BYMA Open Data (catálogo, vencimiento) + Docta Capital (TIR, como spread real) |
| Bono del Tesoro (tasa fija o CER) | data912 (`/live/arg_bonds`) | Docta Capital (catálogo, flujos, TIR) |
| Bono provincial/municipal | BYMA Open Data (`/public-bonds`) | Docta Capital (catálogo, flujos, TIR) |
| Acciones USA | Alpha Vantage | Alpha Vantage (histórico → μ, σ, ρ) |

## 1. BYMA Open Data

**URL base:** `https://open.bymadata.com.ar` — acceso público, sin credenciales.

Es la fuente del **catálogo** de letras del Tesoro (LECAP y LECER, identificadas por el prefijo `S`/`X` del ticker, con su fecha de vencimiento) — data912 no expone vencimiento, así que BYMA sigue siendo necesario para saber qué letras existen y cuándo vencen, aunque el precio ahora salga de data912 (sección 2). El simulador ignora otros tipos de letra que BYMA lista (LETAMAR, LELINK).

También es la fuente del **precio** de bonos provinciales y municipales ("subsoberanos"): BYMA no distingue el emisor en la respuesta, así que qué tickers son subsoberanos lo determina el catálogo de Docta (sección 3), no BYMA.

BYMA no da ninguna tasa — sus precios solo alcanzan como precio de mercado; la TNA/TIR real siempre viene de Docta.

## 2. data912

**URL base:** `https://data912.com` — API pública no oficial, sin autenticación.

Es la fuente del **precio** de los bonos y letras del Tesoro nacional (`/live/arg_bonds` y `/live/arg_notes` respectivamente) — instrumentos que ni BYMA ni Docta cotizan directamente (Docta solo da tasas, nunca precio de mercado). data912 separa bonos y letras en dos endpoints distintos, cada uno con solo un tipo de instrumento, así que no hace falta excluir nada del resultado para evitar que un ticker de letra termine clasificado como bono.

## 3. Docta Capital — bonos y letras argentinas

**URL base:** `https://api.doctacapital.com.ar` · **Auth:** OAuth2 client credentials (credenciales en User Secrets, nunca en `appsettings.json`).

Es la **fuente de verdad de qué instrumentos existen** y provee:

- **Catálogo**: qué tickers están vigentes, agrupados por tipo (tasa fija, CER, subsoberano por tipo de tasa). Un instrumento solo queda activo en el simulador si Docta lo lista y además hay precio disponible en la fuente que corresponda (sección 1 o 2).
- **TIR / TNA**: la tasa real de cada instrumento — para bonos es `tasa_descuento`; para LECAP la TNA; para LECER, la TIR reutilizada como spread real.
- **Flujos de caja**: el cronograma de cupones de cada bono (fecha, capital, interés), usado tal cual como input del motor.

## 4. Alpha Vantage — acciones y S&P 500

**URL base:** `https://www.alphavantage.co` · **Auth:** API key (User Secrets).

Provee el **histórico de precios ajustados** (por splits/dividendos) de cada acción del catálogo y del índice S&P 500. De ahí se calculan los parámetros que el motor GBM necesita: retorno esperado (μ), volatilidad (σ), correlación con el índice (ρ) y precio actual (S₀).

El catálogo de acciones es fijo — 50 tickers sembrados en `db/01_schema.sql`, no se descubren dinámicamente:

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

`CatalogoRefreshJob` refresca todo automáticamente, a una frecuencia acorde a la volatilidad de cada dato: precios de letras y TIR/TNA de bonos cada 15 minutos en horario bursátil (lunes a viernes, 11:00–17:00 ART), flujos de caja de bonos cada 24 horas, y parámetros GBM de acciones cada 7 días. También se puede disparar un refresco manual vía `POST /admin/catalogo/refresh/*` (requiere rol Admin).

Un instrumento sin precio en su fuente correspondiente no se activa en el catálogo.
