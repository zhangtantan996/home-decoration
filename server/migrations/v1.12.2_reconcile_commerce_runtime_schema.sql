-- v1.12.2: 统一补齐用户侧公开列表 + 设计支付链路在历史环境中的 runtime schema 漂移
-- 目标：
-- 1) 修复 providers/material_shops 缺少 is_settled 等字段导致用户侧首页/找服务 500
-- 2) 修复 bookings/milestones/projects/payment_plans 等缺列导致退款/托管 cron 报错
-- 3) 补齐 proposals 与设计支付相关新表，避免设计链路在历史库上运行失败

-- ============================================
-- 1. Provider / MaterialShop 公开可见性与运行时字段
-- ============================================
ALTER TABLE providers
    ADD COLUMN IF NOT EXISTS survey_deposit_price NUMERIC DEFAULT 0,
    ADD COLUMN IF NOT EXISTS is_settled BOOLEAN DEFAULT TRUE,
    ADD COLUMN IF NOT EXISTS collected_source VARCHAR(200);

UPDATE providers
SET survey_deposit_price = 0
WHERE survey_deposit_price IS NULL;

UPDATE providers
SET is_settled = TRUE
WHERE is_settled IS NULL;

CREATE INDEX IF NOT EXISTS idx_providers_is_settled ON providers(is_settled);

ALTER TABLE material_shops
    ADD COLUMN IF NOT EXISTS service_area TEXT,
    ADD COLUMN IF NOT EXISTS main_brands TEXT,
    ADD COLUMN IF NOT EXISTS main_categories TEXT,
    ADD COLUMN IF NOT EXISTS delivery_capability VARCHAR(200),
    ADD COLUMN IF NOT EXISTS installation_capability VARCHAR(200),
    ADD COLUMN IF NOT EXISTS after_sales_policy VARCHAR(500),
    ADD COLUMN IF NOT EXISTS invoice_capability VARCHAR(200),
    ADD COLUMN IF NOT EXISTS is_settled BOOLEAN DEFAULT TRUE,
    ADD COLUMN IF NOT EXISTS collected_source VARCHAR(200);

UPDATE material_shops
SET is_settled = TRUE
WHERE is_settled IS NULL;

CREATE INDEX IF NOT EXISTS idx_material_shops_is_settled ON material_shops(is_settled);

-- ============================================
-- 2. Booking / Proposal 设计前链路字段
-- ============================================
ALTER TABLE bookings
    ADD COLUMN IF NOT EXISTS survey_deposit_source VARCHAR(50) DEFAULT '',
    ADD COLUMN IF NOT EXISTS survey_refund_notice TEXT DEFAULT '',
    ADD COLUMN IF NOT EXISTS survey_deposit DOUBLE PRECISION DEFAULT 0,
    ADD COLUMN IF NOT EXISTS survey_deposit_paid BOOLEAN DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS survey_deposit_paid_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS survey_deposit_converted BOOLEAN DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS survey_deposit_refunded BOOLEAN DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS survey_deposit_refund_amt DOUBLE PRECISION DEFAULT 0,
    ADD COLUMN IF NOT EXISTS survey_deposit_refund_at TIMESTAMPTZ;

ALTER TABLE proposals
    ADD COLUMN IF NOT EXISTS internal_draft_json TEXT DEFAULT '{}',
    ADD COLUMN IF NOT EXISTS preview_package_json TEXT DEFAULT '{}',
    ADD COLUMN IF NOT EXISTS delivery_package_json TEXT DEFAULT '{}';

-- ============================================
-- 3. 施工付款 / 托管释放字段
-- ============================================
ALTER TABLE milestones
    ADD COLUMN IF NOT EXISTS release_scheduled_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS released_at TIMESTAMPTZ;

ALTER TABLE projects
    ADD COLUMN IF NOT EXISTS construction_payment_mode VARCHAR(20) DEFAULT 'staged',
    ADD COLUMN IF NOT EXISTS payment_paused BOOLEAN DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS payment_paused_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS payment_paused_reason VARCHAR(200);

ALTER TABLE merchant_service_settings
    ADD COLUMN IF NOT EXISTS survey_deposit_amount DOUBLE PRECISION DEFAULT 0,
    ADD COLUMN IF NOT EXISTS design_payment_mode VARCHAR(20) DEFAULT '';

ALTER TABLE payment_plans
    ADD COLUMN IF NOT EXISTS milestone_id BIGINT DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_payment_plans_milestone_id ON payment_plans(milestone_id);

-- ============================================
-- 4. 设计支付相关新表
-- ============================================
CREATE TABLE IF NOT EXISTS design_working_docs (
    id BIGSERIAL PRIMARY KEY,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    booking_id BIGINT NOT NULL,
    provider_id BIGINT NOT NULL,
    doc_type VARCHAR(30) NOT NULL DEFAULT '',
    title VARCHAR(100) DEFAULT '',
    description TEXT DEFAULT '',
    files JSONB DEFAULT '[]'::jsonb,
    submitted_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_design_working_docs_booking ON design_working_docs(booking_id);
CREATE INDEX IF NOT EXISTS idx_design_working_docs_provider ON design_working_docs(provider_id);

CREATE TABLE IF NOT EXISTS design_fee_quotes (
    id BIGSERIAL PRIMARY KEY,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    booking_id BIGINT NOT NULL,
    provider_id BIGINT NOT NULL,
    total_fee DOUBLE PRECISION NOT NULL DEFAULT 0,
    deposit_deduction DOUBLE PRECISION DEFAULT 0,
    net_amount DOUBLE PRECISION NOT NULL DEFAULT 0,
    payment_mode VARCHAR(20) DEFAULT 'onetime',
    stages_json JSONB DEFAULT '[]'::jsonb,
    description TEXT DEFAULT '',
    status VARCHAR(20) DEFAULT 'pending',
    expire_at TIMESTAMPTZ,
    confirmed_at TIMESTAMPTZ,
    rejected_at TIMESTAMPTZ,
    rejection_reason VARCHAR(500) DEFAULT '',
    order_id BIGINT DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_design_fee_quotes_booking ON design_fee_quotes(booking_id);
CREATE INDEX IF NOT EXISTS idx_design_fee_quotes_provider ON design_fee_quotes(provider_id);
CREATE INDEX IF NOT EXISTS idx_design_fee_quotes_status ON design_fee_quotes(status);

CREATE TABLE IF NOT EXISTS design_deliverables (
    id BIGSERIAL PRIMARY KEY,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    booking_id BIGINT NOT NULL,
    project_id BIGINT DEFAULT 0,
    order_id BIGINT DEFAULT 0,
    provider_id BIGINT NOT NULL,
    color_floor_plan JSONB DEFAULT '[]'::jsonb,
    renderings JSONB DEFAULT '[]'::jsonb,
    rendering_link VARCHAR(500) DEFAULT '',
    text_description TEXT DEFAULT '',
    cad_drawings JSONB DEFAULT '[]'::jsonb,
    attachments JSONB DEFAULT '[]'::jsonb,
    status VARCHAR(20) DEFAULT 'draft',
    submitted_at TIMESTAMPTZ,
    accepted_at TIMESTAMPTZ,
    rejected_at TIMESTAMPTZ,
    rejection_reason VARCHAR(500) DEFAULT ''
);

CREATE INDEX IF NOT EXISTS idx_design_deliverables_booking ON design_deliverables(booking_id);
CREATE INDEX IF NOT EXISTS idx_design_deliverables_project ON design_deliverables(project_id);
CREATE INDEX IF NOT EXISTS idx_design_deliverables_provider ON design_deliverables(provider_id);

-- ============================================
-- 5. 运行时配置补齐
-- ============================================
INSERT INTO system_configs ("key", value, type, description, editable, created_at, updated_at)
SELECT 'booking.survey_deposit_default', '500', 'number', '量房定金默认金额（元）', TRUE, NOW(), NOW()
WHERE NOT EXISTS (SELECT 1 FROM system_configs WHERE "key" = 'booking.survey_deposit_default');

INSERT INTO system_configs ("key", value, type, description, editable, created_at, updated_at)
SELECT 'booking.survey_refund_notice',
       '量房完成后若不继续设计，默认退回 60% 给用户，剩余 40% 冻结待平台判定；若后续确认设计方案，量房定金转为设计费的一部分。',
       'string',
       '量房定金退款说明文案',
       TRUE,
       NOW(),
       NOW()
WHERE NOT EXISTS (SELECT 1 FROM system_configs WHERE "key" = 'booking.survey_refund_notice');

INSERT INTO system_configs ("key", value, type, description, editable, created_at, updated_at)
SELECT 'booking.survey_refund_user_percent', '60', 'number', '量房后终止时退给用户的百分比', TRUE, NOW(), NOW()
WHERE NOT EXISTS (SELECT 1 FROM system_configs WHERE "key" = 'booking.survey_refund_user_percent');

INSERT INTO system_configs ("key", value, type, description, editable, created_at, updated_at)
SELECT 'booking.survey_deposit_refund_rate', '0.6', 'number', '量房定金退款比例(不继续时退给用户的比例,0-1)', TRUE, NOW(), NOW()
WHERE NOT EXISTS (SELECT 1 FROM system_configs WHERE "key" = 'booking.survey_deposit_refund_rate');

INSERT INTO system_configs ("key", value, type, description, editable, created_at, updated_at)
SELECT 'booking.survey_deposit_min', '100', 'number', '设计师可设量房定金最低金额', TRUE, NOW(), NOW()
WHERE NOT EXISTS (SELECT 1 FROM system_configs WHERE "key" = 'booking.survey_deposit_min');

INSERT INTO system_configs ("key", value, type, description, editable, created_at, updated_at)
SELECT 'booking.survey_deposit_max', '2000', 'number', '设计师可设量房定金最高金额', TRUE, NOW(), NOW()
WHERE NOT EXISTS (SELECT 1 FROM system_configs WHERE "key" = 'booking.survey_deposit_max');

INSERT INTO system_configs ("key", value, type, description, editable, created_at, updated_at)
SELECT 'order.design_fee_payment_mode', 'onetime', 'string', '设计费支付模式：onetime / staged', TRUE, NOW(), NOW()
WHERE NOT EXISTS (SELECT 1 FROM system_configs WHERE "key" = 'order.design_fee_payment_mode');

INSERT INTO system_configs ("key", value, type, description, editable, created_at, updated_at)
SELECT 'order.design_fee_stages',
       '[{"name":"签约款","percentage":50},{"name":"终稿款","percentage":50}]',
       'json',
       '设计费分阶段付款配置',
       TRUE,
       NOW(),
       NOW()
WHERE NOT EXISTS (SELECT 1 FROM system_configs WHERE "key" = 'order.design_fee_stages');

INSERT INTO system_configs ("key", value, type, description, editable, created_at, updated_at)
SELECT 'order.construction_payment_mode', 'milestone', 'string', '施工费支付模式：milestone / onetime', TRUE, NOW(), NOW()
WHERE NOT EXISTS (SELECT 1 FROM system_configs WHERE "key" = 'order.construction_payment_mode');

INSERT INTO system_configs ("key", value, type, description, editable, created_at, updated_at)
SELECT 'design.fee_quote_expire_hours', '72', 'number', '设计费报价有效期(小时)', TRUE, NOW(), NOW()
WHERE NOT EXISTS (SELECT 1 FROM system_configs WHERE "key" = 'design.fee_quote_expire_hours');

INSERT INTO system_configs ("key", value, type, description, editable, created_at, updated_at)
SELECT 'design.deliverable_deadline_days', '30', 'number', '设计交付件截止天数', TRUE, NOW(), NOW()
WHERE NOT EXISTS (SELECT 1 FROM system_configs WHERE "key" = 'design.deliverable_deadline_days');

INSERT INTO system_configs ("key", value, type, description, editable, created_at, updated_at)
SELECT 'construction.release_delay_days', '3', 'number', '验收确认后T+N天自动放款', TRUE, NOW(), NOW()
WHERE NOT EXISTS (SELECT 1 FROM system_configs WHERE "key" = 'construction.release_delay_days');
