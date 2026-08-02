# Referencia de endpoints — Backend API v1

**Base URL (desarrollo):** `http://localhost:5000`
**Base URL (producción):** `https://proyectofinal-simuladorfinanciero-1.onrender.com`
**Formato:** JSON en todos los requests y responses
**Documentación interactiva:** Swagger disponible en la raíz de cada base URL (`http://localhost:5000/` en desarrollo, `https://proyectofinal-simuladorfinanciero-1.onrender.com/` en producción)

---

## Convenciones generales

Los endpoints protegidos requieren el token JWT obtenido en `POST /auth/login` o `POST /auth/register`, enviado en el header `Authorization: Bearer <token>`.

Todos los errores siguen el formato Problem Details (RFC 7807), por ejemplo:

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

## 1. Salud del sistema

`GET /health`, público y sin autenticación, verifica que la API y la base de datos responden correctamente y devuelve `{ "estado": "ok", "db": "ok" }`. Este endpoint nunca expone detalle de errores internos en la respuesta (ver `docs/05-backend-arquitectura.md`), ya que el hosting lo consulta como chequeo de salud sin credenciales.

## 2. Autenticación

`POST /auth/register`, público, registra un nuevo usuario y devuelve el token JWT listo para usar. Recibe `email` (requerido, formato email), `username` (requerido), `password` (requerido, mínimo 8 caracteres) y opcionalmente `nombre` y `apellido`. Responde `201` con `{ token, expiresAt, email, username, nombre, esAdmin }`, o `400` si falla la validación y `409` si el email o username ya están registrados.

`POST /auth/login`, público, autentica con `identificador` (email o username) y `password`, y responde con el mismo formato que el registro (`200`), o `400`/`401` si faltan campos o las credenciales son incorrectas.

## 3. Datos de referencia

Los cuatro endpoints de esta sección requieren autenticación y devuelven catálogos de valores válidos para construir portfolios y simular, sin filtros ni parámetros. `GET /referencia/monedas` lista las monedas disponibles (`[{ idMoneda, codigoIso, nombre, simbolo }]`, por ejemplo ARS y USD). `GET /referencia/perfiles-riesgo` lista los perfiles de riesgo con su límite de volatilidad para acciones (`[{ idPerfilRiesgo, nombre, sigmaMaxAccion }]`). `GET /referencia/tipos-escenario` lista los tipos de escenario económico —favorable, moderado, desfavorable— como `[{ idTipoEscenario, nombre }]`. `GET /referencia/escenarios-economicos` lista los escenarios vigentes (aquellos con `vigente_hasta IS NULL`), con sus rangos de inflación: `[{ idEscenarioEconomico, idTipoEscenario, nombreEscenario, inflacionMensualMin, inflacionMensualMax }]`.

## 4. Catálogo de instrumentos

Estos endpoints, todos autenticados, devuelven los instrumentos disponibles para armar portfolios.

`GET /instrumentos/letras` lista las letras del Tesoro activas (LECAP y LECER): `[{ idLetra, codigo, tipo, tna, fechaVencimiento, settlPrice, activa }]`. `GET /instrumentos/letras/{id}` devuelve el detalle de una letra puntual, o `404` si no existe.

`GET /instrumentos/bonos` lista los bonos soberanos junto con sus flujos de caja: `[{ idBono, codigo, nombre, tipo, tir, fechaVencimiento, valida, flujos: [{ idFlujoBono, fechaPago, montoCupon, montoCapital }] }]`. `GET /instrumentos/bonos/{id}` devuelve el detalle de un bono con todos sus flujos, o `404`.

`GET /instrumentos/acciones` lista las acciones con sus parámetros GBM estimados: `[{ idAccion, ticker, nombre, sector, muRetornoEsperado, sigmaVolatilidad, rhoCorrelacionIndice, precioActual, activo }]`, donde `mu` y `sigma` son parámetros mensuales (no anualizados) y `rho` es la correlación histórica con el S&P 500. `GET /instrumentos/acciones/{id}` devuelve el detalle de una acción, o `404`.

`GET /instrumentos/tipos-plazo-fijo` lista los tipos de plazo fijo disponibles (Tradicional, UVA, etc.): `[{ idTipoPlazoFijo, nombre, entidad, caracteristica }]`.

## 5. Administración del catálogo

Todos los endpoints de esta sección requieren rol `Admin`. El job automático `CatalogoRefreshJob` ejecuta estos mismos refrescos una vez por día hábil a las 11:30 ART; estos endpoints permiten forzarlos manualmente.

`GET /admin/catalogo/check` verifica conectividad con BYMA Open Data y Docta Capital sin consumir cuota significativa, devolviendo `{ byma: { ok, detalle }, docta: { ok, detalle } }`.

`POST /admin/catalogo/refresh/letras` actualiza el catálogo de letras consultando BYMA Open Data y responde `{ insertadas, actualizadas, errores: [] }`. `POST /admin/catalogo/refresh/bonos/yields` actualiza las TIR de bonos consultando Docta Capital, y `POST /admin/catalogo/refresh/bonos/flujos` actualiza sus flujos de caja; ambos responden `{ actualizados, errores: [] }`.

`POST /admin/catalogo/refresh/acciones` recalcula los parámetros GBM (`mu`, `sigma`, `rho`) de todas las acciones usando Alpha Vantage, devolviendo un array `[{ ticker, ok, mu, sigma, rho, mesesDeDatos, error }]`; `mesesDeDatos` indica cuántos meses de historia real respaldaron el cálculo, y no se persiste en la base de datos porque cambia con cada refresh, solo se devuelve en este response. `POST /admin/catalogo/refresh/acciones/{ticker}` hace lo mismo para una acción puntual, devolviendo un único objeto `GbmRefreshResult` (`404` si el ticker no está en el catálogo).

## 6. Portfolios

Todos los endpoints de portfolios requieren autenticación, y el ownership está garantizado: solo se retornan o modifican portfolios del usuario autenticado, y acceder a uno ajeno devuelve `404` en lugar de `403`, para no revelar su existencia.

`GET /portfolios` lista todos los portfolios del usuario con su resumen, sin tenencias:

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

`GET /portfolios/{id}` devuelve el detalle completo de un portfolio, con la misma cabecera más las cuatro listas de tenencias (acciones, bonos, letras, plazos fijos), o `404`.

`POST /portfolios` crea un nuevo portfolio a partir de `nombre` (requerido, máximo 100 caracteres), `descripcion` (opcional, máximo 500), `idPerfilRiesgo` (requerido), `idMonedaBase` (requerido), `capitalInicial` (opcional) y `horizonteMeses` (requerido, entre 1 y 360). Responde `201` con el resumen creado, o `400`/`404` (perfil o moneda inexistente)/`409` (nombre duplicado para ese perfil).

`PUT /portfolios/{id}` hace una actualización parcial: acepta los mismos campos que la creación, todos opcionales — los que no se envían mantienen su valor actual — más `estado` (`"ACTIVO"` o `"ARCHIVADO"`). Cambiar `idPerfilRiesgo` valida que las acciones existentes no superen el nuevo `sigmaMaxAccion`; si alguna lo supera, responde `422` y el perfil no se actualiza. Responde `200` con el resumen actualizado, o `400`/`404`/`409`.

`DELETE /portfolios/{id}` elimina el portfolio y todas sus tenencias por cascada en la base de datos, respondiendo `204` sin cuerpo, o `404`.

### Tenencias

Las tenencias de acciones, bonos y letras comparten la misma forma: `POST /portfolios/{id}/{tipo}` agrega la posición con `id{Tipo}` (requerido), `cantidad` (requerido, positivo) y `precioCompra` (requerido, no negativo), y responde `201` con la tenencia creada. Como cada una de estas tres tablas tiene restricción de unicidad por instrumento (`docs/07-portfolio-reglas-negocio.md`), el mismo instrumento no puede agregarse dos veces al mismo portfolio: `409` si ya está, `422` si es una acción cuya `sigma` supera el límite del perfil de riesgo, `404` si el portfolio o el instrumento no existen. `PUT /portfolios/{id}/{tipo}/{idInstrumento}` actualiza `cantidad` y/o `precioCompra` (ambos opcionales) de una posición existente, y `DELETE /portfolios/{id}/{tipo}/{idInstrumento}` la elimina — ambos responden `404` si la posición no existe, y el `PUT` también puede responder `422` en el caso de una acción que deja de cumplir el límite de volatilidad. Los tres recursos son:

| Tenencia | Ruta base | Body de creación |
|---|---|---|
| Acciones | `/portfolios/{id}/acciones` | `{ idAccion, cantidad, precioCompra }` |
| Bonos | `/portfolios/{id}/bonos` | `{ idBono, cantidad, precioCompra }` |
| Letras | `/portfolios/{id}/letras` | `{ idLetra, cantidad, precioCompra }` |

Los plazos fijos son distintos: al no tener restricción de unicidad por tipo (se pueden tener varios contratos del mismo tipo en bancos o montos distintos), cada fila es un contrato independiente identificado por `idPortfolioPlazoFijo`, no por el tipo de instrumento. `POST /portfolios/{id}/plazos-fijos` agrega un nuevo contrato con `idTipoPlazoFijo` (requerido), `idMoneda` (requerido), `entidadFinanciera` (requerido, máximo 150 caracteres), `montoInvertido` (requerido, positivo), `tnaPactada` (requerido, no negativo, en decimal — 42% = 0.42), `fechaInicio` (requerido), `duracionDias` (requerido, mínimo 1) y `reinvertirAlVencimiento` (opcional, default `false`), respondiendo `201` o `400`/`404`. `PUT /portfolios/{id}/plazos-fijos/{idPortfolioPlazoFijo}` y `DELETE /portfolios/{id}/plazos-fijos/{idPortfolioPlazoFijo}` actualizan o eliminan el contrato — nótese que la URL usa el identificador de la fila de tenencia (`idPortfolioPlazoFijo`), no `idTipoPlazoFijo`.

## 7. Simulaciones

Todos los endpoints de simulaciones requieren autenticación, con el mismo aislamiento por usuario que los portfolios: no es posible acceder a simulaciones de otro usuario (`404`).

`GET /portfolios/{idPortfolio}/simular/preview` compara el estado del portfolio con los precios de mercado actuales e indica si la simulación puede ejecutarse, identificando instrumentos vencidos, sin precio o con parámetros GBM desactualizados:

```json
{
  "puedeSimular": true,
  "instrumentos": [
    { "tipo": "accion", "id": 1, "ticker": "AAPL", "estado": "ok", "detalle": null },
    {
      "tipo": "letra", "id": 2, "codigo": "S31E5", "estado": "vencida",
      "detalle": "Venció el 2026-01-31 — eliminarla del portfolio para poder simular."
    }
  ]
}
```

`POST /portfolios/{idPortfolio}/simular` ejecuta el motor de simulación Monte Carlo para el portfolio y persiste los resultados. Recibe `horizonteMeses` y `semilla`, ambos opcionales — si se omite el horizonte, usa el guardado en el portfolio; la semilla se genera automáticamente si no se envía, aunque el motor no la utiliza como input funcional (ver la sección sobre generación de aleatoriedad en `docs/02-orquestador-montecarlo.md`). Internamente, el endpoint carga el portfolio y sus tenencias, valida que haya instrumentos, que las acciones tengan GBM estimado y que no haya instrumentos vencidos, construye el payload del motor (`docs/08-integracion-motor.md`), llama a `POST /simular` sobre la URL del motor configurada (`http://localhost:5050` en desarrollo, `https://proyectofinal-simuladorfinanciero.onrender.com` en producción), persiste la cabecera, el snapshot de escenarios y los resultados estadísticos en PostgreSQL, y devuelve el resumen:

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

Responde `201` en éxito, `404` si el portfolio no existe, `422` si no hay instrumentos, hay acciones sin GBM, instrumentos vencidos o el horizonte no cubre los flujos de algún bono, y `502` si el motor no está disponible.

`GET /portfolios/{idPortfolio}/simulaciones` lista el historial de corridas del portfolio, ordenadas por fecha descendente, como un array de resúmenes con la misma forma que la respuesta de `POST .../simular`. `GET /simulaciones/{id}` devuelve la cabecera de una simulación puntual —fecha, horizonte, semilla y métricas agregadas, incluidos los parámetros de escenario del snapshot—, o `404`.

`GET /simulaciones/{id}/resultados` devuelve todos los resultados estadísticos (stats JSONB) de una simulación, opcionalmente filtrados por ámbito vía query param — `?ambito=portfolio_ars` o `?ambito=portfolio_usd` para un sub-portfolio, `?ambito=accion_1` para un instrumento puntual; sin filtro, devuelve todos los ámbitos. Cada fila tiene la forma:

```json
{
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
}
```

donde cada array tiene largo `T_meses + 1` y el índice 0 corresponde siempre a `t = 0`, el momento de la inversión. Responde `404` si la simulación no existe o no pertenece al usuario.

`DELETE /simulaciones/{id}` elimina una simulación y sus datos asociados (resultados y snapshot de instrumentos, por cascada), como acción explícita y separada de la ejecución. Responde `204` sin cuerpo, o `404`.
