-- v1.12.0 全业务流支付结算体系
-- 覆盖: 量房定金、设计费报价、设计成果交付、施工T+3放款、施工暂停/恢复

-- ============================================
-- 1. Booking 扩展：量房定金字段
-- ============================================
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS survey_deposit float8 DEFAULT 0;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS survey_deposit_paid boolean DEFAULT false;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS survey_deposit_paid_at timestamptz;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS survey_deposit_converted boolean DEFAULT false;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS survey_deposit_refunded boolean DEFAULT false;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS survey_deposit_refund_amt float8 DEFAULT 0;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS survey_deposit_refund_at timestamptz;

-- ============================================
-- 2. Milestone 扩展：T+N 放款调度
-- ============================================
ALTER TABLE milestones ADD COLUMN IF NOT EXISTS release_scheduled_at timestamptz;
ALTER TABLE milestones ADD COLUMN IF NOT EXISTS released_at timestamptz;

-- ============================================
-- 3. Project 扩展：施工付款模式与暂停状态
-- ============================================
ALTER TABLE projects ADD COLUMN IF NOT EXISTS construction_payment_mode varchar(20) DEFAULT 'staged';
ALTER TABLE projects ADD COLUMN IF NOT EXISTS payment_paused boolean DEFAULT false;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS payment_paused_at timestamptz;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS payment_paused_reason varchar(200);

-- ============================================
-- 4. MerchantServiceSetting 扩展
-- ============================================
ALTER TABLE merchant_service_settings ADD COLUMN IF NOT EXISTS survey_deposit_amount float8 DEFAULT 0;
ALTER TABLE merchant_service_settings ADD COLUMN IF NOT EXISTS design_payment_mode varchar(20) DEFAULT '';

-- ============================================
-- 5. PaymentPlan 扩展：关联里程碑
-- ============================================
ALTER TABLE payment_plans ADD COLUMN IF NOT EXISTS milestone_id bigint DEFAULT 0;
CREATE INDEX IF NOT EXISTS idx_payment_plans_milestone_id ON payment_plans(milestone_id);

-- ============================================
-- 6. 新表：design_working_docs（设计内部沟通材料）
-- ============================================
CREATE TABLE IF NOT EXISTS design_working_docs (
    id bigserial PRIMARY KEY,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    booking_id bigint NOT NULL,
    provider_id bigint NOT NULL,
    doc_type varchar(30) NOT NULL DEFAULT '',
    title varchar(100) DEFAULT '',
    description text DEFAULT '',
    files jsonb DEFAULT '[]',
    submitted_at timestamptz
);
CREATE INDEX IF NOT EXISTS idx_design_working_docs_booking ON design_working_docs(booking_id);
CREATE INDEX IF NOT EXISTS idx_design_working_docs_provider ON design_working_docs(provider_id);

-- ============================================
-- 7. 新表：design_fee_quotes（设计费报价）
-- ============================================
CREATE TABLE IF NOT EXISTS design_fee_quotes (
    id bigserial PRIMARY KEY,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    booking_id bigint NOT NULL,
    provider_id bigint NOT NULL,
    total_fee float8 NOT NULL DEFAULT 0,
    deposit_deduction float8 DEFAULT 0,
    net_amount float8 NOT NULL DEFAULT 0,
    payment_mode varchar(20) DEFAULT 'onetime',
    stages_json jsonb DEFAULT '[]',
    description text DEFAULT '',
    status varchar(20) DEFAULT 'pending',
    expire_at timestamptz,
    confirmed_at timestamptz,
    rejected_at timestamptz,
    rejection_reason varchar(500) DEFAULT '',
    order_id bigint DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_design_fee_quotes_booking ON design_fee_quotes(booking_id);
CREATE INDEX IF NOT EXISTS idx_design_fee_quotes_provider ON design_fee_quotes(provider_id);
CREATE INDEX IF NOT EXISTS idx_design_fee_quotes_status ON design_fee_quotes(status);

-- ============================================
-- 8. 新表：design_deliverables（设计成果交付物）
-- ============================================
CREATE TABLE IF NOT EXISTS design_deliverables (
    id bigserial PRIMARY KEY,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    booking_id bigint NOT NULL,
    project_id bigint DEFAULT 0,
    order_id bigint DEFAULT 0,
    provider_id bigint NOT NULL,
    color_floor_plan jsonb DEFAULT '[]',
    renderings jsonb DEFAULT '[]',
    rendering_link varchar(500) DEFAULT '',
    text_description text DEFAULT '',
    cad_drawings jsonb DEFAULT '[]',
    attachments jsonb DEFAULT '[]',
    status varchar(20) DEFAULT 'draft',
    submitted_at timestamptz,
    accepted_at timestamptz,
    rejected_at timestamptz,
    rejection_reason varchar(500) DEFAULT ''
);
CREATE INDEX IF NOT EXISTS idx_design_deliverables_booking ON design_deliverables(booking_id);
CREATE INDEX IF NOT EXISTS idx_design_deliverables_project ON design_deliverables(project_id);
CREATE INDEX IF NOT EXISTS idx_design_deliverables_provider ON design_deliverables(provider_id);

-- ============================================
-- 9. 新增系统配置
-- ============================================
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
SELECT 'design.fee_quote_expire_hours', '72', 'number', '设计费报价有效期(小时)', TRUE, NOW(), NOW()
WHERE NOT EXISTS (SELECT 1 FROM system_configs WHERE "key" = 'design.fee_quote_expire_hours');

INSERT INTO system_configs ("key", value, type, description, editable, created_at, updated_at)
SELECT 'design.deliverable_deadline_days', '30', 'number', '设计交付件截止天数', TRUE, NOW(), NOW()
WHERE NOT EXISTS (SELECT 1 FROM system_configs WHERE "key" = 'design.deliverable_deadline_days');

INSERT INTO system_configs ("key", value, type, description, editable, created_at, updated_at)
SELECT 'construction.release_delay_days', '3', 'number', '验收确认后T+N天自动放款', TRUE, NOW(), NOW()
WHERE NOT EXISTS (SELECT 1 FROM system_configs WHERE "key" = 'construction.release_delay_days');
