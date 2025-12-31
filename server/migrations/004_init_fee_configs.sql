-- Migration: Initialize platform commission configuration
-- Purpose: Create system configs for dynamic commission rate management

-- 插入平台抽成配置
INSERT INTO system_configs (key, value, type, description, editable, created_at, updated_at) VALUES
('fee.platform.intent_fee_rate', '0', 'number', '意向金抽成比例（0-1，默认0表示不抽成）', true, NOW(), NOW()),
('fee.platform.design_fee_rate', '0.10', 'number', '设计费抽成比例（0-1，默认10%）', true, NOW(), NOW()),
('fee.platform.construction_fee_rate', '0.10', 'number', '施工费抽成比例（0-1，默认10%）', true, NOW(), NOW()),
('fee.platform.material_fee_rate', '0.05', 'number', '材料费抽成比例（0-1，默认5%）', true, NOW(), NOW()),
('withdraw.min_amount', '100', 'number', '最小提现金额（元）', true, NOW(), NOW()),
('withdraw.fee', '0', 'number', '提现手续费（元，固定金额）', true, NOW(), NOW()),
('settlement.auto_days', '7', 'number', '自动结算天数（订单完成后多少天可提现）', true, NOW(), NOW())
ON CONFLICT (key) DO UPDATE SET
    value = EXCLUDED.value,
    description = EXCLUDED.description,
    updated_at = NOW();

-- Add comments
COMMENT ON TABLE system_configs IS '系统配置表，支持管理后台动态修改';
COMMENT ON COLUMN system_configs.key IS '配置键，唯一标识';
COMMENT ON COLUMN system_configs.value IS '配置值，根据type解析';
COMMENT ON COLUMN system_configs.type IS '值类型：string, number, boolean, json';
COMMENT ON COLUMN system_configs.editable IS '是否允许后台修改';
