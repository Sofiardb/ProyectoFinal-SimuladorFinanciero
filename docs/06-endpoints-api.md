# Referencia de endpoints — Backend API v1

**Base URL (desarrollo):** `http://localhost:5000`  
**Formato:** JSON en todos los requests y responses  
**Documentación interactiva:** Swagger disponible en `http://localhost:5000/`

---

## Convenciones generales

### Autenticación

Los endpoints protegidos requieren el token JWT en el header:
```
Authorization: Bearer <token>
```

El token se obtiene en `POST /auth/login` o `POST /auth/register`.

### Errores

Todos los errores siguen el formato **Problem Details** (RFC 7807):

```json
{
  "status": 422,
  "title": "Error de validación",
  "detail": "La volatilidad (sigma) de la acción TSLA (0.65) supera el límite del perfil de riesgo seleccionado (0.50)."
}
```

| Status | Significado |
|---|---|
| 400 | Validación de formato fallida (campo requerido, formato de email, etc.) |
| 401 | Token ausente o inválido |
| 403 | Token válido pero sin el rol requerido |
| 404 | Recurso no encontrado (o no pertenece al usuario autenticado) |
| 409 | Conflicto con estado existente (email duplicado, instrumento ya en portfolio) |
| 422 | Error de regla de negocio (sigma excede perfil, instrumento vencido, etc.) |
| 502 | Motor de simulación no disponible |
| 500 | Error interno inesperado |

---

## 1. Salud del sistema

### `GET /health`
**Auth:** No requerida

**Response 200:**
```json
{ "estado": "ok", "db": "ok" }
```

---

## 2. Autenticación

### `POST /auth/register`
**Auth:** No requerida  
Registra un nuevo usuario y devuelve el token JWT listo para usar.

**Request body:**
```json
{
  "email":    "sofia@ejemplo.com",   // requerido, formato email
  "username": "sofia",               // requerido
  "password": "mi_clave_segura",     // requerido, mínimo 8 caracteres
  "nombre":   "Sofía",               // opcional
  "apellido": "Rodríguez"            // opcional
}
```

**Response 201:**
```json
{
  "token":     "eyJhbGciOiJIUzI1NiIs...",
  "expiresAt": "2026-07-11T14:00:00Z",
  "email":     "sofia@ejemplo.com",
  "username":  "sofia",
  "nombre":    "Sofía",
  "esAdmin":   false
}
```

**Errores:** `400` (validación), `409` (email o username ya registrado)

---

### `POST /auth/login`
**Auth:** No requerida  
Autentica al usuario con nombre de usuario/email y contraseña.

**Request body:**
```json
{
  "identificador":    "sofia@ejemplo.com",
  "password": "mi_clave_segura"
}
```

**Response 200:** igual a `POST /auth/register`

**Errores:** `400` (campos requeridos), `401` (credenciales incorrectas)

---

## 3. Datos de referencia

Todos los endpoints de esta sección requieren autenticación (`[Authorize]`). Devuelven los catálogos de valores válidos para construir portfolios y simular.

### `GET /referencia/monedas`
Lista las monedas disponibles (ARS, USD).

**Response 200:** `[{ "idMoneda": 1, "codigoIso": "ARS", "nombre": "Peso argentino", "simbolo": "$" }, ...]`

---

### `GET /referencia/perfiles-riesgo`
Lista los perfiles de riesgo disponibles con su límite de volatilidad para acciones.

**Response 200:** `[{ "idPerfilRiesgo": 1, "nombre": "conservador", "sigmaMaxAccion": 0.20 }, ...]`

---

### `GET /referencia/tipos-escenario`
Lista los tipos de escenario económico (favorable, moderado, desfavorable).

**Response 200:** `[{ "idTipoEscenario": 1, "nombre": "favorable" }, ...]`

---

### `GET /referencia/escenarios-economicos`
Lista los escenarios económicos **vigentes** (aquellos donde `vigente_hasta IS NULL`).

**Response 200:**
```json
[{
  "idEscenarioEconomico": 1,
  "idTipoEscenario": 1,
  "nombreEscenario": "favorable",
  "inflacionMensualMin": 0.01,
  "inflacionMensualMax": 0.025
}, ...]
```

---

## 4. Catálogo de instrumentos

Todos requieren autenticación. Devuelven los instrumentos disponibles para armar portfolios.

### `GET /instrumentos/letras`
Lista las letras del Tesoro activas (LECAP y LECER).

**Response 200:**
```json
[{
  "idLetra": 1,
  "codigo": "S31E5",
  "tipo": "lecap",
  "tna": 0.45,
  "fechaVencimiento": "2025-01-31",
  "settlPrice": 92.50,
  "activa": true
}, ...]
```

---

### `GET /instrumentos/letras/{id}`
Detalle de una letra por ID.

**Errores:** `404` (no encontrada)

---

### `GET /instrumentos/bonos`
Lista los bonos soberanos con sus flujos de caja.

**Response 200:**
```json
[{
  "idBono": 1,
  "codigo": "AL30",
  "nombre": "BONARES 2030",
  "tipo": "bono_tasa_fija",
  "tir": 0.12,
  "fechaVencimiento": "2030-07-09",
  "valida": true,
  "flujos": [
    { "idFlujoBono": 1, "fechaPago": "2025-07-09", "montoCupon": 18.5, "montoCapital": 0 },
    ...
  ]
}, ...]
```

---

### `GET /instrumentos/bonos/{id}`
Detalle de un bono con todos sus flujos.

**Errores:** `404`

---

### `GET /instrumentos/acciones`
Lista las acciones con sus parámetros GBM estimados.

**Response 200:**
```json
[{
  "idAccion": 1,
  "ticker": "AAPL",
  "nombre": "Apple Inc.",
  "sector": "Technology",
  "muRetornoEsperado": 0.015,
  "sigmaVolatilidad": 0.062,
  "rhoCorrelacionIndice": 0.72,
  "precioActual": 185.50,
  "activo": true
}, ...]
```

`mu` y `sigma` son parámetros mensuales (no anualizados). `rho` es la correlación histórica con el S&P 500.

---

### `GET /instrumentos/acciones/{id}`
Detalle de una acción por ID.

**Errores:** `404`

---

### `GET /instrumentos/tipos-plazo-fijo`
Lista los tipos de plazo fijo disponibles (Tradicional, UVA, etc.).

**Response 200:** `[{ "idTipoPlazoFijo": 1, "nombre": "Plazo fijo tradicional", "entidad": null, "caracteristica": "TRADICIONAL" }, ...]`

---

## 5. Administración del catálogo

Todos requieren rol `Admin`. El job automático `CatalogoRefreshJob` ejecuta estos mismos refrescos una vez por día hábil a las 11:30 ART; estos endpoints permiten forzarlos manualmente.

### `GET /admin/catalogo/check`
Verifica conectividad con BYMA Open Data y Docta Capital sin consumir cuota significativa.

**Response 200:**
```json
{
  "byma":  { "ok": true,  "detalle": "Sesión establecida correctamente." },
  "docta": { "ok": true,  "detalle": "Token obtenido correctamente." }
}
```

---

### `POST /admin/catalogo/refresh/letras`
Actualiza el catálogo de letras (LECAP y LECER) consultando BYMA Open Data.

**Response 200:** `{ "insertadas": 3, "actualizadas": 2, "errores": [] }`

---

### `POST /admin/catalogo/refresh/bonos/yields`
Actualiza las TIR de bonos consultando Docta Capital.

**Response 200:** `{ "actualizados": 5, "errores": [] }`

---

### `POST /admin/catalogo/refresh/bonos/flujos`
Actualiza los flujos de caja de bonos consultando Docta Capital.

**Response 200:** `{ "actualizados": 5, "errores": [] }`

---

### `POST /admin/catalogo/refresh/acciones`
Recalcula parámetros GBM (mu, sigma, rho) para todas las acciones usando Alpha Vantage.

**Response 200:**
```json
[{
  "ticker": "AAPL",
  "ok": true,
  "mu": 0.015,
  "sigma": 0.062,
  "rho": 0.72,
  "mesesDeDatos": 120,
  "error": null
}, ...]
```

> `mesesDeDatos` indica cuántos meses de historia real respaldaron el cálculo. No se persiste en la base de datos porque cambia con cada refresh; se devuelve solo en este response.

---

### `POST /admin/catalogo/refresh/acciones/{ticker}`
Recalcula GBM para una acción específica.

**Response 200:** un objeto `GbmRefreshResult` (igual que el elemento del array del endpoint anterior).

**Errores:** `404` (ticker no encontrado en el catálogo)

---

## 6. Portfolios

Todos requieren autenticación. El ownership está garantizado: solo se retornan o modifican portfolios del usuario autenticado. Acceder a un portfolio ajeno devuelve `404`.

### `GET /portfolios`
Lista todos los portfolios del usuario con resumen (sin tenencias).

**Response 200:** array de `PortfolioResumenResponse`
```json
[{
  "idPortfolio": 1,
  "nombre": "Mi primer portfolio",
  "descripcion": null,
  "idPerfilRiesgo": 2,
  "nombrePerfilRiesgo": "moderado",
  "idMonedaBase": 1,
  "codigoMonedaBase": "ARS",
  "capitalInicial": 100000.00,
  "horizonteMeses": 12,
  "fechaCreacion": "2026-06-01T10:00:00Z",
  "fechaModificacion": "2026-06-15T14:30:00Z",
  "estado": "ACTIVO"
}, ...]
```

---

### `GET /portfolios/{id}`
Detalle completo de un portfolio con todas sus tenencias (acciones, bonos, letras, plazos fijos).

**Response 200:** `PortfolioDetalleResponse` — incluye las mismas cabecera que el resumen más las cuatro listas de tenencias.

**Errores:** `404`

---

### `POST /portfolios`
Crea un nuevo portfolio.

**Request body:**
```json
{
  "nombre":        "Mi portfolio",     // requerido, máximo 100 caracteres
  "descripcion":   "Descripción",      // opcional, máximo 500 caracteres
  "idPerfilRiesgo": 2,                 // requerido
  "idMonedaBase":   1,                 // requerido
  "capitalInicial": 100000.00,         // opcional
  "horizonteMeses": 12                 // requerido, entre 1 y 360
}
```

**Response 201:** `PortfolioResumenResponse`

**Errores:** `400`, `404` (perfil/moneda no existe), `409` (nombre duplicado para ese perfil)

---

### `PUT /portfolios/{id}`
Actualización parcial. Solo se modifican los campos enviados (los campos no enviados mantienen su valor actual).

**Request body:** mismos campos que `POST /portfolios` pero todos opcionales. Agrega:
```json
{
  "estado": "ARCHIVADO"   // "ACTIVO" o "ARCHIVADO"
}
```

Cambiar el `idPerfilRiesgo` valida que las acciones existentes no superen el nuevo `sigmaMaxAccion`.

**Response 200:** `PortfolioResumenResponse` actualizado

**Errores:** `400`, `404`, `409`, `422` (acciones incompatibles con el nuevo perfil)

---

### `DELETE /portfolios/{id}`
Elimina el portfolio y todas sus tenencias (CASCADE en DB).

**Response 204:** sin cuerpo

**Errores:** `404`

---

### Tenencias de acciones

#### `POST /portfolios/{id}/acciones`
Agrega una acción al portfolio. Una acción puede aparecer una sola vez por portfolio (restricción UNIQUE).

**Request body:**
```json
{
  "idAccion":    1,          // requerido
  "cantidad":    10.5,       // requerido, positivo
  "precioCompra": 185.50     // requerido, no negativo
}
```

**Response 201:** `PortfolioAccionResponse`

**Errores:** `400`, `404` (portfolio o acción no existe), `409` (acción ya en el portfolio), `422` (sigma de la acción supera el límite del perfil de riesgo)

---

#### `PUT /portfolios/{id}/acciones/{idAccion}`
Actualiza cantidad y/o precio de compra de una posición existente.

**Request body:** `ActualizarAccionRequest` — `cantidad` y `precioCompra` opcionales.

**Response 200:** `PortfolioAccionResponse`

**Errores:** `400`, `404`, `422`

---

#### `DELETE /portfolios/{id}/acciones/{idAccion}`
Elimina la posición en la acción del portfolio.

**Response 204**

**Errores:** `404`

---

### Tenencias de bonos

#### `POST /portfolios/{id}/bonos`
Agrega un bono al portfolio. Un bono puede aparecer una sola vez por portfolio.

**Request body:**
```json
{
  "idBono":    1,
  "cantidad":  5.0,
  "precioCompra": 980.00
}
```

**Response 201:** `PortfolioBonoResponse`

**Errores:** `400`, `404`, `409`, `422`

---

#### `PUT /portfolios/{id}/bonos/{idBono}`

**Response 200:** `PortfolioBonoResponse`

---

#### `DELETE /portfolios/{id}/bonos/{idBono}`

**Response 204**

---

### Tenencias de letras

#### `POST /portfolios/{id}/letras`
Agrega una letra del Tesoro al portfolio. Una letra puede aparecer una sola vez por portfolio.

**Request body:**
```json
{
  "idLetra":    1,
  "cantidad":   3.0,
  "precioCompra": 92.50
}
```

**Response 201:** `PortfolioLetraResponse`

**Errores:** `400`, `404`, `409`, `422`

---

#### `PUT /portfolios/{id}/letras/{idLetra}`

**Response 200:** `PortfolioLetraResponse`

---

#### `DELETE /portfolios/{id}/letras/{idLetra}`

**Response 204**

---

### Tenencias de plazos fijos

A diferencia de acciones, bonos y letras, **no hay unicidad** por tipo de plazo fijo. Se pueden agregar múltiples contratos del mismo tipo (por ejemplo, dos plazos fijos tradicionales en distintos bancos). Cada fila es un contrato independiente y se identifica por `idPortfolioPlazoFijo`.

#### `POST /portfolios/{id}/plazos-fijos`
Agrega un nuevo contrato de plazo fijo al portfolio.

**Request body:**
```json
{
  "idTipoPlazoFijo":      1,             // requerido
  "idMoneda":             1,             // requerido
  "entidadFinanciera":    "Banco Galicia", // requerido, máximo 150 caracteres
  "montoInvertido":       50000.00,      // requerido, positivo
  "tnaPactada":           0.42,          // requerido, no negativo (decimal: 42% = 0.42)
  "fechaInicio":          "2026-06-01",  // requerido
  "duracionMeses":        6,             // requerido, mínimo 1
  "reinvertirAlVencimiento": false       // opcional, default false
}
```

**Response 201:** `PortfolioPlazoFijoResponse`

**Errores:** `400`, `404`

---

#### `PUT /portfolios/{id}/plazos-fijos/{idPortfolioPlazoFijo}`

**Response 200:** `PortfolioPlazoFijoResponse`

> La URL usa `idPortfolioPlazoFijo` (identificador de la fila de tenencia), no `idTipoPlazoFijo`.

---

#### `DELETE /portfolios/{id}/plazos-fijos/{idPortfolioPlazoFijo}`

**Response 204**

---

## 7. Simulaciones

Todos requieren autenticación. El ownership está garantizado: no es posible acceder a simulaciones de otro usuario (devuelve `404`).

### `GET /portfolios/{idPortfolio}/simular/preview`
Compara el estado del portfolio con los precios de mercado actuales e indica si la simulación puede ejecutarse. Identifica instrumentos vencidos, sin precio o con parámetros GBM desactualizados.

**Response 200:** `SimulacionPreviewResponse`
```json
{
  "puedeSimular": true,
  "instrumentos": [
    {
      "tipo": "accion",
      "id": 1,
      "ticker": "AAPL",
      "estado": "ok",
      "detalle": null
    },
    {
      "tipo": "letra",
      "id": 2,
      "codigo": "S31E5",
      "estado": "vencida",
      "detalle": "Venció el 2026-01-31 — eliminarla del portfolio para poder simular."
    }
  ]
}
```

**Errores:** `404` (portfolio no encontrado)

---

### `POST /portfolios/{idPortfolio}/simular`
Ejecuta el motor de simulación Monte Carlo para el portfolio indicado y persiste los resultados.

**Request body (ambos campos opcionales):**
```json
{
  "horizonteMeses": 12,   // si se omite, usa el horizonte guardado en el portfolio
  "semilla": 42           // si se omite, se genera automáticamente (garantiza reproducibilidad si se persiste)
}
```

**Flujo interno:**
1. Carga el portfolio y sus tenencias.
2. Valida que haya instrumentos, que las acciones tengan GBM, y que no haya instrumentos vencidos.
3. Construye el payload del motor (ver [`docs/08-integracion-motor.md`](08-integracion-motor.md)).
4. Llama a `POST http://localhost:5050/simular`.
5. Persiste la cabecera, snapshot de escenarios y resultados estadísticos en PostgreSQL.
6. Devuelve el resumen de la simulación.

**Response 201:** `SimulacionResumenResponse`
```json
{
  "idSimulacion":       42,
  "idPortfolio":        1,
  "fechaEjecucion":     "2026-07-04T18:00:00Z",
  "horizonteMeses":     12,
  "numTrayectorias":    1000,
  "seedAleatoria":      987654321,
  "valorInicial":       100000.00,
  "valorEsperado":      115230.50,
  "valorMinimo":        72100.00,
  "valorMaximo":        182400.00,
  "retornoEsperadoPct": 0.1523,
  "rendimientoRealPct": -0.0312,
  "desvioEstandar":     null,
  "observaciones":      null
}
```

**Errores:** `404` (portfolio no encontrado), `422` (sin instrumentos, acciones sin GBM, instrumentos vencidos, horizonte no cubre flujos de bonos), `502` (motor no disponible)

---

### `GET /portfolios/{idPortfolio}/simulaciones`
Lista el historial de corridas del portfolio, ordenadas por fecha descendente.

**Response 200:** array de `SimulacionResumenResponse`

---

### `GET /simulaciones/{id}`
Cabecera de una simulación: fecha, horizonte, semilla y métricas agregadas.

**Response 200:** `SimulacionDetalleResponse` (incluye los parámetros de escenario del snapshot)

**Errores:** `404`

---

### `GET /simulaciones/{id}/resultados`
Devuelve todos los resultados estadísticos (stats JSONB) de una simulación. Acepta filtrado por ámbito.

**Query params:**
- `?ambito=portfolio_ars` — solo el sub-portfolio ARS
- `?ambito=portfolio_usd` — solo el sub-portfolio USD
- `?ambito=accion_1` — solo el instrumento con ese ID de ámbito

Sin filtro, devuelve todos los ámbitos (portfolio_ars, portfolio_usd y todos los instrumentos individuales).

**Response 200:**
```json
[{
  "idResultado": 1,
  "idSimulacion": 42,
  "ambito": "portfolio_ars",
  "escenario": "global",
  "metrica": "patrimonio",
  "stats": {
    "media":   [100000, 101200, 102500, ...],
    "mediana": [100000, 101000, 102000, ...],
    "p25":     [100000, 99500,  98800,  ...],
    "p75":     [100000, 102800, 105600, ...],
    "minimo":  [100000, 90000,  82000,  ...],
    "maximo":  [100000, 115000, 132000, ...]
  }
}, ...]
```

Cada array tiene largo `T_meses + 1`. El índice 0 es siempre `t = 0` (el momento de la inversión).

**Errores:** `404`
