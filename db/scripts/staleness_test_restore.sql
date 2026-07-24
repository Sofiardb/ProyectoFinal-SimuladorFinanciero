-- ============================================================================
-- Restaura los valores originales de GS / X30N6 / S30O6 después de probar la
-- feature de staleness de mercado. Corré esto una vez que termines de probar
-- Vista Comparativa (staleness_test_setup.sql debe haberse corrido antes).
--
-- Uso:
--   psql -d <tu_base> -f staleness_test_restore.sql
-- ============================================================================

-- Catálogo (siempre hace falta restaurarlo)
UPDATE accion a SET
    mu_retorno_esperado    = (SELECT valor::numeric FROM _backup_staleness_test WHERE tabla='accion' AND ticker=a.ticker AND campo='mu_retorno_esperado'),
    sigma_volatilidad      = (SELECT valor::numeric FROM _backup_staleness_test WHERE tabla='accion' AND ticker=a.ticker AND campo='sigma_volatilidad'),
    rho_correlacion_indice = (SELECT valor::numeric FROM _backup_staleness_test WHERE tabla='accion' AND ticker=a.ticker AND campo='rho_correlacion_indice'),
    precio_actual          = (SELECT valor::numeric FROM _backup_staleness_test WHERE tabla='accion' AND ticker=a.ticker AND campo='precio_actual')
WHERE a.ticker = 'GS';

UPDATE bono b SET
    tasa_descuento = (SELECT valor::numeric FROM _backup_staleness_test WHERE tabla='bono' AND ticker=b.ticker AND campo='tasa_descuento'),
    precio_actual  = (SELECT valor::numeric FROM _backup_staleness_test WHERE tabla='bono' AND ticker=b.ticker AND campo='precio_actual')
WHERE b.ticker = 'X30N6';

UPDATE letra l SET
    tasa          = (SELECT valor::numeric FROM _backup_staleness_test WHERE tabla='letra' AND ticker=l.ticker AND campo='tasa'),
    precio_actual = (SELECT valor::numeric FROM _backup_staleness_test WHERE tabla='letra' AND ticker=l.ticker AND campo='precio_actual')
WHERE l.ticker = 'S30O6';

-- Tenencia — solo tiene efecto si probaste "Actualizar pero sin simular" /
-- "Actualizar y simular" (que persisten). Si solo probaste "Mantener como
-- snapshot", estos UPDATE son no-ops (los valores no habían cambiado).
UPDATE portfolio_accion pa SET
    mu_retorno_esperado_compra    = (SELECT valor::numeric FROM _backup_staleness_test WHERE tabla='portfolio_accion' AND ticker='GS' AND campo='mu_retorno_esperado_compra'),
    sigma_volatilidad_compra      = (SELECT valor::numeric FROM _backup_staleness_test WHERE tabla='portfolio_accion' AND ticker='GS' AND campo='sigma_volatilidad_compra'),
    rho_correlacion_indice_compra = (SELECT valor::numeric FROM _backup_staleness_test WHERE tabla='portfolio_accion' AND ticker='GS' AND campo='rho_correlacion_indice_compra'),
    precio_compra                 = (SELECT valor::numeric FROM _backup_staleness_test WHERE tabla='portfolio_accion' AND ticker='GS' AND campo='precio_compra')
FROM accion a WHERE a.id_accion = pa.id_accion AND a.ticker = 'GS';

UPDATE portfolio_bono pb SET
    tasa_descuento_compra = (SELECT valor::numeric FROM _backup_staleness_test WHERE tabla='portfolio_bono' AND ticker='X30N6' AND campo='tasa_descuento_compra'),
    precio_compra         = (SELECT valor::numeric FROM _backup_staleness_test WHERE tabla='portfolio_bono' AND ticker='X30N6' AND campo='precio_compra')
FROM bono b WHERE b.id_bono = pb.id_bono AND b.ticker = 'X30N6';

UPDATE portfolio_letra pl SET
    tasa_compra   = (SELECT valor::numeric FROM _backup_staleness_test WHERE tabla='portfolio_letra' AND ticker='S30O6' AND campo='tasa_compra'),
    precio_compra = (SELECT valor::numeric FROM _backup_staleness_test WHERE tabla='portfolio_letra' AND ticker='S30O6' AND campo='precio_compra')
FROM letra l WHERE l.id_letra = pl.id_letra AND l.ticker = 'S30O6';

DROP TABLE _backup_staleness_test;

-- Verificación rápida de que quedó todo como al principio:
SELECT 'accion' AS tipo, ticker, mu_retorno_esperado, sigma_volatilidad, rho_correlacion_indice, precio_actual FROM accion WHERE ticker = 'GS'
UNION ALL
SELECT 'bono', ticker, tasa_descuento, NULL, NULL, precio_actual FROM bono WHERE ticker = 'X30N6'
UNION ALL
SELECT 'letra', ticker, tasa, NULL, NULL, precio_actual FROM letra WHERE ticker = 'S30O6';
