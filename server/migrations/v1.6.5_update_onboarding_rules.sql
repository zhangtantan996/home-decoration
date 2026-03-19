-- v1.6.5: 入驻规则重构补充字段（幂等）
-- 目标：
-- 1. 服务商补充 company_album_json
-- 2. 主材商补充 business_hours_json + 商品 unit
-- 3. 停用 foreman work_types 的业务读写（物理列保留）
-- 4. 停用 params_json 的业务写入（物理列保留）

BEGIN;

ALTER TABLE merchant_applications
    ADD COLUMN IF NOT EXISTS company_album_json TEXT NOT NULL DEFAULT '[]';

ALTER TABLE providers
    ADD COLUMN IF NOT EXISTS company_album_json TEXT NOT NULL DEFAULT '[]';

ALTER TABLE material_shop_applications
    ADD COLUMN IF NOT EXISTS business_hours_json TEXT NOT NULL DEFAULT '[]';

ALTER TABLE material_shops
    ADD COLUMN IF NOT EXISTS business_hours_json TEXT NOT NULL DEFAULT '[]';

ALTER TABLE material_shop_application_products
    ADD COLUMN IF NOT EXISTS unit VARCHAR(20) NOT NULL DEFAULT '';

ALTER TABLE material_shop_products
    ADD COLUMN IF NOT EXISTS unit VARCHAR(20) NOT NULL DEFAULT '';

UPDATE merchant_applications
SET work_types = '[]'
WHERE lower(coalesce(role, '')) = 'foreman'
  AND coalesce(work_types, '') <> '[]';

UPDATE providers
SET work_types = ''
WHERE provider_type = 3
  AND coalesce(work_types, '') <> '';

UPDATE material_shop_application_products
SET params_json = '{}'
WHERE params_json IS NULL OR btrim(params_json) = '';

UPDATE material_shop_products
SET params_json = '{}'
WHERE params_json IS NULL OR btrim(params_json) = '';

COMMIT;
