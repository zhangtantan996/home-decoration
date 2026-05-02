-- up
BEGIN;

ALTER TABLE regions
    ADD COLUMN IF NOT EXISTS service_enabled BOOLEAN NOT NULL DEFAULT FALSE;

CREATE INDEX IF NOT EXISTS idx_regions_level_enabled_service_parent
    ON regions (level, enabled, service_enabled, parent_code);

WITH open_provinces AS (
    SELECT DISTINCT TRIM(value) AS code
    FROM system_dictionaries
    WHERE category_code = 'open_service_provinces'
      AND enabled = TRUE
      AND TRIM(value) <> ''
)
UPDATE regions AS city
SET service_enabled = TRUE
FROM regions AS province
WHERE city.level = 2
  AND city.parent_code = province.code
  AND city.parent_code IN (SELECT code FROM open_provinces)
  AND city.enabled = TRUE
  AND province.enabled = TRUE;

WITH open_cities AS (
    SELECT DISTINCT TRIM(value) AS code
    FROM system_dictionaries
    WHERE category_code = 'open_service_cities'
      AND enabled = TRUE
      AND TRIM(value) <> ''
)
UPDATE regions AS city
SET service_enabled = TRUE
WHERE city.level = 2
  AND city.code IN (SELECT code FROM open_cities);

COMMIT;

-- down
-- no-op: this migration only adds compatibility column/index and backfills service flags.
