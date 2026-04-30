-- 用户实名认证一期：身份证二要素核验字段
ALTER TABLE user_verifications
    ADD COLUMN IF NOT EXISTS real_name_masked VARCHAR(50),
    ADD COLUMN IF NOT EXISTS id_card_last4 VARCHAR(4),
    ADD COLUMN IF NOT EXISTS id_card_hash VARCHAR(64),
    ADD COLUMN IF NOT EXISTS verify_method VARCHAR(30) DEFAULT 'manual_review',
    ADD COLUMN IF NOT EXISTS provider VARCHAR(30),
    ADD COLUMN IF NOT EXISTS provider_request_id VARCHAR(100);

CREATE INDEX IF NOT EXISTS idx_user_verifications_id_card_hash ON user_verifications(id_card_hash);
