-- 企业二要素核验结果字段：复用入驻申请表，不新增业务实体
ALTER TABLE merchant_applications
    ADD COLUMN IF NOT EXISTS license_verify_status VARCHAR(20),
    ADD COLUMN IF NOT EXISTS license_verify_provider VARCHAR(30),
    ADD COLUMN IF NOT EXISTS license_verify_request_id VARCHAR(100),
    ADD COLUMN IF NOT EXISTS license_verify_reason VARCHAR(200),
    ADD COLUMN IF NOT EXISTS license_hash VARCHAR(64),
    ADD COLUMN IF NOT EXISTS license_verified_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_merchant_applications_license_hash ON merchant_applications(license_hash);

ALTER TABLE material_shop_applications
    ADD COLUMN IF NOT EXISTS license_verify_status VARCHAR(20),
    ADD COLUMN IF NOT EXISTS license_verify_provider VARCHAR(30),
    ADD COLUMN IF NOT EXISTS license_verify_request_id VARCHAR(100),
    ADD COLUMN IF NOT EXISTS license_verify_reason VARCHAR(200),
    ADD COLUMN IF NOT EXISTS license_hash VARCHAR(64),
    ADD COLUMN IF NOT EXISTS license_verified_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_material_shop_applications_license_hash ON material_shop_applications(license_hash);
