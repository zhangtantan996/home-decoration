-- LEGACY NOTICE: 历史版本化 schema 脚本，保留用于追溯。
-- 主材商法人字段补洞已被 server/migrations/v1.6.4_reconcile_auth_and_onboarding_schema.sql 吸收。

BEGIN;

ALTER TABLE material_shop_applications
    ADD COLUMN IF NOT EXISTS company_name VARCHAR(100) DEFAULT '',
    ADD COLUMN IF NOT EXISTS legal_person_name VARCHAR(50) DEFAULT '',
    ADD COLUMN IF NOT EXISTS legal_person_id_card_no VARCHAR(100) DEFAULT '',
    ADD COLUMN IF NOT EXISTS legal_person_id_card_front VARCHAR(500) DEFAULT '',
    ADD COLUMN IF NOT EXISTS legal_person_id_card_back VARCHAR(500) DEFAULT '';

ALTER TABLE material_shops
    ADD COLUMN IF NOT EXISTS company_name VARCHAR(100) DEFAULT '',
    ADD COLUMN IF NOT EXISTS legal_person_name VARCHAR(50) DEFAULT '',
    ADD COLUMN IF NOT EXISTS legal_person_id_card_no VARCHAR(100) DEFAULT '',
    ADD COLUMN IF NOT EXISTS legal_person_id_card_front VARCHAR(500) DEFAULT '',
    ADD COLUMN IF NOT EXISTS legal_person_id_card_back VARCHAR(500) DEFAULT '';

COMMIT;
