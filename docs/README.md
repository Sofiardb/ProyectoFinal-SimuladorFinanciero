# Documentación del proyecto — Simulador Financiero

**Proyecto Final — Ingeniería en Informática — FACET — UNT**  
**Autora:** Sofía Rodríguez del Busto  
**Tutor:** Daniel Horacio Melucci

---

## Descripción general

Aplicación web que permite simular y comparar carteras de inversión bajo múltiples escenarios económicos. Utiliza simulación Monte Carlo estratificada y modelos probabilísticos para cuantificar el impacto del riesgo en la evolución del patrimonio a lo largo del tiempo.

Los instrumentos soportados son: acciones (mercado estadounidense), bonos soberanos, letras del Tesoro y plazos fijos (mercado argentino).

---

## Contenido de esta carpeta

| Archivo | Contenido |
|---|---|
| [01-modelos-financieros.md](01-modelos-financieros.md) | Modelo matemático de cada instrumento: GBM para acciones, DCF para bonos, interés simple para letras, capitalización compuesta para plazos fijos. Justificación de cada fórmula, suposiciones adoptadas y coherencia con la propuesta. |
| [02-orquestador-montecarlo.md](02-orquestador-montecarlo.md) | Diseño del motor de simulación Monte Carlo: semilla y reproducibilidad, escenarios económicos, pre-generación de aleatoriedad, modelo de correlaciones, vectorización, métricas estadísticas, separación de portfolios ARS/USD. |
| [03-base-datos.md](03-base-datos.md) | Decisiones del esquema PostgreSQL: estructura de tablas de portfolio, persistencia de resultados, reproducibilidad por semilla, manejo de métricas desagregadas por escenario. |

La arquitectura general del sistema y las decisiones de stack tecnológico se encuentran en el [README.md raíz](../README.md).

---

