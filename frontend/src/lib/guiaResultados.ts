export interface GuiaItem {
  term: string
  texto: string
  selector?: string
  slot: string
}

export interface GuiaSeccion {
  titulo: string
  items: GuiaItem[]
}

export const GUIA_RESULTADOS: GuiaSeccion[] = [
  {
    titulo: 'Los números clave',
    items: [
      {
        term: 'Monto invertido',
        texto: 'Es la plata que invertiste al armar esta simulación: la suma de lo que elegiste destinar a cada instrumento del portfolio en el momento cero, antes de que pase ningún mes. Sirve como punto de partida para comparar contra el valor final.\n\nSi tu portfolio combina instrumentos en pesos y en dólares, vas a ver esta tarjeta duplicada: una con el monto invertido en ARS (sumando solo los instrumentos en pesos) y otra con el monto invertido en USD (sumando solo los instrumentos en dólares). No se mezclan en un solo total porque son unidades distintas — sumar pesos y dólares directamente implicaría estimar una tasa de cambio en el horizonte desconocida por el simulador.',
        selector: '[data-guia="kpi-monto-invertido"]',
        slot: 'kpis',
      },
      {
        term: 'Valor final (mediana)',
        texto: 'Cada simulación corre miles de escenarios posibles de mercado e inflación, así que no hay un único "resultado" — hay una distribución de resultados posibles al cabo del horizonte elegido. Para resumir esa distribución en un solo número usamos la mediana: el valor que queda justo en el medio, con la misma cantidad de escenarios simulados por arriba que por abajo.\n\nUsamos mediana y no promedio porque el promedio puede verse afectado por escenarios extremos (positivos o negativos), mientras que la mediana representa mejor el escenario medio.\n\nAl igual que el monto invertido, si tu portfolio mezcla instrumentos en pesos y en dólares vas a ver esta métrica calculada por separado para cada moneda: un valor final (mediana) en ARS —de tus instrumentos en pesos— y otro en USD —de tus instrumentos en dólares—.',
        selector: '[data-guia="kpi-valor-final"]',
        slot: 'kpis',
      },
      {
        term: 'Inflación acumulada (ARS / USD)',
        texto: 'Es cuánto subieron los precios, en total, a lo largo de todo el horizonte simulado. Al igual que el monto invertido y el valor final, esta métrica se muestra siempre por separado para cada moneda —una tarjeta de inflación acumulada en ARS y otra en USD— porque cada moneda tiene su propia dinámica inflacionaria en el modelo, independiente de si tu portfolio tiene instrumentos en una, en la otra, o en ambas. Se muestra la mediana de esa inflación acumulada entre todos los escenarios simulados.\n\nEste número es la referencia para entender la diferencia entre ganancias nominales y ganancias reales: si tu plata creció menos que la inflación acumulada, tu ganancia nominal puede ser positiva y tu ganancia real igual ser negativa (perdiste poder de compra aunque tengas más pesos o dólares que al principio).',
        selector: '[data-guia="kpi-inflacion-ars"]',
        slot: 'kpis',
      },
    ],
  },
  {
    titulo: 'Cómo leer el gráfico principal',
    items: [
      {
        term: 'Patrimonio, ganancias nominales y ganancias reales',
        texto: 'Son tres formas distintas de mirar la misma evolución de tu inversión, mes a mes:\n\n• Patrimonio: cuánto vale tu inversión en total en cada mes, en moneda corriente (sin descontar inflación). Es el número "en bruto".\n\n• Ganancias nominales: patrimonio menos el monto invertido — cuánto ganaste (o perdiste) en pesos o dólares desde el arranque, sin ajustar por inflación.\n\n• Ganancias reales: lo mismo, pero descontando la inflación acumulada hasta ese mes. Responde la pregunta que realmente importa: ¿aumentó tu poder de compra, o solo tenés más billetes que valen menos?\n\nPor ejemplo: si invertiste $100.000 y a los 12 meses tu patrimonio es $130.000, tu ganancia nominal es $30.000 (30%). Pero si en ese mismo período la inflación acumulada fue 40%, en términos reales perdiste poder de compra aunque nominalmente "ganaste" plata.',
        selector: '[data-guia="panel-metricas"]',
        slot: 'panel-portfolio',
      },
      {
        term: 'Los tres escenarios (Favorable, Moderado, Desfavorable)',
        texto: 'Nadie sabe con certeza cómo se va a mover el mercado ni cuánta inflación va a haber, así que la simulación no asume un solo futuro: corre miles de escenarios posibles agrupados en tres familias de supuestos de inflación — favorable (inflación más baja), moderado y desfavorable (inflación más alta) — manteniendo el mismo comportamiento de mercado.\n\nConviene no quedarte mirando solo el escenario que más te gusta: comparar los tres te da una idea de qué tan sensible es tu resultado a que la macro te acompañe o te complique, en vez de anclarte a una sola expectativa.',
        selector: '[data-guia="panel-escenarios"]',
        slot: 'panel-portfolio',
      },
      {
        term: 'La banda sombreada (p25–p75) y las líneas de mínimo/máximo',
        texto: 'Dentro de cada escenario, la simulación corre muchísimas corridas posibles y no todas terminan igual. Para no mostrarte un solo número engañosamente preciso, el gráfico ordena todos esos resultados posibles de menor a mayor y te muestra un rango: el área sombreada (la "banda") va desde el percentil 25 (el valor que superó al 25% de las corridas más bajas) hasta el percentil 75 (el que superó al 75%). En criollo: ahí cayó el 50% central de todas las simulaciones, ni las más pesimistas ni las más optimistas.\n\nLas líneas tenues por arriba y por abajo de la banda marcan el mínimo y el máximo absolutos que se llegaron a simular — los extremos, útiles como referencia de "qué tan mal o qué tan bien podría llegar a salir", aunque sean mucho menos probables que quedar dentro de la banda.',
        selector: '[data-guia="panel-grafico"]',
        slot: 'panel-portfolio',
      },
      {
        term: 'La línea de punto de equilibrio',
        texto: 'Es una línea horizontal de referencia que marca "ni ganaste ni perdiste". En el gráfico de patrimonio, esa línea está a la altura del monto invertido: si la curva está por encima, en ese mes tu inversión vale más de lo que pusiste; por debajo, vale menos. En los gráficos de ganancias (nominales o reales) el punto de equilibrio es directamente cero, por la misma razón.\n\nSirve para ver de un vistazo, sin hacer cuentas, en qué escenarios y en qué momento tu inversión cruza de pérdida a ganancia (o al revés).',
        selector: '[data-guia="panel-grafico"]',
        slot: 'panel-portfolio',
      },
      {
        term: 'La zona sombreada de capital vencido',
        texto: 'Cuando un plazo fijo, bono o letra llega a su vencimiento dentro del horizonte simulado, su capital no se reinvierte solo — la simulación lo deja "parado" ahí, esperando una decisión tuya sobre qué hacer con esa plata. Por eso, a partir del mes de vencimiento (marcado con una línea vertical), vas a ver que el patrimonio y las ganancias nominales de ese instrumento dejan de moverse: quedan planchados.\n\nOjo con las ganancias reales en esa misma zona: aunque el número nominal esté congelado, la inflación sigue corriendo, así que las ganancias reales pueden seguir cayendo después del vencimiento — ese capital inmóvil sigue perdiendo poder de compra mientras no se reinvierte.',
        selector: '[data-guia="panel-grafico"]',
        slot: 'panel-portfolio',
      },
      {
        term: 'Comparar nominal vs. real - Para activarlo debes tener seleccionado un único ámbito y la métrica de ganancias',
        texto: 'Es un modo del gráfico que superpone, para el mismo instrumento o portfolio, la curva de ganancias nominales y la de ganancias reales una al lado de la otra (con sus propias bandas p25–p75). Es la forma más directa de ver, para tu caso puntual, cuánta diferencia hace la inflación entre "lo que parece que ganaste" y "lo que efectivamente ganaste en poder de compra" — sobre todo útil cuando esa diferencia es grande o cuando una de las dos curvas cruza el cero y la otra no.',
        selector: '[data-guia="panel-nominal-real"]',
        slot: 'panel-portfolio',
      },
    ],
  },
  {
    titulo: 'Los gráficos por instrumento',
    items: [
      {
        term: 'Instrumentos (ARS)',
        texto: 'Este gráfico muestra exactamente la misma información que el de Portfolio de más arriba —patrimonio, ganancias nominales/reales, escenarios, banda p25–p75, punto de equilibrio, todo lo que ya vimos— pero en vez de mostrarte el total del portfolio, te deja elegir y customizar qué instrumento (o instrumentos) en pesos mirar: plazos fijos en ARS, bonos, letras o acciones que cotizan en pesos.\n\nUsá los botones de arriba del gráfico para elegir uno o varios instrumentos a la vez y ver cómo se comportó cada uno por separado, en vez de solo el total agregado. Sirve para entender, por ejemplo, si un instrumento puntual tuvo un desempeño muy distinto al resto o si está arrastrando el resultado del portfolio.',
        selector: '[data-guia="panel-instrumentos-ars"]',
        slot: 'panel-instrumentos-ars',
      },
      {
        term: 'Instrumentos (USD)',
        texto: 'Igual que el de Instrumentos (ARS), pero para tus instrumentos denominados en dólares: plazos fijos en USD, bonos o letras que cotizan en dólares. Muestra las mismas métricas (patrimonio, ganancias nominales/reales, escenarios, banda, punto de equilibrio) que el gráfico de Portfolio, pero customizado a nivel de instrumento individual en vez del total.\n\nUsá los botones de arriba para elegir qué instrumento en dólares mirar y comparar su comportamiento particular contra el resto de tu portfolio en USD.',
        selector: '[data-guia="panel-instrumentos-usd"]',
        slot: 'panel-instrumentos-usd',
      },
    ],
  },
  {
    titulo: 'El gráfico de inflación',
    items: [
      {
        term: 'Mensual vs. acumulada, ARS vs. USD',
        texto: 'Estos cuatro mini-gráficos muestran la inflación que asumió la simulación, no el resultado de tu inversión. "Mensual" es cuánto subieron los precios en cada mes puntual (sube y baja de mes a mes); "acumulada" es cuánto subieron en total desde el arranque hasta ese mes — siempre creciente, porque acumula todos los meses anteriores.\n\nSe muestran por separado en pesos (ARS) y en dólares (USD) porque son procesos independientes en el modelo: la inflación en dólares (inflación del propio dólar, no el tipo de cambio) suele ser mucho más baja y estable que la inflación en pesos, y cada una afecta de forma distinta a los instrumentos según en qué moneda estén denominados.',
        selector: '[data-guia="grafico-inflacion"]',
        slot: 'grafico-inflacion',
      },
    ],
  },
  {
    titulo: 'La tabla de percentiles',
    items: [
      {
        term: 'Qué es un percentil y cómo usar el rango p25–p75',
        texto: 'Esta tabla resume, para el último mes del horizonte, los mismos percentiles que ves sombreados en el gráfico (p25, mediana, p75) pero en formato de números concretos en vez de curva. Un percentil es simplemente una forma de ordenar resultados: el percentil 25 de "patrimonio final" es el valor que superaron el 75% de las simulaciones (y que no alcanzó el 25% más flojo); el percentil 75 es al revés.\n\nEn vez de fijarte solo en la mediana como si fuera "el" resultado, es más realista pensar en un rango: el p25 te da una idea de un escenario razonablemente conservador dentro de lo simulado, y el p75 de uno razonablemente favorable — sin irte a los extremos absolutos (mínimo/máximo), que son mucho menos probables. Planificar pensando en ese rango, en vez de en un único número, ayuda a no llevarte una sorpresa si las cosas salen un poco peor de lo esperado.',
        selector: '[data-guia="tabla-percentiles"]',
        slot: 'tabla-percentiles',
      },
    ],
  },
  {
    titulo: 'Rangos de inflación usados en esta corrida',
    items: [
      {
        term: 'Rangos de inflación mensual (ARS / USD)',
        texto: 'Es una foto de los supuestos de inflación mensual (en ARS y en USD) que se usaron para cada escenario en el momento en que corriste esta simulación puntual — no un dato que se actualiza solo. Cada escenario (favorable, moderado, desfavorable) tiene su propio rango de inflación mensual asumida, y la simulación sorteó valores dentro de esos rangos mes a mes para armar las miles de corridas que ves resumidas en los gráficos de arriba.\n\nTe sirve como referencia para entender exactamente qué se asumió al calcular estos resultados: si más adelante las expectativas de inflación cambian, esta tabla no se actualiza — seguirá mostrando los rangos con los que se corrió esta simulación en particular, no los valores más recientes del mercado.',
        selector: '[data-guia="rangos-inflacion"]',
        slot: 'rangos-inflacion',
      },
    ],
  },
]
