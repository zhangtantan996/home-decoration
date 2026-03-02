-- 修复 identity_applications 缺失 Base 时间字段问题（幂等）
-- 场景：早期 002_create_user_identities.sql 未包含 created_at/updated_at，
-- 导致 GORM Create 写入失败（column created_at does not exist）。

ALTER TABLE identity_applications
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

ALTER TABLE identity_applications
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
