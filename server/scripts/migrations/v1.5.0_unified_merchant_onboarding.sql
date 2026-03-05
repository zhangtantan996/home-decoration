-- v1.5.0: 商家入驻与登录统一改版（服务商扩展 + 主材商独立入驻）
-- 执行方式:
-- psql -U postgres -d home_decoration -f server/scripts/migrations/v1.5.0_unified_merchant_onboarding.sql

BEGIN;

ALTER TABLE merchant_applications
    ADD COLUMN IF NOT EXISTS role VARCHAR(20) DEFAULT '',
    ADD COLUMN IF NOT EXISTS entity_type VARCHAR(20) DEFAULT '',
    ADD COLUMN IF NOT EXISTS highlight_tags TEXT DEFAULT '[]',
    ADD COLUMN IF NOT EXISTS pricing_json TEXT DEFAULT '{}',
    ADD COLUMN IF NOT EXISTS graduate_school VARCHAR(100) DEFAULT '',
    ADD COLUMN IF NOT EXISTS design_philosophy TEXT DEFAULT '';

ALTER TABLE providers
    ADD COLUMN IF NOT EXISTS entity_type VARCHAR(20) DEFAULT 'personal',
    ADD COLUMN IF NOT EXISTS highlight_tags TEXT DEFAULT '[]',
    ADD COLUMN IF NOT EXISTS pricing_json TEXT DEFAULT '{}',
    ADD COLUMN IF NOT EXISTS graduate_school VARCHAR(100) DEFAULT '',
    ADD COLUMN IF NOT EXISTS design_philosophy TEXT DEFAULT '';

ALTER TABLE providers
    ALTER COLUMN work_types TYPE TEXT;

ALTER TABLE material_shops
    ADD COLUMN IF NOT EXISTS user_id BIGINT DEFAULT 0,
    ADD COLUMN IF NOT EXISTS description TEXT DEFAULT '',
    ADD COLUMN IF NOT EXISTS business_license_no VARCHAR(50) DEFAULT '',
    ADD COLUMN IF NOT EXISTS business_license VARCHAR(500) DEFAULT '',
    ADD COLUMN IF NOT EXISTS contact_phone VARCHAR(20) DEFAULT '',
    ADD COLUMN IF NOT EXISTS contact_name VARCHAR(50) DEFAULT '';

CREATE INDEX IF NOT EXISTS idx_material_shops_user_id ON material_shops(user_id);

CREATE TABLE IF NOT EXISTS material_shop_applications (
    id BIGSERIAL PRIMARY KEY,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
    user_id BIGINT NOT NULL DEFAULT 0,
    phone VARCHAR(20) NOT NULL,
    entity_type VARCHAR(20) NOT NULL DEFAULT 'company',
    shop_name VARCHAR(100) NOT NULL,
    shop_description TEXT DEFAULT '',
    business_license_no VARCHAR(50) NOT NULL DEFAULT '',
    business_license VARCHAR(500) NOT NULL DEFAULT '',
    business_hours VARCHAR(100) DEFAULT '',
    contact_phone VARCHAR(20) DEFAULT '',
    contact_name VARCHAR(50) DEFAULT '',
    address VARCHAR(300) DEFAULT '',
    status SMALLINT NOT NULL DEFAULT 0,
    reject_reason VARCHAR(500) DEFAULT '',
    audited_by BIGINT NOT NULL DEFAULT 0,
    audited_at TIMESTAMP NULL,
    shop_id BIGINT NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_material_shop_applications_phone ON material_shop_applications(phone);
CREATE INDEX IF NOT EXISTS idx_material_shop_applications_user_id ON material_shop_applications(user_id);
CREATE INDEX IF NOT EXISTS idx_material_shop_applications_status ON material_shop_applications(status);

CREATE TABLE IF NOT EXISTS material_shop_application_products (
    id BIGSERIAL PRIMARY KEY,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
    application_id BIGINT NOT NULL,
    name VARCHAR(120) NOT NULL,
    params_json TEXT NOT NULL DEFAULT '{}',
    price NUMERIC(12, 2) NOT NULL DEFAULT 0,
    images_json TEXT NOT NULL DEFAULT '[]',
    sort_order INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_material_shop_application_products_app_id
    ON material_shop_application_products(application_id);

CREATE TABLE IF NOT EXISTS material_shop_products (
    id BIGSERIAL PRIMARY KEY,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
    shop_id BIGINT NOT NULL,
    name VARCHAR(120) NOT NULL,
    params_json TEXT NOT NULL DEFAULT '{}',
    price NUMERIC(12, 2) NOT NULL DEFAULT 0,
    images_json TEXT NOT NULL DEFAULT '[]',
    cover_image VARCHAR(500) DEFAULT '',
    status SMALLINT NOT NULL DEFAULT 1,
    sort_order INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_material_shop_products_shop_id ON material_shop_products(shop_id);

CREATE TABLE IF NOT EXISTS merchant_identity_change_applications (
    id BIGSERIAL PRIMARY KEY,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
    user_id BIGINT NOT NULL DEFAULT 0,
    phone VARCHAR(20) NOT NULL,
    "current_role" VARCHAR(20) NOT NULL DEFAULT '',
    target_role VARCHAR(20) NOT NULL DEFAULT '',
    target_entity VARCHAR(20) NOT NULL DEFAULT '',
    application_data TEXT NOT NULL DEFAULT '{}',
    status SMALLINT NOT NULL DEFAULT 0,
    reject_reason VARCHAR(500) DEFAULT '',
    reviewed_by BIGINT NOT NULL DEFAULT 0,
    reviewed_at TIMESTAMP NULL
);

CREATE INDEX IF NOT EXISTS idx_merchant_identity_change_apps_user_id
    ON merchant_identity_change_applications(user_id);
CREATE INDEX IF NOT EXISTS idx_merchant_identity_change_apps_phone
    ON merchant_identity_change_applications(phone);
CREATE INDEX IF NOT EXISTS idx_merchant_identity_change_apps_status
    ON merchant_identity_change_applications(status);

COMMIT;
