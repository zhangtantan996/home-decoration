-- 为 users 表新增对外公开标识 public_id
-- 设计目标：
-- 1) 内部继续使用自增 id 作为主键
-- 2) 对外使用不可枚举的 public_id，降低 ID 遍历风险

BEGIN;

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS public_id VARCHAR(36);

-- 为历史数据回填 public_id
UPDATE users
SET public_id = md5(random()::text || clock_timestamp()::text || id::text)
WHERE public_id IS NULL OR public_id = '';

-- 为后续直接 SQL 插入提供兜底默认值（应用层仍优先使用 UUID）
ALTER TABLE users
  ALTER COLUMN public_id SET DEFAULT md5(random()::text || clock_timestamp()::text);

ALTER TABLE users
  ALTER COLUMN public_id SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_users_public_id ON users(public_id);

COMMENT ON COLUMN users.public_id IS '对外公开用户标识（不可枚举），内部主键仍为 id';

COMMIT;
