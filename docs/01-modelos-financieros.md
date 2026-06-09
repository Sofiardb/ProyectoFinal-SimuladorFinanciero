# Modelos financieros — Decisiones de diseño

**Motor de simulación:** `motor-simulacion/app/simulacion/`

---

## Principios generales aplicados a todos los instrumentos

Antes de documentar cada instrumento, se describen tres principios de diseño que aplican a todos ellos de forma uniforme. Estos principios fueron definidos antes de implementar el primer instrumento y se mantuvieron sin excepción.

---

### Principio 1: las funciones de instrumento son funciones puras

**Decisión:** cada función de instrumento (`simular_plazo_fijo_tradicional`, `simular_accion_vectorizado`, etc.) recibe todos sus inputs como parámetros y devuelve las trayectorias de evolución del patrimonio. No genera aleatoriedad internamente ni accede a ningún estado externo.

**Justificación:** la aleatoriedad se centraliza en el orquestador, que es el único responsable de la semilla y del RNG. Si los instrumentos generaran sus propios números aleatorios, sería imposible controlar las correlaciones entre activos (por ejemplo, que todas las acciones reaccionen al mismo shock de mercado). Además, las funciones puras son mucho más simples de testear: no se necesita un setup de portfolio completo para verificar que una función de plazo fijo calcula correctamente el interés compuesto.

---

### Principio 2: las funciones devuelven valor de mercado (patrimonio), no ganancias

**Decisión:** las funciones devuelven la trayectoria `[V(0), V(1), ..., V(T)]` donde `V(t)` es el valor de mercado del instrumento en el mes `t`. `V(0)` es siempre igual a `monto` (lo que el usuario pagó).

Las ganancias nominales (`V(t) - monto`) y reales (`V(t) / factor_acum(t) - monto`) son métricas derivadas que calcula el orquestador sobre las trayectorias ya computadas.

**Justificación:** separar "qué vale el instrumento" de "cuánto ganó" hace que los modelos sean independientes de los escenarios económicos. Solo los instrumentos indexados reciben inflación como input porque la inflación afecta directamente su valor nominal. Los no indexados (LECAP, bono tasa fija, plazo fijo tradicional) son completamente determinísticos y no saben nada de escenarios.

---

### Principio 3: separación nominal / real

**Decisión:** las funciones devuelven valores **nominales** (en pesos corrientes de cada mes). El rendimiento real (poder adquisitivo deflactado) lo calcula el orquestador dividiendo el valor nominal por el factor de inflación acumulada de esa trayectoria concreta.

**Justificación:** el cálculo del rendimiento real requiere la inflación acumulada, que es una variable estocástica generada por el orquestador. Si los instrumentos tuvieran que devolver directamente el valor real, necesitarían recibir la inflación como input incluso cuando no la usan para su valoración (como el plazo fijo tradicional). Esta separación mantiene cada función acotada a lo que genuinamente necesita.

---

## 1. Plazo fijo tradicional

**Archivo:** `motor-simulacion/app/simulacion/plazo_fijo.py`  
**Función:** `simular_plazo_fijo_tradicional`

### Qué es

Depósito a plazo en una entidad financiera a una tasa nominal anual (TNA) pactada. El banco devuelve el capital más intereses al vencimiento. El valor del instrumento crece de forma completamente determinística: no depende de ninguna variable macroeconómica.

### Modelo matemático adoptado

La TNA se convierte a tasa mensual: `r_m = TNA / 12`

Valor en el mes `t`:
```
V(t) = monto × (1 + r_m)^t          si t ≤ t_venc  (o reinvertir = True)
V(t) = monto × (1 + r_m)^t_venc     si t > t_venc  y reinvertir = False
```

### Decisiones de diseño

**Tasa mensual en lugar de diaria.** El motor opera con pasos de tiempo mensuales. La alternativa era usar la fórmula con días (`VF = M × (1 + TNA/365)^d`) y aproximar 1 mes = 30 días. Esto agrega complejidad sin ganancia de precisión para el propósito del simulador: la diferencia entre ambas convenciones para plazos de 1 a 24 meses es menor al 0.1%.

**Lógica de reinversión.** Cuando `t_venc < T` (el depósito vence antes del horizonte) y `reinvertir = True`, el capital más intereses se reinvierten automáticamente en un plazo idéntico. Matemáticamente esto equivale a un crecimiento compuesto continuo, por lo que la fórmula `V(t) = monto × (1 + r_m)^t` es válida para todo `t` sin casos especiales.

---

## 2. Plazo fijo UVA

**Archivo:** `motor-simulacion/app/simulacion/plazo_fijo.py`  
**Función:** `simular_plazo_fijo_uva_vectorizado`

### Qué es

Igual que el plazo fijo tradicional, pero el capital se ajusta mes a mes por la inflación mediante el mecanismo UVA (Unidad de Valor Adquisitivo). La tasa pactada es una **tasa real**: se aplica sobre el capital ya indexado. Garantiza al inversor mantener el poder adquisitivo más un rendimiento real positivo.

### Modelo matemático adoptado

Tasa mensual real: `r_m = tasa_real_anual / 12`

Factor de inflación acumulado hasta el mes `t`:
```
factor_acum[0] = 1
factor_acum[t] = (1 + π₁)(1 + π₂) ··· (1 + πt)
```

Valor en el mes `t`:
```
V(t) = monto × factor_acum[t] × (1 + r_m)^t      si t ≤ t_venc (o reinvertir = True)
V(t) = monto × factor_acum[t_venc] × (1+r_m)^t_venc   si t > t_venc y reinvertir = False
```

### Decisiones de diseño

**Separación entre factor de inflación y tasa real.** El factor de inflación y el factor de crecimiento real son independientes y se multiplican. Esta estructura refleja correctamente la mecánica del instrumento: la inflación ajusta el capital y la tasa real remunera ese capital ajustado.

**Input de inflación como vector.** La función recibe el array `inflacion_mensual` (un vector de `T_meses` valores) generado por el orquestador. No sortea inflación internamente. Este diseño es consistente con el Principio 1 (función pura) y con la vectorización: la función opera sobre matrices `(N, T+1)` donde `N` es el número de simulaciones.

> **Pregunta abierta — Rezago T-2 del UVA**
>
> El índice UVA es calculado diariamente por el BCRA a partir del CER, que a su vez usa el IPC publicado por el INDEC con aproximadamente dos meses de rezago. Esto significa que el ajuste que se aplica hoy sobre el capital del plazo fijo UVA incorpora la inflación de hace ~2 meses, no la inflación del mes corriente.
>
> **Enfoque propuesto:** reemplazar `factor_acum[t]` por `factor_cer[t] = factor_acum[max(0, t-2)]` en el cálculo de `V(t)`. En el orquestador esto se implementa con un shift de 2 posiciones:
> ```python
> factor_cer_matrix = np.ones((N_SIMULACIONES, T_meses + 1))
> factor_cer_matrix[:, 2:] = factor_acum_matrix[:, :-2]
> ```
> Los meses `t=0` y `t=1` quedan con `factor_cer = 1` porque la inflación simulada de esos meses aún no fue publicada. Esto es correcto: la inflación anterior a t=0 ya estaba incorporada en el precio que el inversor pagó.
>
> **¿Funciona así realmente?** Validar que el comportamiento del plazo fijo UVA con `factor_cer_matrix` es coherente con el mecanismo real del instrumento.

---

## Restricciones y suposiciones generales para bonos y letras

Las siguientes restricciones fueron definidas antes de implementar los modelos para acotar el alcance del simulador.

### Vencimiento dentro del horizonte (`t_venc ≤ T`)

Solo se incluyen en el portfolio letras y bonos cuyo vencimiento cae dentro del horizonte de simulación `T`. El backend filtra los instrumentos disponibles al construir el portfolio.

**Consecuencia en el motor:** las funciones de instrumento no necesitan manejar el caso `t_venc > T`. Las trayectorias siempre alcanzan su vencimiento natural dentro de los `T` meses.

### Compra en licitación primaria

Se asume que el usuario compra los instrumentos en la licitación del Tesoro, no en el mercado secundario.

**Implicancias:**
- El precio pagado es el precio de licitación, sin spread bid/ask ni comisiones.
- La TIR implícita resulta directamente del precio pagado y los flujos del instrumento.

Esta suposición simplifica el modelo y es coherente con el perfil de usuario objetivo del simulador: inversores que participan en licitaciones primarias.

### Flujos de caja provistos por el backend

Las funciones del motor reciben los flujos de caja como parámetros. El backend es responsable de:
1. Consultar la API de mercado para obtener el calendario de pagos.
2. Filtrar instrumentos que vencen después de `T`.
3. Convertir fechas de pago a índices de mes relativos al inicio de la simulación.

Esto mantiene el motor como función pura (sin I/O), más simple de testear e independiente de fuentes de datos externas.

---

## 3. Letra LECAP (tasa fija, cupón cero)

**Archivo:** `motor-simulacion/app/simulacion/letras.py`  
**Función:** `simular_letra_lecap`

### Qué es

Letra del Tesoro Nacional a tasa fija. Es un instrumento cupón cero: el usuario compra a descuento y recibe el valor nominal completo al vencimiento, sin pagos intermedios. El valor del instrumento crece monotónicamente desde el precio de compra hasta el nominal a medida que se acerca el vencimiento.

### Modelo matemático adoptado

Valor nominal implícito (cobrado al vencimiento):
```
VN = monto × (1 + tna × t_venc / 12)
```

Valor en el mes `t`:
```
V(t) = VN / (1 + tna × (t_venc - t) / 12)     para t ∈ [0, t_venc]
```

**Verificación de invariantes:**
- En `t = 0`: `V(0) = VN / (1 + tna × t_venc/12) = monto` ✓
- En `t = t_venc`: denominador = 1 → `V(t_venc) = VN` ✓

### Decisiones de diseño

**Interés simple en lugar de capitalización compuesta.** La propuesta cita a Hull (2014) para instrumentos de corto plazo: la convención del mercado para cupones cero de corto plazo es interés simple (`1 + r × T`) y no capitalización compuesta (`(1+r)^T`). Para plazos de hasta 12 meses la diferencia numérica es mínima, pero la fórmula de interés simple es la que usan los participantes del mercado argentino para pricear LECAPs.

**La trayectoria termina en `t_venc`.** La función devuelve un vector de largo `t_venc + 1`, no de largo `T + 1`. Si el instrumento vence antes del horizonte de simulación, el orquestador aplica padding. Esta separación de responsabilidades evita que la función de la letra necesite conocer el horizonte total de la simulación.

**Sin opción de reinversión.** A diferencia del plazo fijo, la LECAP no tiene flag `reinvertir`. Al vencer, el nominal cobrado queda disponible como efectivo en el portfolio. La reinversión en otro instrumento es una decisión del usuario que excede el alcance de esta función.


---

## 4. Letra LECER (indexada por inflación, cupón cero)

**Archivo:** `motor-simulacion/app/simulacion/letras.py`  
**Función:** `simular_letra_lecer_vectorizado`

### Qué es

Igual que la LECAP, pero el valor nominal se ajusta por el Coeficiente de Estabilización de Referencia (CER), que sigue la inflación mensual. El usuario compra a descuento sobre un nominal que crecerá con la inflación acumulada hasta el vencimiento. Es el instrumento de renta fija de corto plazo que mejor protege el poder adquisitivo.

### Modelo matemático adoptado

Factor de inflación acumulado hasta el mes `t`:
```
factor_acum[0] = 1
factor_acum[t] = (1 + π₁)(1 + π₂) ··· (1 + πt)
```

Valor nominal original (antes del ajuste CER): `VN₀ = monto × (1 + tna × t_venc / 12)`

Valor en el mes `t`:
```
V(t) = VN₀ × factor_acum[t] / (1 + tna × (t_venc - t) / 12)     para t ∈ [0, t_venc]
```

**Verificación de invariantes:**
- En `t = 0`: `factor_acum[0] = 1` siempre → `V(0) = VN₀ / (1 + tna × t_venc/12) = monto` ✓  
  La inflación **futura** no afecta el precio de entrada, lo que es correcto: el usuario pagó `monto` en t=0.
- En `t = t_venc`: denominador = 1 → `V(t_venc) = VN₀ × factor_acum[t_venc]` (nominal ajustado por toda la inflación acumulada) ✓

### Decisiones de diseño

**El vector de inflación tiene exactamente `t_venc` elementos.** El orquestador pasa `inflacion_mensual[:t_venc]` — solo la inflación durante la vida del instrumento. Esto explicita el contrato entre el orquestador y la función y evita que la función acceda por error a inflación de meses posteriores a su vencimiento.

> **Pregunta abierta — Rezago T-2 del CER**
>
> El CER incorpora el IPC con ~2 meses de rezago: el INDEC publica el IPC de cada mes alrededor de la mitad del mes siguiente, y el BCRA lo incorpora al coeficiente con demora adicional. El CER vigente en el mes `t` refleja la inflación acumulada hasta aproximadamente `t-2`.
>
> **Enfoque propuesto:** reemplazar `factor_acum[t]` por `factor_cer[t] = factor_acum[max(0, t-2)]` en el numerador de la fórmula de valuación. La fórmula quedaría:
> ```
> V(t) = VN₀ × factor_cer[t] / (1 + tna × (t_venc - t) / 12)
> ```
> Los meses `t=0` y `t=1` tienen `factor_cer = 1` porque la inflación simulada de esos meses aún no fue publicada por el INDEC. La inflación anterior a t=0 ya está incorporada en el precio de compra.
>
> **¿Funciona así realmente?** Validar que la valuación de la LECER con `factor_cer` es coherente con el comportamiento real del instrumento, en particular que `V(0) = monto` se mantiene (se mantiene porque `factor_cer[0] = 1` siempre).

---

## 5. Bono a tasa fija

**Archivo:** `motor-simulacion/app/simulacion/bonos.py`  
**Función:** `simular_bono_tasa_fija`

### Qué es

Bono soberano con flujos de caja nominales fijos (cupones periódicos más amortizaciones de capital). El usuario compra en la licitación primaria del Tesoro. La trayectoria es completamente **determinística**: como los flujos son fijos y la TIR es conocida en t=0, no hay estocasticidad en ninguna trayectoria.

### Modelo matemático adoptado — Descuento de Flujos (DCF)

El valor del bono en el mes `t` considera tanto los flujos ya cobrados como el valor presente de los flujos restantes:

```
V(t) = Σ_{mᵢ ≤ t}  flujoᵢ                                     ← ya cobrado: valor nominal pleno
     + Σ_{mᵢ > t}  flujoᵢ / (1 + TIR)^((mᵢ - t) / 12)       ← futuro: descontado a TIR
```

**Verificación de invariantes:**
- En `t = 0`: todos los flujos son futuros → `V(0) = Σ flujoᵢ / (1+TIR)^(mᵢ/12) = monto` (por definición de TIR) ✓
- En `t = t_venc`: todos los flujos cobrados, factor = 1 → `V(t_venc) = Σ flujoᵢ` ✓

### Decisiones de diseño

**Flujos cobrados a valor nominal, sin reinversión.** Una vez que un flujo es cobrado, se suma a `V(t)` por su valor nominal completo sin suponer que fue reinvertido. Modelar la reinversión requeriría asumir a qué tasa y en qué instrumento — una decisión del usuario, no del simulador.

**Los flujos los provee el backend, no el motor.** El motor recibe la lista de flujos `[{"mes": int, "monto": float}, ...]` como parámetro. El backend es responsable de consultar la API de mercado, convertir fechas de pago a índices de mes relativos al inicio de la simulación y verificar que el vencimiento caiga dentro del horizonte `T`. Esto mantiene el motor como función pura sin I/O.

**TIR implícita del precio de licitación.** Se asume compra en mercado primario (licitación), por lo que el precio pagado `monto` ya tiene la TIR implícita correcta. La TIR también se obtiene de la API.

---

## 6. Bono indexado por inflación (CER)

**Archivo:** `motor-simulacion/app/simulacion/bonos.py`  
**Función:** `simular_bono_indexado_vectorizado`

### Qué es

Bono soberano cuyos flujos de caja se ajustan por el Coeficiente de Estabilización de Referencia (CER), que sigue la inflación. Los flujos crecen con la inflación acumulada, protegiendo el poder adquisitivo más un rendimiento real. La trayectoria es **estocástica** porque depende de la inflación simulada en cada trayectoria Monte Carlo.

### Modelo matemático adoptado

Los `flujos_base` representan los flujos en pesos de t=0 (antes de cualquier ajuste CER). La inflación simulada los reajusta hacia adelante.

Factor de inflación acumulado:
```
factor_acum[0] = 1
factor_acum[t] = (1 + π₁)(1 + π₂) ··· (1 + πt)
```

La valuación combina DCF en términos reales con conversión a nominal:

```
V(t) = Σ_{mᵢ ≤ t}  baseᵢ × factor_acum[mᵢ]                                   ← cobrado en mᵢ
     + Σ_{mᵢ > t}  baseᵢ × (1 + TIR_real)^(-(mᵢ - t)/12) × factor_acum[t]   ← futuro: DCF real → nominal
```

**Verificación de invariantes:**
- En `t = 0`: `factor_acum[0] = 1` siempre, independiente de la inflación futura → `V(0) = Σ baseᵢ × (1+TIR_real)^(-mᵢ/12) = monto` ✓  
  El precio de entrada es el mismo en todas las trayectorias, lo que es correcto: el usuario pagó `monto` en t=0 sin conocer la inflación futura.
- En `t = t_venc`: todos cobrados → `V(t_venc) = Σ baseᵢ × factor_acum[mᵢ]` ✓

### Decisiones de diseño

**Separación real/nominal explícita.** Los flujos base están en pesos de t=0 (reales). El factor de inflación acumulada convierte ese valor real a nominal en cada mes. Esta separación refleja exactamente el mecanismo del CER: el instrumento promete un rendimiento real, y la inflación determina cuántos pesos nominales representa ese rendimiento en cada momento.

**TIR real, no nominal.** La tasa de descuento es `TIR_real` sobre los flujos base. Usar una TIR nominal sobre flujos ya ajustados por inflación mezclaría dos tipos de tasas y distorsionaría la valuación. La TIR real es la TIR implícita del precio de licitación sobre los flujos base (sin ajuste inflacionario).

> **Pregunta abierta — Rezago T-2 del CER**
>
> Igual que la LECER, el bono CER ajusta sus flujos por el coeficiente CER, que incorpora la inflación con ~2 meses de rezago. En la fórmula de valuación esto afecta dos lugares:
> - Los **flujos cobrados**: `baseᵢ × factor_cer[mᵢ]` en lugar de `baseᵢ × factor_acum[mᵢ]`
> - Los **flujos futuros**: `baseᵢ × (1 + TIR_real)^(-(mᵢ-t)/12) × factor_cer[t]` en lugar de `factor_acum[t]`
>
> La fórmula completa con rezago:
> ```
> V(t) = Σ_{mᵢ ≤ t}  baseᵢ × factor_cer[mᵢ]
>      + Σ_{mᵢ > t}  baseᵢ × (1 + TIR_real)^(-(mᵢ - t)/12) × factor_cer[t]
> ```
> El invariante `V(0) = monto` se mantiene porque `factor_cer[0] = 1` siempre.
>
> **¿Funciona así realmente?** Validar que la valuación del bono CER con `factor_cer` es coherente con el comportamiento real del instrumento. En particular, verificar que los flujos cobrados antes de `t=2` (cuando `factor_cer = 1`) resultan en valores razonables.

---

## 7. Acciones — Movimiento Browniano Geométrico (GBM)

**Archivo:** `motor-simulacion/app/simulacion/acciones.py`  
**Función:** `simular_accion_vectorizado`

### Qué es

Instrumento de renta variable. El precio futuro de una acción es incierto y se modela con GBM: el precio sigue una trayectoria multiplicativa donde cada paso tiene una componente de deriva (tendencia esperada) y una componente aleatoria (volatilidad). El universo de acciones se limita al mercado estadounidense (S&P 500).

### Modelo matemático adoptado — GBM en tiempo discreto

El GBM en tiempo continuo está dado por la ecuación diferencial estocástica:
```
dS = μ·S·dt + σ·S·dW
```

En forma discreta con paso mensual (Δt = 1/12), aplicando el esquema de Euler-Maruyama:
```
S(t + 1) = S(t) × exp( (μ - 0.5σ²)/12  +  σ/√12 × z[t] )
```

El patrimonio acumula esos retornos logarítmicos:
```
V(t) = monto × exp( Σ_{k=1}^{t} retorno_log[k] )
```

Los parámetros `μ` (drift anualizado) y `σ` (volatilidad anualizada) son estimados por el backend a partir de retornos logarítmicos diarios históricos: `μ_anual = media(r_t) × 252`, `σ_anual = std(r_t) × √252`.


### Decisión: shocks generados externamente (función pura)

**Contexto:** las acciones requieren aleatoriedad, pero también deben estar correlacionadas entre sí a través de un factor de mercado compartido (ver Decisión 6 del orquestador).

**Decisión:** la función recibe el vector `z_accion` (shocks ya combinados, largo `T_meses`) como parámetro. No genera aleatoriedad internamente.

El orquestador construye ese vector como:
```
z_accion[t] = ρ × z_indice[t] + √(1 - ρ²) × z_propio[t]
```
donde `z_indice` es el shock sistemático compartido por todas las acciones en ese paso de tiempo, y `z_propio` es el shock idiosincrático exclusivo de esa acción.

**Justificación:** centralizar la generación de aleatoriedad en el orquestador permite controlar la estructura de correlaciones del portfolio completo. Si cada función generara sus propios shocks, sería imposible garantizar que dos acciones del mismo portfolio reaccionen al mismo shock de mercado.
