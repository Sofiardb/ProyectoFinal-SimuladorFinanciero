-- ============================================================================
-- Setup para probar manualmente la feature de plazo fijo vencido (docs/10).
-- La UI (y ValidarFechaInicio en el backend) no dejan elegir una fecha_inicio
-- pasada ni al agregar ni al editar, así que para probar el badge "Vencido",
-- el indicador "Capital hoy" y el botón "Renovar" hace falta backdatear la
-- fecha directo en la base — no hay forma de llegar a ese estado por la API.
--
-- Uso:
--   1. Desde la UI, agregá un plazo fijo de prueba en el portfolio que quieras
--      usar, con entidadFinanciera = 'PLAZO FIJO PRUEBA' (o ajustá el valor
--      en este script si preferís otro nombre).
--   2. psql -d <tu_base> -f plazo_fijo_test_setup.sql
--   3. Recargá el detalle del portfolio:
--        - Debería aparecer el badge "Vencido" en la fila.
--        - El botón "Renovar" abre un diálogo con el desglose de interés
--          devengado; al confirmar, la fila queda vigente de nuevo con
--          fechaInicio = hoy y el monto actualizado.
--   4. "Nueva simulación" para ese portfolio debería seguir bloqueada
--      (422, mismo mensaje que bono/letra vencidos) hasta que renueves o
--      elimines la tenencia — esa parte de la regla no cambió.
--   5. Cuando termines, correr plazo_fijo_test_restore.sql.
--
-- Para probar en cambio el caso "vigente con fecha_inicio pasada" (indicador
-- pasivo "Capital hoy" + fix de capital devengado en la simulación, sin
-- bloqueo), comentá el UPDATE "Caso: vencido" de abajo y descomentá el de
-- "Caso: vigente".
-- ============================================================================

-- 1) Backup — solo los campos que este script toca.
CREATE TABLE _backup_plazo_fijo_test (
    id_portfolio_plazo_fijo BIGINT PRIMARY KEY,
    fecha_inicio            DATE,
    duracion_dias           SMALLINT,
    monto_invertido         NUMERIC(20,6)
);

INSERT INTO _backup_plazo_fijo_test
SELECT id_portfolio_plazo_fijo, fecha_inicio, duracion_dias, monto_invertido
FROM portfolio_plazo_fijo
WHERE entidad_financiera = 'PLAZO FIJO PRUEBA';

-- 2) Caso: vencido (badge "Vencido" + botón "Renovar").
UPDATE portfolio_plazo_fijo
SET fecha_inicio  = CURRENT_DATE - INTERVAL '90 days',
    duracion_dias = 60
WHERE entidad_financiera = 'PLAZO FIJO PRUEBA';

-- Caso: vigente con fecha_inicio pasada (indicador "Capital hoy" + fix de
-- capital devengado en la simulación, sin bloqueo). Comentá el UPDATE de
-- arriba y descomentá este si es lo que querés probar en su lugar.
-- UPDATE portfolio_plazo_fijo
-- SET fecha_inicio = CURRENT_DATE - INTERVAL '6 months'
-- WHERE entidad_financiera = 'PLAZO FIJO PRUEBA';

-- Verificación rápida de lo que quedó:
SELECT id_portfolio_plazo_fijo, entidad_financiera, fecha_inicio, duracion_dias,
       fecha_inicio + duracion_dias AS fecha_vencimiento, monto_invertido
FROM portfolio_plazo_fijo
WHERE entidad_financiera = 'PLAZO FIJO PRUEBA';
