# Modelos financieros

**Motor de simulación:** `motor-simulacion/app/simulacion/`

---

## 1. Principios generales aplicados a todos los instrumentos

Tres principios de diseño, definidos antes de implementar el primer instrumento, se aplican de forma uniforme a todas las funciones de instrumento (`simular_plazo_fijo_tradicional`, `simular_accion_vectorizado`, etc.) y se mantuvieron sin excepción.

Cada función de instrumento es una función pura: recibe todos sus inputs como parámetros y devuelve las trayectorias de evolución del patrimonio, sin generar aleatoriedad internamente ni acceder a ningún estado externo. La aleatoriedad se centraliza en el orquestador (`docs/02-orquestador-montecarlo.md`), que es el único responsable de la semilla y del RNG; si cada instrumento generara sus propios números aleatorios, sería imposible controlar las correlaciones entre activos — por ejemplo, que todas las acciones reaccionen al mismo shock de mercado. Las funciones puras son además mucho más simples de testear, porque no requieren un setup de portfolio completo para verificar que, por ejemplo, una función de plazo fijo calcula correctamente el interés compuesto.

Las funciones devuelven valor de mercado (patrimonio), no ganancias: la trayectoria `[V(0), V(1), ..., V(T)]`, donde `V(t)` es el valor de mercado del instrumento en el mes `t` y `V(0)` es siempre igual a `monto` (lo que el usuario pagó). Las ganancias nominales (`V(t) - monto`) y reales (`V(t) / factor_acum(t) - monto`) son métricas derivadas que calcula el orquestador sobre las trayectorias ya computadas. Esta separación entre "qué vale el instrumento" y "cuánto ganó" mantiene los modelos independientes de los escenarios económicos: solo los instrumentos indexados reciben inflación como input, porque es la única familia cuyo valor nominal depende de ella. Los no indexados (LECAP, bono tasa fija, plazo fijo tradicional) son completamente determinísticos y no conocen los escenarios.

En la misma línea, las funciones devuelven siempre valores nominales (en pesos corrientes de cada mes); el rendimiento real lo calcula el orquestador dividiendo el valor nominal por el factor de inflación acumulada de esa trayectoria concreta. El cálculo del rendimiento real requiere la inflación acumulada, que es una variable estocástica generada por el orquestador — si las funciones de instrumento tuvieran que devolver directamente el valor real, necesitarían recibir la inflación como input incluso cuando no la usan para su propia valoración, como el plazo fijo tradicional. Mantener esta separación acota cada función a lo que genuinamente necesita.

## 2. Rezago T-2 del CER: mecanismo y validación

Tres instrumentos —la letra LECER, el bono indexado por inflación y el plazo fijo UVA— ajustan su valor por el Coeficiente de Estabilización de Referencia (CER), que sigue la inflación con un rezago real de aproximadamente dos meses: el INDEC publica el IPC de cada mes hacia la mitad del mes siguiente, y el BCRA lo incorpora al coeficiente con demora adicional. El CER vigente en el mes `t` refleja, en la práctica, la inflación acumulada hasta aproximadamente `t-2`, no la del mes corriente.

El motor incorpora este rezago sustituyendo, en la fórmula de valuación de los tres instrumentos, el factor de inflación acumulada `factor_acum[t]` por un factor desplazado dos meses:

```
factor_cer[t] = factor_acum[max(0, t-2)]
```

En el orquestador esto se implementa desplazando la matriz de inflación acumulada dos posiciones:

```python
factor_cer_matrix = np.ones((N_SIMULACIONES, T_meses + 1))
factor_cer_matrix[:, 2:] = factor_acum_matrix[:, :-2]
```

Los meses `t=0` y `t=1` quedan con `factor_cer = 1`, porque la inflación simulada de esos meses todavía no fue publicada por el INDEC al momento de valuar el instrumento; la inflación anterior a `t=0` ya estaba incorporada en el precio que pagó el inversor, de modo que el invariante `V(0) = monto` se mantiene sin ningún caso especial. Cada instrumento indexado recibe `factor_cer_matrix` (o el slice correspondiente a su vencimiento) en el lugar donde antes recibía `factor_acum_matrix` sin rezagar; las secciones 8, 9 y 4 detallan dónde entra este factor en la fórmula de cada uno.

## 3. Plazo fijo tradicional

**Archivo:** `motor-simulacion/app/simulacion/plazo_fijo.py`
**Función:** `simular_plazo_fijo_tradicional`

Depósito a plazo en una entidad financiera a una tasa nominal anual (TNA) pactada. El banco devuelve el capital más intereses al vencimiento. El valor del instrumento crece de forma completamente determinística: no depende de ninguna variable macroeconómica.

La TNA se convierte a tasa mensual `r_m = TNA / 12`, y el valor en el mes `t` es:

```
V(t) = monto × (1 + r_m)^t          si t ≤ t_venc  (o reinvertir = True)
V(t) = monto × (1 + r_m)^t_venc     si t > t_venc  y reinvertir = False
```

Se usa tasa mensual en lugar de diaria porque el motor opera con pasos de tiempo mensuales; la alternativa (`VF = M × (1 + TNA/365)^d`, aproximando 1 mes = 30 días) agrega complejidad sin ganancia de precisión relevante para el simulador, ya que la diferencia entre ambas convenciones para plazos de 1 a 24 meses es menor al 0.1%. Cuando `t_venc < T` y `reinvertir = True`, el capital más intereses se reinvierten automáticamente en un plazo idéntico; matemáticamente esto equivale a un crecimiento compuesto continuo, por lo que la fórmula `V(t) = monto × (1 + r_m)^t` es válida para todo `t` sin necesidad de casos especiales.

## 4. Plazo fijo UVA

**Archivo:** `motor-simulacion/app/simulacion/plazo_fijo.py`
**Función:** `simular_plazo_fijo_uva_vectorizado`

Igual que el plazo fijo tradicional, pero el capital se ajusta mes a mes por la inflación mediante el mecanismo UVA (Unidad de Valor Adquisitivo). La tasa pactada es una tasa real, que se aplica sobre el capital ya indexado, y garantiza al inversor mantener el poder adquisitivo más un rendimiento real positivo.

Con tasa mensual real `r_m = tasa_real_anual / 12` y el factor de inflación acumulada rezagado según la sección 2 (`factor_cer[t] = factor_acum[max(0, t-2)]`), el valor en el mes `t` es:

```
V(t) = monto × factor_cer[t] × (1 + r_m)^t                si t ≤ t_venc (o reinvertir = True)
V(t) = monto × factor_cer[t_venc] × (1 + r_m)^t_venc       si t > t_venc y reinvertir = False
```

El factor de inflación y el factor de crecimiento real son independientes y se multiplican: esta estructura refleja la mecánica real del instrumento, donde la inflación ajusta el capital y la tasa real remunera ese capital ya ajustado. La función recibe el factor de inflación como un array ya calculado por el orquestador (no sortea inflación internamente ni conoce si está rezagado o no), consistente con el principio de función pura de la sección 1 y con la vectorización sobre matrices `(N, T+1)`.

## 5. Plazo fijo en dólares

**Archivo:** `motor-simulacion/app/simulacion/orquestador.py` (tipo `plazo_fijo_usd`)
**Función:** `simular_plazo_fijo_tradicional` (reutilizada)

Depósito a plazo denominado y pactado en dólares. En términos de cálculo nominal es idéntico al plazo fijo tradicional — el orquestador invoca la misma función `simular_plazo_fijo_tradicional` con `monto` y `tna` expresados en USD, sin ningún modelo matemático adicional. La diferencia está exclusivamente en qué factor de inflación se usa para deflactar y obtener la ganancia real: el orquestador clasifica el instrumento como USD (`_es_usd(inst)` devuelve `True` para `tipo in ("accion", "plazo_fijo_usd")`) y por lo tanto divide su trayectoria nominal por `factor_acum_usd_matrix` en lugar de `factor_acum_matrix` al calcular `ganancias_reales`, y lo agrega al sub-portfolio `portfolio_usd` en lugar de `portfolio_ars` (ver `docs/02-orquestador-montecarlo.md`, sección de separación de portfolios por moneda). No existe una variante UVA en dólares: solo se modela la versión tradicional a tasa fija.

## 6. Restricciones y supuestos generales para bonos y letras

Las siguientes restricciones se definieron antes de implementar los modelos de renta fija de mercado, para acotar el alcance del simulador.

El vencimiento de un bono o letra es independiente del horizonte de simulación `T`: no hay ninguna restricción al agregar el instrumento al portfolio, y `T` se elige recién al correr cada simulación (`docs/07-portfolio-reglas-negocio.md`). Cuando `t_venc > T`, el motor trunca la trayectoria en `T` sin proyectar el instrumento hasta su vencimiento real (ver la sección de tratamiento de vencimientos en `docs/02-orquestador-montecarlo.md`); las funciones de instrumento siempre calculan contra el vencimiento real, para descontar correctamente cuánto falta, pero es el orquestador quien decide hasta qué mes emitir la trayectoria.

Se asume que el precio y la tasa/TIR de cada instrumento reflejan la cotización de mercado secundario vigente al momento de la consulta — no el resultado de una licitación primaria del Tesoro. El diseño original de esta sección preveía comprar en licitación primaria, pero al integrar las fuentes de datos reales (`docs/04-apis-datos-mercado.md`) se usó cotización de mercado secundario: BYMA Open Data y data912 exponen precios de cotización refrescados cada 15 minutos en horario bursátil (terminología de liquidación T1/T2, propia de mercado secundario), no resultados de licitación, que son eventos puntuales sin una API pública utilizable para simular en cualquier fecha. Se mantiene la simplificación de no modelar spread bid/ask ni comisiones: aunque data912 expone punta compradora y vendedora, el sistema toma un único precio de referencia (cierre) por instrumento.

El precio y la tasa/TIR provienen además de fuentes independientes entre sí — el precio de BYMA/data912, la tasa del endpoint de yields de Docta Capital (`docs/04-apis-datos-mercado.md`, sección 3.3) — sin que el sistema derive una a partir de la otra. No hay ninguna garantía de que ambas reflejen exactamente el mismo instante de mercado, ya que cada una se refresca de forma independiente.

Las funciones del motor reciben los flujos de caja como parámetros; es responsabilidad del backend consultar la API de mercado para obtener el calendario de pagos y convertir fechas de pago a índices de mes relativos al inicio de la simulación. Esto mantiene el motor como función pura, sin I/O, más simple de testear e independiente de fuentes de datos externas.

## 7. Letra LECAP (tasa fija, cupón cero)

**Archivo:** `motor-simulacion/app/simulacion/letras.py`
**Función:** `simular_letra_lecap`

Letra del Tesoro Nacional a tasa fija. Es un instrumento cupón cero: el usuario compra a descuento y recibe el valor nominal completo al vencimiento, sin pagos intermedios. El valor del instrumento crece monotónicamente desde el precio de compra hasta el nominal a medida que se acerca el vencimiento.

El valor nominal implícito, cobrado al vencimiento, es `VN = monto × (1 + tna × t_venc / 12)`, y el valor en el mes `t` es:

```
V(t) = VN / (1 + tna × (t_venc - t) / 12)     para t ∈ [0, t_venc]
```

Se verifica que en `t = 0`, `V(0) = VN / (1 + tna × t_venc/12) = monto`, y que en `t = t_venc` el denominador vale 1 y `V(t_venc) = VN`.

Se usa interés simple en lugar de capitalización compuesta: la propuesta cita a Hull (2014) para instrumentos de corto plazo, donde la convención de mercado para cupones cero de corto plazo es interés simple (`1 + r × T`) y no capitalización compuesta (`(1+r)^T`). Para plazos de hasta 12 meses la diferencia numérica es mínima, pero la fórmula de interés simple es la que usan los participantes del mercado argentino para pricear LECAPs. La función devuelve un vector de largo `t_venc + 1`, no de largo `T + 1`: si el instrumento vence antes del horizonte de simulación, el orquestador aplica padding, y si vence después, lo trunca a `T + 1` — esta separación de responsabilidades evita que la función de la letra necesite conocer el horizonte total de la simulación. A diferencia del plazo fijo, la LECAP no tiene flag de reinversión: al vencer, el nominal cobrado queda disponible como efectivo en el portfolio, y reinvertirlo en otro instrumento es una decisión del usuario que excede el alcance de esta función.

## 8. Letra LECER (indexada por inflación, cupón cero)

**Archivo:** `motor-simulacion/app/simulacion/letras.py`
**Función:** `simular_letra_lecer_vectorizado`

Igual que la LECAP, pero el valor nominal se ajusta por el CER, que sigue la inflación mensual con el rezago de dos meses descripto en la sección 2. El usuario compra a descuento sobre un nominal que crecerá con la inflación acumulada hasta el vencimiento; es el instrumento de renta fija de corto plazo que mejor protege el poder adquisitivo.

Con el valor nominal original (antes del ajuste CER) `VN₀ = monto × (1 + tna × t_venc / 12)` y el factor rezagado `factor_cer[t] = factor_acum[max(0, t-2)]`, el valor en el mes `t` es:

```
V(t) = VN₀ × factor_cer[t] / (1 + tna × (t_venc - t) / 12)     para t ∈ [0, t_venc]
```

En `t = 0`, `factor_cer[0] = 1` siempre, así que la inflación futura no afecta el precio de entrada y `V(0) = VN₀ / (1 + tna × t_venc/12) = monto`, correctamente independiente de la inflación que todavía no ocurrió. En `t = t_venc`, el denominador vale 1 y `V(t_venc) = VN₀ × factor_cer[t_venc]`, el nominal ajustado por toda la inflación acumulada (rezagada) durante la vida del instrumento. El orquestador pasa `factor_cer[:t_venc]` — solo la porción de la matriz correspondiente a la vida del instrumento —, lo que explicita el contrato entre orquestador y función y evita que esta acceda por error a inflación de meses posteriores a su propio vencimiento.

## 9. Bono a tasa fija

**Archivo:** `motor-simulacion/app/simulacion/bonos.py`
**Función:** `simular_bono_tasa_fija`

Bono soberano con flujos de caja nominales fijos (cupones periódicos más amortizaciones de capital). El precio de compra refleja la cotización de mercado secundario vigente al consultar (sección 6). La trayectoria es completamente determinística: como los flujos son fijos y la TIR es conocida en `t=0`, no hay estocasticidad en ninguna trayectoria.

El valor del bono en el mes `t`, por descuento de flujos (DCF), considera tanto los flujos ya cobrados como el valor presente de los flujos restantes:

```
V(t) = Σ_{mᵢ ≤ t}  flujoᵢ                                     ← ya cobrado: valor nominal pleno
     + Σ_{mᵢ > t}  flujoᵢ / (1 + TIR)^((mᵢ - t) / 12)       ← futuro: descontado a TIR
```

En `t = 0` todos los flujos son futuros, y por definición de TIR, `V(0) = Σ flujoᵢ / (1+TIR)^(mᵢ/12) = monto`. En `t = t_venc` todos los flujos están cobrados y el factor de descuento vale 1, así que `V(t_venc) = Σ flujoᵢ`.

Una vez que un flujo es cobrado, se suma a `V(t)` por su valor nominal completo, sin suponer que fue reinvertido — modelar la reinversión requeriría asumir a qué tasa y en qué instrumento, una decisión del usuario y no del simulador. El motor recibe la lista de flujos `[{"mes": int, "monto": float}, ...]` como parámetro; es responsabilidad del backend consultar la API de mercado, convertir fechas de pago a índices de mes relativos al inicio de la simulación y verificar que el vencimiento caiga dentro del horizonte `T`, lo que mantiene el motor como función pura sin I/O. El precio pagado `monto` refleja la cotización de mercado secundario vigente al consultar (sección 6); la TIR se obtiene por separado, directamente del endpoint de yields de Docta Capital.

## 10. Bono indexado por inflación (CER)

**Archivo:** `motor-simulacion/app/simulacion/bonos.py`
**Función:** `simular_bono_indexado_vectorizado`

Bono soberano cuyos flujos de caja se ajustan por el CER con el rezago de dos meses descripto en la sección 2. Los flujos crecen con la inflación acumulada, protegiendo el poder adquisitivo más un rendimiento real. La trayectoria es estocástica, porque depende de la inflación simulada en cada trayectoria Monte Carlo.

Los `flujos_base` representan los flujos en pesos de `t=0`, antes de cualquier ajuste CER; la inflación simulada (rezagada) los reajusta hacia adelante. La valuación combina DCF en términos reales con conversión a nominal:

```
V(t) = Σ_{mᵢ ≤ t}  baseᵢ × factor_cer[mᵢ]
     + Σ_{mᵢ > t}  baseᵢ × (1 + TIR_real)^(-(mᵢ - t)/12) × factor_cer[t]
```

`factor_cer[0] = 1` siempre, independientemente de la inflación futura, así que `V(0) = Σ baseᵢ × (1+TIR_real)^(-mᵢ/12) = monto`: el precio de entrada es el mismo en todas las trayectorias, correctamente, porque el usuario pagó `monto` en `t=0` sin conocer la inflación futura. En `t = t_venc`, con todos los flujos cobrados, `V(t_venc) = Σ baseᵢ × factor_cer[mᵢ]`.

La tasa de descuento es la TIR real sobre los flujos base, no una TIR nominal sobre flujos ya ajustados por inflación — mezclar ambas distorsionaría la valuación. La TIR real proviene directamente del endpoint de yields de Docta Capital (sección 6), sin ajuste inflacionario adicional de este lado. Esta separación explícita entre lo real y lo nominal refleja el mecanismo del CER: el instrumento promete un rendimiento real, y la inflación determina cuántos pesos nominales representa ese rendimiento en cada momento.

## 11. Acciones — Movimiento Browniano Geométrico (GBM)

**Archivo:** `motor-simulacion/app/simulacion/acciones.py`
**Función:** `simular_accion_vectorizado`

Instrumento de renta variable. El precio futuro de una acción es incierto y se modela con GBM: el precio sigue una trayectoria multiplicativa donde cada paso tiene una componente de deriva (tendencia esperada) y una componente aleatoria (volatilidad). El universo de acciones se limita al mercado estadounidense, con el S&P 500 como índice de referencia (`SR-01`).

El GBM en tiempo continuo está dado por la ecuación diferencial estocástica `dS = μ·S·dt + σ·S·dW`. En forma discreta con paso mensual (`Δt = 1/12`), aplicando el esquema de Euler-Maruyama:

```
S(t + 1) = S(t) × exp( (μ - 0.5σ²)/12  +  σ/√12 × z[t] )
```

y el patrimonio acumula esos retornos logarítmicos: `V(t) = monto × exp( Σ_{k=1}^{t} retorno_log[k] )`. Los parámetros `μ` (drift anualizado) y `σ` (volatilidad anualizada) son estimados por el backend a partir de retornos logarítmicos diarios históricos: `μ_anual = media(r_t) × 252`, `σ_anual = std(r_t) × √252`.

La función recibe el vector `z_accion` (shocks ya combinados, largo `T_meses`) como parámetro y no genera aleatoriedad internamente. El orquestador lo construye como `z_accion[t] = ρ × z_indice[t] + √(1 - ρ²) × z_propio[t]`, donde `z_indice` es el shock sistemático compartido por todas las acciones del portfolio en ese paso de tiempo y `z_propio` es el shock idiosincrático exclusivo de esa acción (ver el modelo de mercado en `docs/02-orquestador-montecarlo.md`). Centralizar la generación de aleatoriedad en el orquestador permite controlar la estructura de correlaciones del portfolio completo: si cada función generara sus propios shocks, sería imposible garantizar que dos acciones del mismo portfolio reaccionen al mismo shock de mercado.
