-- v1.5.2: 入驻条款勾选留痕字段
-- 执行方式:
-- psql -U postgres -d home_decoration -f server/scripts/migrations/v1.5.2_add_onboarding_legal_acceptance.sql

BEGIN;

ALTER TABLE merchant_applications
    ADD COLUMN IF NOT EXISTS legal_acceptance_json TEXT DEFAULT '{}',
    ADD COLUMN IF NOT EXISTS legal_accepted_at TIMESTAMP NULL,
    ADD COLUMN IF NOT EXISTS legal_accept_source VARCHAR(50) DEFAULT 'merchant_web';

ALTER TABLE material_shop_applications
    ADD COLUMN IF NOT EXISTS legal_acceptance_json TEXT DEFAULT '{}',
    ADD COLUMN IF NOT EXISTS legal_accepted_at TIMESTAMP NULL,
    ADD COLUMN IF NOT EXISTS legal_accept_source VARCHAR(50) DEFAULT 'merchant_web';

COMMIT;
