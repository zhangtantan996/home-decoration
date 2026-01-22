-- Description: Backfill inspiration visibility + ensure minimal sensitive words seed
-- NOTE: This migration is designed to be idempotent.

BEGIN;

-- 1) Backfill inspiration visibility
-- Approved/published cases live in provider_cases; for product behavior we default them visible in inspiration.
ALTER TABLE provider_cases
    ADD COLUMN IF NOT EXISTS show_in_inspiration BOOLEAN DEFAULT FALSE;

UPDATE provider_cases
SET show_in_inspiration = TRUE
WHERE show_in_inspiration IS DISTINCT FROM TRUE;

-- 2) Ensure sensitive_words exists and has minimal seed words.
-- GORM AutoMigrate creates the table but doesn't seed data; this provides a safe baseline.
CREATE TABLE IF NOT EXISTS sensitive_words (
    id BIGSERIAL PRIMARY KEY,
    word VARCHAR(100) NOT NULL UNIQUE,
    category VARCHAR(20),
    level VARCHAR(20) DEFAULT 'normal',
    action VARCHAR(20) DEFAULT 'block',
    is_regex BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO sensitive_words (word, category, level, action, is_regex) VALUES
    -- severe (block)
    ('fuck', 'abuse', 'severe', 'block', FALSE),
    ('shit', 'abuse', 'severe', 'block', FALSE),
    ('傻逼', 'abuse', 'severe', 'block', FALSE),
    ('草泥马', 'abuse', 'severe', 'block', FALSE),

    -- ads (review)
    ('微信', 'ad', 'normal', 'review', FALSE),
    ('加微信', 'ad', 'normal', 'review', FALSE),
    ('扫码', 'ad', 'normal', 'review', FALSE),
    ('优惠', 'ad', 'mild', 'review', FALSE),
    ('咨询', 'ad', 'mild', 'review', FALSE),

    -- competitors (review)
    ('土巴兔', 'competitor', 'normal', 'review', FALSE),
    ('齐家网', 'competitor', 'normal', 'review', FALSE),
    ('好好住', 'competitor', 'normal', 'review', FALSE),

    -- regex examples
    ('[0-9]{11}', 'ad', 'normal', 'review', TRUE),
    ('微信.*[0-9]{5,}', 'ad', 'normal', 'review', TRUE),
    ('VX.*[0-9]{5,}', 'ad', 'normal', 'review', TRUE)
ON CONFLICT (word) DO NOTHING;

COMMIT;
