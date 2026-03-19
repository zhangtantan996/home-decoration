-- v1.12.1: 增加 is_settled 字段区分平台收录与自主入驻的商家
-- is_settled = true 表示已入驻（默认值，兼容所有已有数据）
-- is_settled = false 表示平台收录的未入驻商家
-- collected_source 记录收录来源（可选）

-- providers 表
ALTER TABLE providers ADD COLUMN IF NOT EXISTS is_settled boolean DEFAULT true;
ALTER TABLE providers ADD COLUMN IF NOT EXISTS collected_source varchar(200);
CREATE INDEX IF NOT EXISTS idx_providers_is_settled ON providers(is_settled);

-- material_shops 表
ALTER TABLE material_shops ADD COLUMN IF NOT EXISTS is_settled boolean DEFAULT true;
ALTER TABLE material_shops ADD COLUMN IF NOT EXISTS collected_source varchar(200);
CREATE INDEX IF NOT EXISTS idx_material_shops_is_settled ON material_shops(is_settled);
