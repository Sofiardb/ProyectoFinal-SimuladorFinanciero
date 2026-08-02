# Integración con el motor de simulación

Este documento describe el flujo completo del endpoint `POST /portfolios/{id}/simular`: cómo el backend construye el payload para el motor Python, cómo maneja la semilla, cómo persiste los resultados y qué métricas agrega para la cabecera de la simulación.

---

## 1. Flujo completo de ejecución

```
POST /portfolios/{id}/simular
│
├── [1] Cargar cabecera del portfolio (ownership check)
│
├── [2] Cargar tenencias + escenarios vigentes (en paralelo)
│
├── [3] Validaciones previas a la llamada al motor
│       ├── Portfolio no vacío
│       ├── Todas las acciones tienen GBM (mu, sigma, rho)
│       └── No hay instrumentos vencidos
│
├── [4] Construir payload del motor (MotorPayloadBuilder.Build)
│
├── [5] POST {MotorSimulacion:BaseUrl}/simular
│       │     (http://localhost:5050 en desarrollo, https://proyectofinal-simuladorfinanciero.onrender.com en producción)
│       └── Error no 2xx → ExternalApiException → 502 Bad Gateway
│
├── [6] Extraer métricas agregadas del response
│
├── [7] Persistir en transacción única
│       ├── INSERT simulacion (cabecera + métricas)
│       ├── INSERT simulacion_parametro_escenario (snapshot por escenario)
│       ├── INSERT simulacion_instrumento (snapshot por instrumento)
│       └── INSERT resultado_simulacion (stats JSONB por ámbito × escenario × métrica)
│
└── [8] Retornar SimulacionResumenResponse (201 Created)
```

## 2. Construcción del payload

`MotorPayloadBuilder`, una clase interna estática de `SimulacionService.cs`, recibe las tenencias del portfolio y los escenarios vigentes, y produce el JSON que el motor Python espera en `POST /simular`:

```json
{
  "T_meses": 12,
  "semilla":  987654321,
  "escenarios": {
    "favorable":    { "inflacion_mensual_min": 0.01,  "inflacion_mensual_max": 0.025 },
    "moderado":     { "inflacion_mensual_min": 0.025, "inflacion_mensual_max": 0.05  },
    "desfavorable": { "inflacion_mensual_min": 0.05,  "inflacion_mensual_max": 0.10  }
  },
  "instrumentos": [ ... ]
}
```

Los escenarios se obtienen de la tabla `escenario_economico`, solo los vigentes (`vigente_hasta IS NULL`), con el nombre convertido a minúsculas (`e.Codigo.ToLowerInvariant()`). Cada elemento de `instrumentos` se arma según el tipo de tenencia:

Una acción (`tipo = "accion"`) se serializa como `{ "id": "accion_{idAccion}", "tipo": "accion", "monto", "mu", "sigma", "rho" }`, donde `monto` es `cantidad × precioCompra` (el precio de compra ingresado por el usuario, no el precio de mercado actual) y `mu`/`sigma`/`rho` son los parámetros GBM mensuales del catálogo, estimados por `AccionCatalogoService`.

Una letra del Tesoro (`tipo = "lecap"` o `"lecer"`) se serializa como `{ "id": "letra_{idLetra}", "tipo", "monto", "tna", "t_venc_meses" }`, con `monto = cantidad × precioCompra`, `tna` como la tasa nominal anual en decimal del catálogo, y `t_venc_meses` calculado como `(año_venc - año_hoy) × 12 + (mes_venc - mes_hoy)`.

Un bono a tasa fija (`tipo = "bono_tasa_fija"`) se serializa como `{ "id": "bono_{idBono}", "tipo", "monto", "flujos": [{ "mes", "monto" }, ...], "tir" }`, donde `flujos` incluye solo los flujos futuros (`fecha_pago > hoy`) convertidos a `mes` relativo desde hoy, con `monto = monto_cupon + monto_capital`, y `tir` es la tasa interna de retorno del catálogo (campo `tasa_descuento`). Un bono indexado CER (`tipo = "bono_indexado"`) sigue la misma lógica pero con `flujos_base: [{ "mes", "capital_adj", "interest_adj" }, ...]` — capital e interés separados en vez de sumados — y `tir_real` en lugar de `tir`, la TIR real del catálogo sobre los flujos base, antes del ajuste CER.

Un plazo fijo tradicional (`tipo = "plazo_fijo_tradicional"`) se serializa como `{ "id": "plazo_fijo_{idPortfolioPlazoFijo}", "tipo", "monto", "tna", "t_venc_meses", "reinvertir" }`, con `monto = monto_invertido`, `tna = tna_pactada` y `reinvertir = reinvertir_al_vencimiento` de la tenencia; `t_venc_meses` se calcula como `MesesEntre(fecha_inicio, fecha_inicio.AddDays(duracion_dias))`, ya que la duración se persiste en días y se convierte a meses únicamente para este payload. Un plazo fijo UVA (`tipo = "plazo_fijo_uva"`) tiene la misma forma pero con `tasa_real_anual` en lugar de `tna`; el backend detecta que un plazo fijo es UVA por el campo `tipo_codigo = "UVA"` de la tabla `tipo_plazo_fijo`.

## 3. Manejo de la semilla

```csharp
var semilla = req.Semilla ?? new Random().NextInt64(1, long.MaxValue);
```

Si el request incluye `"semilla"`, el backend usa ese valor; si no, genera uno aleatorio en el rango `[1, long.MaxValue)` y lo incluye en el payload enviado al motor. Sin embargo, el motor no lee ese campo del payload en ningún caso: siempre genera su propia semilla internamente y la devuelve en el response (ver la sección sobre generación de aleatoriedad en `docs/02-orquestador-montecarlo.md`). El backend persiste la semilla que el motor devolvió — no la que generó antes de llamarlo —, así que el valor guardado en `simulacion.seed_aleatoria` sí corresponde exactamente a la secuencia de números aleatorios que produjo esa corrida, aunque no haya sido el backend quien la eligió.

En consecuencia, la semilla almacenada funciona como registro de auditoría — permite saber con qué secuencia aleatoria se generó cada simulación —, pero no como mecanismo de reproducibilidad: el motor no ofrece hoy una forma de recibir una semilla y regenerar exactamente las mismas trayectorias a partir de ella. La reproducibilidad de las métricas mostradas al usuario se logra por una vía distinta — persistir las estadísticas completas en `resultado_simulacion` (sección 6) y leerlas directamente en cada visualización, sin reinvocar al motor —, no por resembrar el generador aleatorio.

## 4. Validaciones que bloquean la simulación

El servicio realiza estas validaciones antes de llamar al motor:

| Condición | Error |
|---|---|
| Portfolio sin instrumentos | `422` — "El portfolio no tiene instrumentos para simular." |
| Acciones con `mu`, `sigma` o `rho` null | `422` — "Las siguientes acciones no tienen parámetros GBM estimados: TSLA. Ejecute el refresh..." |
| Letra con `fecha_vencimiento <= hoy` | `422` — "Los siguientes instrumentos están vencidos y bloquean la simulación: [letra_3]." |
| Bono cuyos flujos futuros terminaron | `422` — igual que letra |
| Plazo fijo vencido sin reinversión | `422` — igual que letra |
| Menos de 3 escenarios vigentes configurados | `422` — "No hay escenarios económicos vigentes configurados." |

## 5. Métricas agregadas de la cabecera

Después de recibir el response del motor, el servicio extrae métricas resumen para la cabecera de la simulación, todas tomando el último valor (mes `T`) de las estadísticas globales del portfolio. `valor_inicial` es la suma de todos los `monto` calculados durante la construcción del payload (`Σ monto` de cada instrumento). `valor_esperado` (y su desglose `valor_esperado_usd`) suma la media global de ambos sub-portfolios en `t=T` — `portfolio_ars.patrimonio.global.media[T] + portfolio_usd.patrimonio.global.media[T]`, donde el término USD es cero si no hay instrumentos en esa moneda —, y `valor_minimo`/`valor_maximo` se calculan igual pero leyendo los campos `minimo`/`maximo` del response en lugar de `media`.

`retorno_esperado_pct` es `(valor_esperado - valor_inicial) / valor_inicial` (guardado como `null` si `valor_inicial = 0`), y mide el retorno nominal esperado. `rendimiento_real_pct` es `(portfolio_ars.ganancias_reales.global.media[T] + portfolio_usd.ganancias_reales.global.media[T]) / valor_inicial`, y mide si el portfolio preservó o no el poder adquisitivo: un valor negativo indica pérdida real aunque haya ganancia nominal.

## 6. Persistencia en transacción

La escritura a base de datos se realiza en una única transacción, de modo que si cualquier `INSERT` falla, ninguno se persiste. La tabla `simulacion` recibe una fila por ejecución, con los metadatos y las métricas agregadas de la sección 5. `simulacion_parametro_escenario` recibe una fila por escenario (tres por simulación), registrando los rangos de inflación exactos que el motor usó en esa corrida, tomados de `escenario_economico` en el momento de la ejecución — necesario porque esos rangos pueden cambiar con el tiempo, y el snapshot garantiza que el historial de simulaciones siga siendo reproducible aunque los escenarios vigentes cambien después. `simulacion_instrumento` recibe una fila por instrumento del portfolio en el momento de la simulación, con el JSON del payload enviado al motor, lo que permite reconstruir exactamente qué parámetros se usaron.

`resultado_simulacion` recibe una fila por combinación de ámbito, escenario y métrica. Para un portfolio con cinco instrumentos, por ejemplo, hay 7 ámbitos (`portfolio_ars`, `portfolio_usd` y los cinco instrumentos individuales), 4 escenarios (`global`, `favorable`, `moderado`, `desfavorable`) y 3 métricas (`patrimonio`, `ganancias_nominales`, `ganancias_reales`) — 7 × 4 × 3 = 84 filas por simulación. Cada fila contiene el campo `stats` en JSONB con los seis vectores de estadísticas (media, mediana, p25, p75, mínimo, máximo), cada uno de largo `T_meses + 1`, y el índice `(id_simulacion, ambito)` permite al frontend recuperar los resultados de un instrumento específico eficientemente.

## 7. Ejemplo de payload completo

Para un portfolio de tres instrumentos (una acción AAPL, un bono AL30 y un plazo fijo tradicional), el payload enviado al motor tiene la forma:

```json
{
  "T_meses": 12,
  "semilla": 42,
  "escenarios": {
    "favorable":    { "inflacion_mensual_min": 0.01,  "inflacion_mensual_max": 0.025 },
    "moderado":     { "inflacion_mensual_min": 0.025, "inflacion_mensual_max": 0.05  },
    "desfavorable": { "inflacion_mensual_min": 0.05,  "inflacion_mensual_max": 0.10  }
  },
  "instrumentos": [
    {
      "id": "accion_1", "tipo": "accion",
      "monto": 1852.50, "mu": 0.015, "sigma": 0.062, "rho": 0.72
    },
    {
      "id": "bono_2", "tipo": "bono_tasa_fija",
      "monto": 4800.00,
      "flujos": [{ "mes": 6, "monto": 92.5 }, { "mes": 12, "monto": 1092.5 }],
      "tir": 0.12
    },
    {
      "id": "plazo_fijo_7", "tipo": "plazo_fijo_tradicional",
      "monto": 50000.00, "tna": 0.42, "t_venc_meses": 6, "reinvertir": false
    }
  ]
}
```

y produce, en `resultado_simulacion`, 3 ámbitos por instrumento × 4 escenarios × 3 métricas = 36 filas, más `portfolio_ars` y `portfolio_usd` (8 filas adicionales), 44 filas en total para esta simulación.
