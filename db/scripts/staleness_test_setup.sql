-- ============================================================================
-- Setup para probar manualmente la feature de staleness de mercado (docs/09).
-- Simula un "cambio de mercado" para GS (accion), X30N6 (bono) y S30O6 (letra)
-- sin depender de que la API externa devuelva datos distintos (mercado cerrado).
--
-- Uso:
--   psql -d <tu_base> -f staleness_test_setup.sql
--
-- Después de correr esto:
--   1. Ir a "Nueva simulación" para el portfolio que tiene estos 3 instrumentos.
--   2. Confirmar que aparece el banner de "datos de mercado más recientes".
--   3. Entrar a "Ver comparación" (Vista Comparativa) y probar las 3 acciones.
--   4. Cuando termines, correr staleness_test_restore.sql para dejar todo como estaba.
--
-- Nota: los tickers (GS / X30N6 / S30O6) son de ejemplo — ajustalos si tu
-- portfolio de prueba usa otros instrumentos.
-- ============================================================================

-- 1) Backup — captura los valores actuales de catálogo Y de la tenencia
--    (la tenencia hace falta solo si vas a probar "Actualizar", que persiste).
CREATE TABLE _backup_staleness_test (tabla text, ticker text, campo text, valor text);

INSERT INTO _backup_staleness_test
SELECT 'accion', ticker, 'mu_retorno_esperado', mu_retorno_esperado::text FROM accion WHERE ticker = 'GS'
UNION ALL SELECT 'accion', ticker, 'sigma_volatilidad', sigma_volatilidad::text FROM accion WHERE ticker = 'GS'
UNION ALL SELECT 'accion', ticker, 'rho_correlacion_indice', rho_correlacion_indice::text FROM accion WHERE ticker = 'GS'
UNION ALL SELECT 'accion', ticker, 'precio_actual', precio_actual::text FROM accion WHERE ticker = 'GS'
UNION ALL SELECT 'bono', ticker, 'tasa_descuento', tasa_descuento::text FROM bono WHERE ticker = 'X30N6'
UNION ALL SELECT 'bono', ticker, 'precio_actual', precio_actual::text FROM bono WHERE ticker = 'X30N6'
UNION ALL SELECT 'letra', ticker, 'tasa', tasa::text FROM letra WHERE ticker = 'S30O6'
UNION ALL SELECT 'letra', ticker, 'precio_actual', precio_actual::text FROM letra WHERE ticker = 'S30O6'
UNION ALL SELECT 'portfolio_accion', a.ticker, 'mu_retorno_esperado_compra', pa.mu_retorno_esperado_compra::text
    FROM portfolio_accion pa JOIN accion a ON a.id_accion = pa.id_accion WHERE a.ticker = 'GS'
UNION ALL SELECT 'portfolio_accion', a.ticker, 'sigma_volatilidad_compra', pa.sigma_volatilidad_compra::text
    FROM portfolio_accion pa JOIN accion a ON a.id_accion = pa.id_accion WHERE a.ticker = 'GS'
UNION ALL SELECT 'portfolio_accion', a.ticker, 'rho_correlacion_indice_compra', pa.rho_correlacion_indice_compra::text
    FROM portfolio_accion pa JOIN accion a ON a.id_accion = pa.id_accion WHERE a.ticker = 'GS'
UNION ALL SELECT 'portfolio_accion', a.ticker, 'precio_compra', pa.precio_compra::text
    FROM portfolio_accion pa JOIN accion a ON a.id_accion = pa.id_accion WHERE a.ticker = 'GS'
UNION ALL SELECT 'portfolio_bono', b.ticker, 'tasa_descuento_compra', pb.tasa_descuento_compra::text
    FROM portfolio_bono pb JOIN bono b ON b.id_bono = pb.id_bono WHERE b.ticker = 'X30N6'
UNION ALL SELECT 'portfolio_bono', b.ticker, 'precio_compra', pb.precio_compra::text
    FROM portfolio_bono pb JOIN bono b ON b.id_bono = pb.id_bono WHERE b.ticker = 'X30N6'
UNION ALL SELECT 'portfolio_letra', l.ticker, 'tasa_compra', pl.tasa_compra::text
    FROM portfolio_letra pl JOIN letra l ON l.id_letra = pl.id_letra WHERE l.ticker = 'S30O6'
UNION ALL SELECT 'portfolio_letra', l.ticker, 'precio_compra', pl.precio_compra::text
    FROM portfolio_letra pl JOIN letra l ON l.id_letra = pl.id_letra WHERE l.ticker = 'S30O6';

-- 2) Simular cambio de mercado — solo toca el catálogo, no la tenencia.
UPDATE accion SET
    mu_retorno_esperado     = mu_retorno_esperado * 1.15,
    sigma_volatilidad       = sigma_volatilidad * 1.20,
    rho_correlacion_indice  = LEAST(rho_correlacion_indice * 1.10, 0.95),
    precio_actual           = precio_actual * 1.05,
    fecha_precio_actual     = NOW(),
    fecha_estimacion_params = NOW()
WHERE ticker = 'GS';

UPDATE bono SET
    tasa_descuento      = tasa_descuento + 0.02,
    precio_actual       = precio_actual * 0.97,
    fecha_precio_actual = NOW()
WHERE ticker = 'X30N6';

UPDATE letra SET
    tasa                = tasa + 0.03,
    precio_actual       = precio_actual * 0.98,
    fecha_precio_actual = NOW()
WHERE ticker = 'S30O6';

-- Verificación rápida de lo que quedó:
SELECT 'accion' AS tipo, ticker, mu_retorno_esperado, sigma_volatilidad, rho_correlacion_indice, precio_actual FROM accion WHERE ticker = 'GS'
UNION ALL
SELECT 'bono', ticker, tasa_descuento, NULL, NULL, precio_actual FROM bono WHERE ticker = 'X30N6'
UNION ALL
SELECT 'letra', ticker, tasa, NULL, NULL, precio_actual FROM letra WHERE ticker = 'S30O6';
