-- v1.6.4: 认证 + 商家入驻 schema 对齐修复（幂等）
-- 目的：
-- 1) 修复 users / sms_audit_logs / merchant onboarding 历史环境漏迁移
-- 2) 为本地、测试、预发、生产提供统一补洞入口

BEGIN;

-- ---------------------------------------------------------------------------
-- 1. users: public_id + 登录审计字段
-- ---------------------------------------------------------------------------
ALTER TABLE users
    ADD COLUMN IF NOT EXISTS public_id VARCHAR(36),
    ADD COLUMN IF NOT EXISTS last_login_at TIMESTAMP,
    ADD COLUMN IF NOT EXISTS last_login_ip VARCHAR(50);

UPDATE users
SET public_id = md5(random()::text || clock_timestamp()::text || id::text)
WHERE coalesce(trim(public_id), '') = '';

ALTER TABLE users
    ALTER COLUMN public_id SET DEFAULT md5(random()::text || clock_timestamp()::text),
    ALTER COLUMN public_id SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_users_public_id ON users(public_id);

COMMENT ON COLUMN users.public_id IS '对外公开用户标识（不可枚举），内部主键仍为 id';
COMMENT ON COLUMN users.last_login_at IS '最后登录时间';
COMMENT ON COLUMN users.last_login_ip IS '最后登录IP';

-- ---------------------------------------------------------------------------
-- 2. sms_audit_logs: 短信审计落库
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS sms_audit_logs (
    id BIGSERIAL PRIMARY KEY,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
    request_id VARCHAR(64) NOT NULL,
    purpose VARCHAR(32) NOT NULL DEFAULT '',
    phone_hash VARCHAR(64) NOT NULL DEFAULT '',
    client_ip VARCHAR(64) NOT NULL DEFAULT '',
    provider VARCHAR(32) NOT NULL DEFAULT '',
    message_id VARCHAR(128) NOT NULL DEFAULT '',
    provider_request_id VARCHAR(128) NOT NULL DEFAULT '',
    status VARCHAR(32) NOT NULL DEFAULT '',
    error_code VARCHAR(64) NOT NULL DEFAULT '',
    error_message VARCHAR(500) NOT NULL DEFAULT ''
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_sms_audit_logs_request_id ON sms_audit_logs(request_id);
CREATE INDEX IF NOT EXISTS idx_sms_audit_logs_created_at ON sms_audit_logs(created_at);
CREATE INDEX IF NOT EXISTS idx_sms_audit_logs_purpose ON sms_audit_logs(purpose);
CREATE INDEX IF NOT EXISTS idx_sms_audit_logs_status ON sms_audit_logs(status);
CREATE INDEX IF NOT EXISTS idx_sms_audit_logs_phone_hash ON sms_audit_logs(phone_hash);

COMMENT ON TABLE sms_audit_logs IS '短信发送审计日志（不落明文手机号）';
COMMENT ON COLUMN sms_audit_logs.request_id IS '请求唯一标识，用于接口追踪';
COMMENT ON COLUMN sms_audit_logs.purpose IS '验证码场景';
COMMENT ON COLUMN sms_audit_logs.phone_hash IS '手机号哈希（不可逆）';
COMMENT ON COLUMN sms_audit_logs.status IS '发送状态 sent/send_failed/store_failed/risk_blocked/captcha_failed';

-- ---------------------------------------------------------------------------
-- 3. merchant_applications：统一商家入驻扩展字段
-- ---------------------------------------------------------------------------
ALTER TABLE merchant_applications
    ADD COLUMN IF NOT EXISTS role VARCHAR(20) DEFAULT '',
    ADD COLUMN IF NOT EXISTS entity_type VARCHAR(20) DEFAULT '',
    ADD COLUMN IF NOT EXISTS avatar VARCHAR(500) DEFAULT '',
    ADD COLUMN IF NOT EXISTS legal_person_name VARCHAR(50) DEFAULT '',
    ADD COLUMN IF NOT EXISTS legal_person_id_card_no VARCHAR(100) DEFAULT '',
    ADD COLUMN IF NOT EXISTS legal_person_id_card_front VARCHAR(500) DEFAULT '',
    ADD COLUMN IF NOT EXISTS legal_person_id_card_back VARCHAR(500) DEFAULT '',
    ADD COLUMN IF NOT EXISTS years_experience INTEGER DEFAULT 0,
    ADD COLUMN IF NOT EXISTS work_types TEXT DEFAULT '[]',
    ADD COLUMN IF NOT EXISTS highlight_tags TEXT DEFAULT '[]',
    ADD COLUMN IF NOT EXISTS pricing_json TEXT DEFAULT '{}',
    ADD COLUMN IF NOT EXISTS graduate_school VARCHAR(100) DEFAULT '',
    ADD COLUMN IF NOT EXISTS design_philosophy TEXT DEFAULT '',
    ADD COLUMN IF NOT EXISTS legal_acceptance_json TEXT DEFAULT '{}',
    ADD COLUMN IF NOT EXISTS legal_accepted_at TIMESTAMP NULL,
    ADD COLUMN IF NOT EXISTS legal_accept_source VARCHAR(50) DEFAULT 'merchant_web';

-- ---------------------------------------------------------------------------
-- 4. providers：统一商家入驻映射字段 + source_application_id
-- ---------------------------------------------------------------------------
ALTER TABLE providers
    ADD COLUMN IF NOT EXISTS entity_type VARCHAR(20) DEFAULT 'personal',
    ADD COLUMN IF NOT EXISTS work_types TEXT DEFAULT '[]',
    ADD COLUMN IF NOT EXISTS highlight_tags TEXT DEFAULT '[]',
    ADD COLUMN IF NOT EXISTS pricing_json TEXT DEFAULT '{}',
    ADD COLUMN IF NOT EXISTS graduate_school VARCHAR(100) DEFAULT '',
    ADD COLUMN IF NOT EXISTS design_philosophy TEXT DEFAULT '',
    ADD COLUMN IF NOT EXISTS avatar VARCHAR(500) DEFAULT '',
    ADD COLUMN IF NOT EXISTS source_application_id BIGINT DEFAULT 0;

ALTER TABLE providers
    ALTER COLUMN work_types TYPE TEXT;

CREATE INDEX IF NOT EXISTS idx_providers_source_application_id ON providers(source_application_id);

-- ---------------------------------------------------------------------------
-- 5. material_shops：统一商家入驻映射字段 + source_application_id
-- ---------------------------------------------------------------------------
ALTER TABLE material_shops
    ADD COLUMN IF NOT EXISTS user_id BIGINT DEFAULT 0,
    ADD COLUMN IF NOT EXISTS company_name VARCHAR(100) DEFAULT '',
    ADD COLUMN IF NOT EXISTS description TEXT DEFAULT '',
    ADD COLUMN IF NOT EXISTS business_license_no VARCHAR(50) DEFAULT '',
    ADD COLUMN IF NOT EXISTS business_license VARCHAR(500) DEFAULT '',
    ADD COLUMN IF NOT EXISTS legal_person_name VARCHAR(50) DEFAULT '',
    ADD COLUMN IF NOT EXISTS legal_person_id_card_no VARCHAR(100) DEFAULT '',
    ADD COLUMN IF NOT EXISTS legal_person_id_card_front VARCHAR(500) DEFAULT '',
    ADD COLUMN IF NOT EXISTS legal_person_id_card_back VARCHAR(500) DEFAULT '',
    ADD COLUMN IF NOT EXISTS contact_phone VARCHAR(20) DEFAULT '',
    ADD COLUMN IF NOT EXISTS contact_name VARCHAR(50) DEFAULT '',
    ADD COLUMN IF NOT EXISTS source_application_id BIGINT DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_material_shops_user_id ON material_shops(user_id);
CREATE INDEX IF NOT EXISTS idx_material_shops_source_application_id ON material_shops(source_application_id);

-- ---------------------------------------------------------------------------
-- 6. material_shop_applications：主材商入驻申请
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS material_shop_applications (
    id BIGSERIAL PRIMARY KEY,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
    user_id BIGINT NOT NULL DEFAULT 0,
    phone VARCHAR(20) NOT NULL,
    entity_type VARCHAR(20) NOT NULL DEFAULT 'company',
    shop_name VARCHAR(100) NOT NULL,
    shop_description TEXT DEFAULT '',
    company_name VARCHAR(100) DEFAULT '',
    business_license_no VARCHAR(50) NOT NULL DEFAULT '',
    business_license VARCHAR(500) NOT NULL DEFAULT '',
    legal_person_name VARCHAR(50) DEFAULT '',
    legal_person_id_card_no VARCHAR(100) DEFAULT '',
    legal_person_id_card_front VARCHAR(500) DEFAULT '',
    legal_person_id_card_back VARCHAR(500) DEFAULT '',
    business_hours VARCHAR(100) DEFAULT '',
    contact_phone VARCHAR(20) DEFAULT '',
    contact_name VARCHAR(50) DEFAULT '',
    address VARCHAR(300) DEFAULT '',
    legal_acceptance_json TEXT DEFAULT '{}',
    legal_accepted_at TIMESTAMP NULL,
    legal_accept_source VARCHAR(50) DEFAULT 'merchant_web',
    status SMALLINT NOT NULL DEFAULT 0,
    reject_reason VARCHAR(500) DEFAULT '',
    audited_by BIGINT NOT NULL DEFAULT 0,
    audited_at TIMESTAMP NULL,
    shop_id BIGINT NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_material_shop_applications_phone ON material_shop_applications(phone);
CREATE INDEX IF NOT EXISTS idx_material_shop_applications_user_id ON material_shop_applications(user_id);
CREATE INDEX IF NOT EXISTS idx_material_shop_applications_status ON material_shop_applications(status);

-- ---------------------------------------------------------------------------
-- 7. material_shop_application_products：主材商申请商品
-- ---------------------------------------------------------------------------
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

-- ---------------------------------------------------------------------------
-- 8. material_shop_products：主材商正式商品
-- ---------------------------------------------------------------------------
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

-- ---------------------------------------------------------------------------
-- 9. merchant_identity_change_applications：商家身份切换申请
-- ---------------------------------------------------------------------------
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
