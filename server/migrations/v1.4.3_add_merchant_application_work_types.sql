-- v1.4.3: 扩展商家入驻申请支持工长类型字段
-- 执行方式:
-- psql -U postgres -d home_decoration -f server/migrations/v1.4.3_add_merchant_application_work_types.sql

BEGIN;

ALTER TABLE merchant_applications
    ADD COLUMN IF NOT EXISTS years_experience INTEGER DEFAULT 0,
    ADD COLUMN IF NOT EXISTS work_types TEXT DEFAULT '[]';

-- 规范化空值，避免后续 JSON 解析异常
UPDATE merchant_applications
SET work_types = '[]'
WHERE work_types IS NULL OR btrim(work_types) = '';

COMMIT;

