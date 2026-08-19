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
| [02-orquestador-montecarlo.md](02-orquestador-montecarlo.md) | Diseño del motor de simulación Monte Carlo: generación de aleatoriedad y rol de la semilla como auditoría, escenarios económicos, modelo de correlaciones, vencimientos fuera del horizonte, vectorización, métricas estadísticas, separación de portfolios ARS/USD. |
| [03-base-datos.md](03-base-datos.md) | Decisiones del esquema PostgreSQL: tipos de datos exactos, persistencia de estadísticas en JSONB, snapshot de escenarios e instrumentos por corrida, restricciones de unicidad, parámetros GBM. |
| [04-apis-datos-mercado.md](04-apis-datos-mercado.md) | APIs externas de datos de mercado: BYMA Open Data (catálogo de letras, precio de subsoberanos), data912 (precio de bonos y letras), Docta Capital (TIR y flujos de bonos), Alpha Vantage (acciones USA y S&P 500). Endpoints, campos relevantes, filtros y derivación de parámetros del motor. |
| [05-backend-arquitectura.md](05-backend-arquitectura.md) | Arquitectura del backend .NET: selección de Dapper sobre EF Core, estructura de carpetas, lifetimes de inyección de dependencias, convenciones de Dapper, manejo de errores (GlobalExceptionHandler + Problem Details), autenticación JWT y roles, Swagger, CORS, cliente HTTP del motor. |
| [06-endpoints-api.md](06-endpoints-api.md) | Referencia completa de todos los endpoints REST: auth, catálogos de referencia, instrumentos, administración, portfolios (CRUD + tenencias), simulaciones. Incluye request/response, autenticación requerida y errores posibles por endpoint. |
| [07-portfolio-reglas-negocio.md](07-portfolio-reglas-negocio.md) | Modelo de dominio del portfolio: estructura cabecera/composición, unicidad por tipo de instrumento, restricciones del perfil de riesgo (sigma_max_accion), aislamiento por usuario (ownership), ciclo de vida, reglas de re-simulación y estado activo/archivado. |
| [08-integracion-motor.md](08-integracion-motor.md) | Integración con el motor Python: flujo completo del endpoint POST /simular, mapeo de cada tipo de instrumento al payload del motor, manejo de la semilla, validaciones previas, métricas agregadas de cabecera y persistencia transaccional. |
| [09-staleness-mercado.md](09-staleness-mercado.md) | Datos de mercado desactualizados al simular: snapshot de tasa/GBM en la tenencia, decisión global de portfolio (mantener / actualizar sin simular / actualizar y simular) vía la pantalla Vista Comparativa, y el mecanismo aparte para el tipo de cambio. |
| [10-plazo-fijo-vencido.md](10-plazo-fijo-vencido.md) | Un plazo fijo vencido bloquea la simulación con 422; el usuario puede eliminarlo o renovarlo desde el detalle del portfolio. Incluye el fix de cálculo que suma el interés ya devengado desde la fecha de inicio real. |
| [MANUAL_USUARIO.md](MANUAL_USUARIO.md) | Manual de usuario de InvestLab, orientado al usuario final (no técnico): primeros pasos, alta y gestión de portfolios, instrumentos disponibles en lenguaje llano, ejecución e interpretación de simulaciones, historial, casos especiales y glosario. Con capturas reales de la app. |

La arquitectura general del sistema y las decisiones de stack tecnológico se encuentran en el [README.md raíz](../README.md).

---

