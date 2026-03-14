-- v1.6.9: 高风险链路 schema 补洞（幂等）
-- 目的：
-- 1) 补齐 merchant_applications / providers / material_shop_* 真实业务依赖但历史漏迁的列
-- 2) 补齐 sms_audit_logs 扩展字段
-- 3) 为本地、测试、预发、生产提供统一高风险链路补洞入口
-- 注意：本迁移仅覆盖高风险写入链路真实依赖的关键列，不做全库重建

BEGIN;

-- ---------------------------------------------------------------------------
-- 1. merchant_applications：高风险写入链路依赖列
-- ---------------------------------------------------------------------------
ALTER TABLE merchant_applications
    ADD COLUMN IF NOT EXISTS team_size INTEGER DEFAULT 1,
    ADD COLUMN IF NOT EXISTS office_address VARCHAR(200) DEFAULT '',
    ADD COLUMN IF NOT EXISTS service_area TEXT DEFAULT '[]',
    ADD COLUMN IF NOT EXISTS styles TEXT DEFAULT '[]',
    ADD COLUMN IF NOT EXISTS introduction TEXT DEFAULT '',
    ADD COLUMN IF NOT EXISTS portfolio_cases TEXT DEFAULT '[]',
    ADD COLUMN IF NOT EXISTS user_id BIGINT DEFAULT 0,
    ADD COLUMN IF NOT EXISTS provider_id BIGINT DEFAULT 0;

COMMENT ON COLUMN merchant_applications.team_size IS '团队规模';
COMMENT ON COLUMN merchant_applications.office_address IS '办公地址';
COMMENT ON COLUMN merchant_applications.service_area IS '服务区域（JSON数组）';
COMMENT ON COLUMN merchant_applications.styles IS '擅长风格（JSON数组）';
COMMENT ON COLUMN merchant_applications.introduction IS '个人/公司简介';
COMMENT ON COLUMN merchant_applications.portfolio_cases IS '代表案例（JSON数组）';
COMMENT ON COLUMN merchant_applications.user_id IS '关联用户ID（审核通过后填充）';
COMMENT ON COLUMN merchant_applications.provider_id IS '关联服务商ID（审核通过后填充）';

-- ---------------------------------------------------------------------------
-- 2. providers：高风险写入链路依赖列
-- ---------------------------------------------------------------------------
ALTER TABLE providers
    ADD COLUMN IF NOT EXISTS service_area TEXT DEFAULT '[]',
    ADD COLUMN IF NOT EXISTS service_intro TEXT DEFAULT '',
    ADD COLUMN IF NOT EXISTS team_size INTEGER DEFAULT 1,
    ADD COLUMN IF NOT EXISTS office_address VARCHAR(200) DEFAULT '',
    ADD COLUMN IF NOT EXISTS followers_count INTEGER DEFAULT 0,
    ADD COLUMN IF NOT EXISTS established_year INTEGER DEFAULT 2020,
    ADD COLUMN IF NOT EXISTS certifications TEXT DEFAULT '[]',
    ADD COLUMN IF NOT EXISTS cover_image VARCHAR(500) DEFAULT '';

COMMENT ON COLUMN providers.service_area IS '服务区域（JSON数组）';
COMMENT ON COLUMN providers.service_intro IS '服务介绍';
COMMENT ON COLUMN providers.team_size IS '团队规模';
COMMENT ON COLUMN providers.office_address IS '办公地址';
COMMENT ON COLUMN providers.followers_count IS '粉丝/关注数';
COMMENT ON COLUMN providers.established_year IS '成立年份';
COMMENT ON COLUMN providers.certifications IS '资质认证（JSON数组）';
COMMENT ON COLUMN providers.cover_image IS '封面背景图';

-- ---------------------------------------------------------------------------
-- 3. material_shop_applications：营业时间 JSON 列
-- ---------------------------------------------------------------------------
ALTER TABLE material_shop_applications
    ADD COLUMN IF NOT EXISTS business_hours_json TEXT DEFAULT '[]';

COMMENT ON COLUMN material_shop_applications.business_hours_json IS '营业时间（JSON数组）';

-- ---------------------------------------------------------------------------
-- 4. material_shops：营业时间 JSON 列
-- ---------------------------------------------------------------------------
ALTER TABLE material_shops
    ADD COLUMN IF NOT EXISTS business_hours_json TEXT DEFAULT '[]';

COMMENT ON COLUMN material_shops.business_hours_json IS '营业时间（JSON数组）';

-- ---------------------------------------------------------------------------
-- 5. material_shop_application_products：unit 列
-- ---------------------------------------------------------------------------
ALTER TABLE material_shop_application_products
    ADD COLUMN IF NOT EXISTS unit VARCHAR(20) DEFAULT '';

COMMENT ON COLUMN material_shop_application_products.unit IS '商品单位';

-- ---------------------------------------------------------------------------
-- 6. material_shop_products：unit + description 列
-- ---------------------------------------------------------------------------
ALTER TABLE material_shop_products
    ADD COLUMN IF NOT EXISTS unit VARCHAR(20) DEFAULT '',
    ADD COLUMN IF NOT EXISTS description TEXT DEFAULT '';

COMMENT ON COLUMN material_shop_products.unit IS '商品单位';
COMMENT ON COLUMN material_shop_products.description IS '商品描述';

-- ---------------------------------------------------------------------------
-- 7. sms_audit_logs：扩展审计字段
-- ---------------------------------------------------------------------------
-- 注意：v1.6.7 已创建这些字段，此处保留以保证幂等性
ALTER TABLE sms_audit_logs
    ADD COLUMN IF NOT EXISTS risk_tier VARCHAR(16) NOT NULL DEFAULT '',
    ADD COLUMN IF NOT EXISTS template_key VARCHAR(64) NOT NULL DEFAULT '',
    ADD COLUMN IF NOT EXISTS template_code VARCHAR(128) NOT NULL DEFAULT '';

COMMENT ON COLUMN sms_audit_logs.risk_tier IS '短信业务场景对应的风险等级';
COMMENT ON COLUMN sms_audit_logs.template_key IS '实际模板命中来源（purpose/risk/default）';
COMMENT ON COLUMN sms_audit_logs.template_code IS '实际下发模板编码';

COMMIT;
