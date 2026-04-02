BEGIN;

ALTER TABLE providers
    ADD COLUMN IF NOT EXISTS platform_display_enabled BOOLEAN NOT NULL DEFAULT TRUE,
    ADD COLUMN IF NOT EXISTS merchant_display_enabled BOOLEAN NOT NULL DEFAULT TRUE;

UPDATE providers
SET platform_display_enabled = TRUE
WHERE platform_display_enabled IS NULL;

UPDATE providers
SET merchant_display_enabled = TRUE
WHERE merchant_display_enabled IS NULL;

ALTER TABLE material_shops
    ADD COLUMN IF NOT EXISTS platform_display_enabled BOOLEAN NOT NULL DEFAULT TRUE,
    ADD COLUMN IF NOT EXISTS merchant_display_enabled BOOLEAN NOT NULL DEFAULT TRUE;

UPDATE material_shops
SET platform_display_enabled = TRUE
WHERE platform_display_enabled IS NULL;

UPDATE material_shops
SET merchant_display_enabled = TRUE
WHERE merchant_display_enabled IS NULL;

COMMIT;
