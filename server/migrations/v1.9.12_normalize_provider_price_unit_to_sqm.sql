BEGIN;

ALTER TABLE providers
  ALTER COLUMN price_unit SET DEFAULT '元/㎡';

UPDATE providers
SET price_unit = '元/㎡'
WHERE price_unit IS DISTINCT FROM '元/㎡';

COMMIT;
