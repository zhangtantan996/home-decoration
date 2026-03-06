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
