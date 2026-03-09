-- LEGACY NOTICE: 本脚本与正式发布目录中的 server/migrations/add_user_login_lock_fields.sql 重复；当前仅保留用于历史追溯。
-- 正式发布请改用 server/migrations/。

-- 添加用户登录锁定相关字段
-- 执行时间: 2025-12-26

ALTER TABLE users ADD COLUMN IF NOT EXISTS login_failed_count INT DEFAULT 0;
ALTER TABLE users ADD COLUMN IF NOT EXISTS locked_until TIMESTAMP;
ALTER TABLE users ADD COLUMN IF NOT EXISTS last_failed_login_at TIMESTAMP;

COMMENT ON COLUMN users.login_failed_count IS '登录失败次数';
COMMENT ON COLUMN users.locked_until IS '锁定到期时间';
COMMENT ON COLUMN users.last_failed_login_at IS '最后失败登录时间';
