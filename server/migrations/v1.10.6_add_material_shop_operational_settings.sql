BEGIN;

ALTER TABLE material_shops
    ADD COLUMN IF NOT EXISTS service_area TEXT NOT NULL DEFAULT '[]',
    ADD COLUMN IF NOT EXISTS main_brands TEXT NOT NULL DEFAULT '[]',
    ADD COLUMN IF NOT EXISTS main_categories TEXT NOT NULL DEFAULT '[]',
    ADD COLUMN IF NOT EXISTS delivery_capability VARCHAR(200) NOT NULL DEFAULT '',
    ADD COLUMN IF NOT EXISTS installation_capability VARCHAR(200) NOT NULL DEFAULT '',
    ADD COLUMN IF NOT EXISTS after_sales_policy VARCHAR(500) NOT NULL DEFAULT '',
    ADD COLUMN IF NOT EXISTS invoice_capability VARCHAR(200) NOT NULL DEFAULT '';

CREATE TABLE IF NOT EXISTS material_shop_service_settings (
    id BIGSERIAL PRIMARY KEY,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
    shop_id BIGINT NOT NULL UNIQUE,
    accept_booking BOOLEAN NOT NULL DEFAULT TRUE,
    auto_confirm_hours INTEGER NOT NULL DEFAULT 24,
    service_styles TEXT NOT NULL DEFAULT '[]',
    service_packages TEXT NOT NULL DEFAULT '[]',
    price_range_min NUMERIC(12,2) NOT NULL DEFAULT 0,
    price_range_max NUMERIC(12,2) NOT NULL DEFAULT 0,
    response_time_desc VARCHAR(50) NOT NULL DEFAULT '',
    service_area TEXT NOT NULL DEFAULT '[]',
    main_brands TEXT NOT NULL DEFAULT '[]',
    main_categories TEXT NOT NULL DEFAULT '[]',
    delivery_capability VARCHAR(200) NOT NULL DEFAULT '',
    installation_capability VARCHAR(200) NOT NULL DEFAULT '',
    after_sales_policy VARCHAR(500) NOT NULL DEFAULT '',
    invoice_capability VARCHAR(200) NOT NULL DEFAULT ''
);

CREATE INDEX IF NOT EXISTS idx_material_shop_service_settings_shop_id
    ON material_shop_service_settings(shop_id);

COMMIT;
