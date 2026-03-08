BEGIN;

ALTER TABLE providers
    ADD COLUMN IF NOT EXISTS source_application_id BIGINT DEFAULT 0;
CREATE INDEX IF NOT EXISTS idx_providers_source_application_id ON providers(source_application_id);

ALTER TABLE material_shops
    ADD COLUMN IF NOT EXISTS source_application_id BIGINT DEFAULT 0;
CREATE INDEX IF NOT EXISTS idx_material_shops_source_application_id ON material_shops(source_application_id);

COMMIT;
