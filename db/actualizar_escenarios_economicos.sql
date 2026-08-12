-- =============================================================================
--  ACTUALIZAR RANGOS DE INFLACIÓN (escenario_economico)
-- =============================================================================
--  Uso: completar los 3 renglones del bloque VALUES de abajo con los nuevos
--  rangos mensuales (forma decimal — 0.03 = 3%) y ejecutar contra la base que
--  corresponda (dev, producción, etc). No hace falta tocar nada más del script.
--
--  Es seguro ejecutarlo más de una vez y con cualquier subconjunto de cambios:
--  cada escenario se compara contra su valor vigente y solo se versiona
--  (cierra el anterior + inserta uno nuevo) si realmente cambió algo.
--
--  Las simulaciones ya corridas no se ven afectadas por este script — se leen
--  desde su propio snapshot en simulacion_parametro_escenario, no desde
--  escenario_economico (ver comentario de esa tabla en 01_schema.sql).
-- =============================================================================

BEGIN;

WITH valores_nuevos (codigo, inflacion_mensual_min, inflacion_mensual_max,
                      inflacion_mensual_min_usd, inflacion_mensual_max_usd) AS (
    VALUES
        -- ── EDITAR ACÁ ──────────────────────────────────────────────────────
        ('FAVORABLE',    0.005::numeric, 0.015::numeric, 0.000::numeric, 0.002::numeric),
        ('MODERADO',     0.015::numeric, 0.030::numeric, 0.002::numeric, 0.004::numeric),
        ('DESFAVORABLE', 0.030::numeric, 0.060::numeric, 0.004::numeric, 0.008::numeric)
        -- ────────────────────────────────────────────────────────────────────
),
vigentes AS (
    SELECT * FROM escenario_economico WHERE vigente_hasta IS NULL
),
a_actualizar AS (
    SELECT te.id_tipo_escenario,
           vn.inflacion_mensual_min, vn.inflacion_mensual_max,
           vn.inflacion_mensual_min_usd, vn.inflacion_mensual_max_usd
    FROM valores_nuevos vn
    JOIN tipo_escenario te ON te.codigo = vn.codigo
    JOIN vigentes v ON v.id_tipo_escenario = te.id_tipo_escenario
    WHERE v.inflacion_mensual_min <> vn.inflacion_mensual_min
       OR v.inflacion_mensual_max <> vn.inflacion_mensual_max
       OR v.inflacion_mensual_min_usd <> vn.inflacion_mensual_min_usd
       OR v.inflacion_mensual_max_usd <> vn.inflacion_mensual_max_usd
),
cierre AS (
    UPDATE escenario_economico ee
    SET vigente_hasta = CURRENT_DATE - INTERVAL '1 day'
    FROM a_actualizar au
    WHERE ee.id_tipo_escenario = au.id_tipo_escenario
      AND ee.vigente_hasta IS NULL
    RETURNING ee.id_tipo_escenario
)
INSERT INTO escenario_economico
    (id_tipo_escenario, inflacion_mensual_min, inflacion_mensual_max,
     inflacion_mensual_min_usd, inflacion_mensual_max_usd, vigente_desde)
SELECT au.id_tipo_escenario, au.inflacion_mensual_min, au.inflacion_mensual_max,
       au.inflacion_mensual_min_usd, au.inflacion_mensual_max_usd, CURRENT_DATE
FROM a_actualizar au
JOIN cierre c ON c.id_tipo_escenario = au.id_tipo_escenario;

COMMIT;

-- Verificación: debería mostrar exactamente 3 filas (una por tipo_escenario),
-- todas con los valores nuevos.
-- SELECT te.codigo, ee.*
-- FROM escenario_economico ee
-- JOIN tipo_escenario te ON te.id_tipo_escenario = ee.id_tipo_escenario
-- WHERE ee.vigente_hasta IS NULL
-- ORDER BY te.id_tipo_escenario;
