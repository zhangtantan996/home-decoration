-- LEGACY NOTICE: 历史版本化 schema 脚本，保留用于追溯，不再作为正式发布唯一依据。
-- 当前正式 schema 发布目录：server/migrations/
-- 认证/短信审计/商家入驻历史环境补洞统一优先执行：server/migrations/v1.6.4_reconcile_auth_and_onboarding_schema.sql

-- Add user login audit fields if missing.
ALTER TABLE users
    ADD COLUMN IF NOT EXISTS last_login_at TIMESTAMP;

ALTER TABLE users
    ADD COLUMN IF NOT EXISTS last_login_ip VARCHAR(50);

COMMENT ON COLUMN users.last_login_at IS '最后登录时间';
COMMENT ON COLUMN users.last_login_ip IS '最后登录IP';
