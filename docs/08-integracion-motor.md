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
│       ├── No hay instrumentos vencidos
│       └── El horizonte cubre los flujos de todos los bonos
│
├── [4] Construir payload del motor (MotorPayloadBuilder.Build)
│
├── [5] POST http://localhost:5050/simular
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

---

## 2. Construcción del payload (MotorPayloadBuilder)

`MotorPayloadBuilder` es una clase interna estática en `SimulacionService.cs`. Recibe las tenencias del portfolio y los escenarios vigentes, y produce el JSON que el motor Python espera en su endpoint `POST /simular`.

### Estructura del payload

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

Los escenarios se obtienen de la tabla `escenario_economico` (solo los vigentes: `vigente_hasta IS NULL`). El nombre del escenario se convierte a minúsculas (`e.Codigo.ToLowerInvariant()`).

### Mapeo de instrumentos por tipo

#### Acciones (`tipo = "accion"`)

```json
{
  "id":    "accion_1",
  "tipo":  "accion",
  "monto": 1952.25,
  "mu":    0.015,
  "sigma": 0.062,
  "rho":   0.72
}
```

- `id`: `"accion_{idAccion}"`
- `monto`: `cantidad × precioCompra` (precio de compra ingresado por el usuario)
- `mu`, `sigma`, `rho`: parámetros GBM mensuales del catálogo (estimados por `AccionCatalogoService`)

---

#### Letras del Tesoro (`tipo = "lecap"` o `"lecer"`)

```json
{
  "id":           "letra_3",
  "tipo":         "lecap",
  "monto":        92.50,
  "tna":          0.45,
  "t_venc_meses": 6
}
```

- `id`: `"letra_{idLetra}"`
- `monto`: `cantidad × precioCompra`
- `tna`: tasa nominal anual en decimal del catálogo
- `t_venc_meses`: meses hasta el vencimiento calculados como `(año_venc - año_hoy) × 12 + (mes_venc - mes_hoy)`

---

#### Bonos tasa fija (`tipo = "bono_tasa_fija"`)

```json
{
  "id":     "bono_2",
  "tipo":   "bono_tasa_fija",
  "monto":  4900.00,
  "flujos": [
    { "mes": 3, "monto": 92.50 },
    { "mes": 6, "monto": 92.50 },
    { "mes": 9, "monto": 1092.50 }
  ],
  "tir": 0.12
}
```

- `id`: `"bono_{idBono}"`
- `monto`: `cantidad × precioCompra`
- `flujos`: solo los flujos **futuros** (`fecha_pago > hoy`), convertidos a `mes` relativo desde hoy; `monto` = `monto_cupon + monto_capital`
- `tir`: tasa interna de retorno del catálogo (campo `tasa_descuento`)

---

#### Bonos indexados CER (`tipo = "bono_indexado"`)

```json
{
  "id":          "bono_5",
  "tipo":        "bono_indexado",
  "monto":       4900.00,
  "flujos_base": [
    { "mes": 6,  "capital_adj": 250.00, "interest_adj": 30.00 },
    { "mes": 12, "capital_adj": 750.00, "interest_adj": 28.50 }
  ],
  "tir_real": 0.05
}
```

- `flujos_base`: flujos futuros del catálogo, con `capital_adj` y `interest_adj` separados
- `tir_real`: TIR real del catálogo (sobre los flujos base, antes de ajuste CER)

---

#### Plazos fijos tradicionales (`tipo = "plazo_fijo_tradicional"`)

```json
{
  "id":           "plazo_fijo_7",
  "tipo":         "plazo_fijo_tradicional",
  "monto":        50000.00,
  "tna":          0.42,
  "t_venc_meses": 6,
  "reinvertir":   false
}
```

- `id`: `"plazo_fijo_{idPortfolioPlazoFijo}"`
- `monto`: `monto_invertido` de la tenencia
- `tna`: `tna_pactada` de la tenencia
- `t_venc_meses`: calculado como `MesesEntre(fecha_inicio, fecha_inicio.AddDays(duracion_dias))` (la duración se persiste en días; se convierte a meses únicamente para el payload del motor)
- `reinvertir`: `reinvertir_al_vencimiento` de la tenencia

---

#### Plazos fijos UVA (`tipo = "plazo_fijo_uva"`)

```json
{
  "id":              "plazo_fijo_8",
  "tipo":            "plazo_fijo_uva",
  "monto":           50000.00,
  "tasa_real_anual": 0.01,
  "t_venc_meses":    6,
  "reinvertir":      true
}
```

La diferencia con el plazo fijo tradicional es `tasa_real_anual` en lugar de `tna`. El backend detecta que es UVA por el campo `tipo_codigo = "UVA"` de la tabla `tipo_plazo_fijo`.

---

## 3. Manejo de la semilla

```csharp
var semilla = req.Semilla ?? new Random().NextInt64(1, long.MaxValue);
```

Si el request incluye `"semilla"`, se usa ese valor. Si no, se genera uno aleatorio en el rango `[1, long.MaxValue)`.

La semilla generada se envía en el payload al motor. El motor la usa para inicializar su RNG determinístico y la devuelve en el response. El backend persiste la semilla devuelta por el motor (no la generada antes de llamar) para garantizar que el valor almacenado corresponde exactamente a la secuencia de números aleatorios usada.

**Reproducibilidad:** la semilla almacenada en `simulacion.seed_aleatoria` junto a los parámetros de escenario del snapshot (`simulacion_parametro_escenario`) permiten replicar los resultados llamando al motor con `"semilla": <seed>` y los mismos parámetros de inflación.

---

## 4. Validaciones que bloquean la simulación

El servicio realiza estas validaciones antes de llamar al motor:

| Condición | Error |
|---|---|
| Portfolio sin instrumentos | `422` — "El portfolio no tiene instrumentos para simular." |
| Acciones con `mu`, `sigma` o `rho` null | `422` — "Las siguientes acciones no tienen parámetros GBM estimados: TSLA. Ejecute el refresh..." |
| Letra con `fecha_vencimiento <= hoy` | `422` — "Los siguientes instrumentos están vencidos y bloquean la simulación: [letra_3]." |
| Bono cuyos flujos futuros terminaron | `422` — igual que letra |
| Plazo fijo vencido sin reinversión | `422` — igual que letra |
| Horizonte < máximo mes de flujo de algún bono | `422` — "El horizonte (X meses) no cubre todos los flujos del bono AL30 (vence en Y meses)." |
| Menos de 3 escenarios vigentes configurados | `422` — "No hay escenarios económicos vigentes configurados." |

---

## 5. Métricas agregadas de la cabecera

Después de recibir el response del motor, el servicio extrae métricas resumen para la cabecera de la simulación. Todas toman el **último valor** (mes T) de las estadísticas globales del portfolio:

### `valor_inicial`

```
valor_inicial = Σ monto de todos los instrumentos del payload
```

Suma de todos los `monto` calculados durante la construcción del payload.

### `valor_esperado` y `valor_esperado_usd`

```
valor_esperado = portfolio_ars.patrimonio.global.media[T]
               + portfolio_usd.patrimonio.global.media[T]
```

Los dos sub-portfolios se suman. Si no hay instrumentos USD, `portfolio_usd.patrimonio.global.media[T]` es cero.

### `valor_minimo` y `valor_maximo`

Igual que `valor_esperado` pero usando los campos `minimo` y `maximo` del response global.

### `retorno_esperado_pct`

```
retorno_esperado_pct = (valor_esperado - valor_inicial) / valor_inicial
```

Si `valor_inicial = 0`, el campo se guarda como `null`.

### `rendimiento_real_pct`

```
rendimiento_real_pct = (portfolio_ars.ganancias_reales.global.media[T]
                       + portfolio_usd.ganancias_reales.global.media[T]) / valor_inicial
```

Mide si el portfolio preservó (o no) el poder adquisitivo. Un valor negativo indica pérdida real aunque haya ganancia nominal.

---

## 6. Persistencia en transacción

La escritura a base de datos se realiza en una única transacción para garantizar consistencia: si cualquier INSERT falla, ninguno se persiste.

### Tabla `simulacion` (cabecera)

Una fila por ejecución con los metadatos y métricas agregadas.

### Tabla `simulacion_parametro_escenario` (snapshot)

Una fila por escenario (3 filas por simulación). Registra los rangos de inflación exactos que el motor usó en esa corrida, tomados de `escenario_economico` en el momento de la ejecución.

**Por qué:** los rangos de inflación vigentes pueden cambiar (actualización del seed). El snapshot garantiza que el historial de simulaciones sea reproducible incluso si los escenarios vigentes cambian.

### Tabla `simulacion_instrumento` (snapshot de tenencias)

Una fila por instrumento del portfolio en el momento de la simulación, con el JSON del payload enviado al motor. Permite reconstruir exactamente qué parámetros se usaron.

### Tabla `resultado_simulacion` (stats JSONB)

Una fila por combinación `(ámbito, escenario, métrica)`. Para un portfolio con 5 instrumentos:

- Ámbitos: `portfolio_ars`, `portfolio_usd`, `accion_1`, `letra_3`, `bono_2`, `bono_5`, `plazo_fijo_7` = 7 ámbitos
- Escenarios: `global`, `favorable`, `moderado`, `desfavorable` = 4
- Métricas: `patrimonio`, `ganancias_nominales`, `ganancias_reales` = 3

Total: 7 × 4 × 3 = **84 filas** por simulación.

Cada fila contiene el campo `stats` JSONB con los 6 vectores de estadísticas (media, mediana, p25, p75, mínimo, máximo), cada uno de largo `T_meses + 1`.

El índice `(id_simulacion, ambito)` en la tabla permite al frontend recuperar los resultados de un instrumento específico eficientemente.

---

## 7. Diagrama del payload completo (ejemplo)

```
Portfolio de 3 instrumentos (AAPL, AL30, PF Tradicional):

Payload enviado al motor:
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

Resultado: 3 ámbitos × 4 escenarios × 3 métricas = 36 filas en resultado_simulacion
           + portfolio_ars, portfolio_usd = +8 filas
           = 44 filas totales
```
