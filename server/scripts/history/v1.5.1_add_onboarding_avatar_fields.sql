-- LEGACY NOTICE: 历史版本化 schema 脚本，保留用于追溯。
-- 当前正式目录为 server/migrations/；入驻历史环境补洞统一优先执行 v1.6.4。

-- v1.5.1: 入驻资料补齐（头像字段）
-- 执行方式:
-- psql -U postgres -d home_decoration -f server/scripts/migrations/v1.5.1_add_onboarding_avatar_fields.sql

BEGIN;

ALTER TABLE merchant_applications
    ADD COLUMN IF NOT EXISTS avatar VARCHAR(500) DEFAULT '';

ALTER TABLE providers
    ADD COLUMN IF NOT EXISTS avatar VARCHAR(500) DEFAULT '';

-- 回填 provider.avatar（若为空，则使用用户头像）
UPDATE providers p
SET avatar = COALESCE(NULLIF(u.avatar, ''), p.avatar)
FROM users u
WHERE p.user_id = u.id
  AND COALESCE(NULLIF(p.avatar, ''), '') = '';

COMMIT;

