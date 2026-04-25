BEGIN;

ALTER TABLE budget_confirmations
    ADD COLUMN IF NOT EXISTS style_direction TEXT,
    ADD COLUMN IF NOT EXISTS space_requirements TEXT,
    ADD COLUMN IF NOT EXISTS expected_duration_days INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS special_requirements TEXT,
    ADD COLUMN IF NOT EXISTS reject_count INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS reject_limit INTEGER NOT NULL DEFAULT 3,
    ADD COLUMN IF NOT EXISTS last_rejected_at TIMESTAMP;

UPDATE budget_confirmations
SET reject_limit = 3
WHERE reject_limit IS NULL OR reject_limit <= 0;

INSERT INTO system_configs ("key", value, type, description, editable, created_at, updated_at)
SELECT 'booking.budget_confirm_reject_limit', '3', 'number', '沟通确认可被用户驳回的阈值，达到后才关闭预约', TRUE, NOW(), NOW()
WHERE NOT EXISTS (
    SELECT 1
    FROM system_configs
    WHERE "key" = 'booking.budget_confirm_reject_limit'
);

COMMIT;
