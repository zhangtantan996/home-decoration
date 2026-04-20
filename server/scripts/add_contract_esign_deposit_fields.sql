-- 为合同表添加电子签章和定金支付相关字段
-- 执行时间：2026-04-20

-- 添加预约ID关联
ALTER TABLE contracts ADD COLUMN IF NOT EXISTS booking_id BIGINT;
CREATE INDEX IF NOT EXISTS idx_contracts_booking_id ON contracts(booking_id);

-- 添加合同类型
ALTER TABLE contracts ADD COLUMN IF NOT EXISTS contract_type VARCHAR(20) DEFAULT 'design';

-- 添加定金金额
ALTER TABLE contracts ADD COLUMN IF NOT EXISTS deposit_amount DECIMAL(12,2) DEFAULT 0;

-- 添加合同内容
ALTER TABLE contracts ADD COLUMN IF NOT EXISTS contract_content TEXT;

-- 添加电子签章相关字段
ALTER TABLE contracts ADD COLUMN IF NOT EXISTS user_signed_at TIMESTAMP;
ALTER TABLE contracts ADD COLUMN IF NOT EXISTS provider_signed_at TIMESTAMP;
ALTER TABLE contracts ADD COLUMN IF NOT EXISTS esign_flow_id VARCHAR(100);
ALTER TABLE contracts ADD COLUMN IF NOT EXISTS esign_provider VARCHAR(20) DEFAULT 'mock';
ALTER TABLE contracts ADD COLUMN IF NOT EXISTS contract_file_url VARCHAR(500);

-- 添加定金支付相关字段
ALTER TABLE contracts ADD COLUMN IF NOT EXISTS deposit_paid BOOLEAN DEFAULT FALSE;
ALTER TABLE contracts ADD COLUMN IF NOT EXISTS deposit_paid_at TIMESTAMP;
ALTER TABLE contracts ADD COLUMN IF NOT EXISTS deposit_payment_id BIGINT;
CREATE INDEX IF NOT EXISTS idx_contracts_deposit_payment_id ON contracts(deposit_payment_id);

-- 添加新的合同状态注释
COMMENT ON COLUMN contracts.status IS '合同状态: draft=草稿, pending_confirm=待确认, pending_sign=待签署, signed=已签署, pending_deposit=待支付定金, confirmed=已确认, active=生效中, completed=已完成, terminated=已终止';

-- 添加合同类型注释
COMMENT ON COLUMN contracts.contract_type IS '合同类型: design=设计合同, construction=施工合同';

-- 添加电子签章提供商注释
COMMENT ON COLUMN contracts.esign_provider IS '电子签章提供商: mock=模拟, esign=e签宝, fadada=法大大';
