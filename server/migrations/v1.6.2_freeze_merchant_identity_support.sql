BEGIN;

-- 为统一商家一期试运营补齐最小索引，支撑“新商家通过后冻结旧身份”主流程。
CREATE INDEX IF NOT EXISTS idx_providers_user_status ON providers(user_id, status);
CREATE INDEX IF NOT EXISTS idx_material_shops_user_verified ON material_shops(user_id, is_verified);
CREATE INDEX IF NOT EXISTS idx_user_identities_user_type ON user_identities(user_id, identity_type);

COMMIT;
