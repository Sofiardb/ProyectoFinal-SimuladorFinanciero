-- ============================================================================
-- Restaura fecha_inicio / duracion_dias / monto_invertido del plazo fijo de
-- prueba después de correr plazo_fijo_test_setup.sql (docs/10). Si probaste
-- "Renovar" y lo confirmaste, esto también deshace ese cambio (Renovar
-- también pisa esos mismos tres campos).
--
-- Uso:
--   psql -d <tu_base> -f plazo_fijo_test_restore.sql
-- ============================================================================

UPDATE portfolio_plazo_fijo pf SET
    fecha_inicio    = b.fecha_inicio,
    duracion_dias   = b.duracion_dias,
    monto_invertido = b.monto_invertido
FROM _backup_plazo_fijo_test b
WHERE pf.id_portfolio_plazo_fijo = b.id_portfolio_plazo_fijo;

DROP TABLE _backup_plazo_fijo_test;

-- Verificación rápida de que quedó como al principio:
SELECT id_portfolio_plazo_fijo, entidad_financiera, fecha_inicio, duracion_dias, monto_invertido
FROM portfolio_plazo_fijo
WHERE entidad_financiera = 'PLAZO FIJO PRUEBA';
