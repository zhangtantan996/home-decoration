-- Identity Phase1 自动化验收清理脚本
-- 用法：
-- psql "$E2E_DB_URL" -v run_id=<runId> -v phone_prefix=<prefix> -f server/scripts/testdata/identity_acceptance_cleanup.sql

\set ON_ERROR_STOP on

BEGIN;

CREATE TEMP TABLE IF NOT EXISTS tmp_identity_target_users (
  user_id BIGINT PRIMARY KEY
) ON COMMIT DROP;

-- 优先按 run_id 精准识别本次验收产生的数据
INSERT INTO tmp_identity_target_users (user_id)
SELECT DISTINCT ia.user_id
FROM identity_applications ia
WHERE COALESCE(ia.application_data::text, '') ILIKE '%' || :'run_id' || '%'
   OR COALESCE(ia.reject_reason, '') ILIKE '%' || :'run_id' || '%'
ON CONFLICT DO NOTHING;

-- 当 run_id 为空时，回退按 phone_prefix 清理（混合模式兜底）
INSERT INTO tmp_identity_target_users (user_id)
SELECT u.id
FROM users u
WHERE NULLIF(:'run_id', '') IS NULL
  AND u.phone LIKE :'phone_prefix' || '%'
ON CONFLICT DO NOTHING;

DO $$
BEGIN
  IF to_regclass('public.identity_audit_logs') IS NOT NULL THEN
    DELETE FROM identity_audit_logs
    WHERE user_id IN (SELECT user_id FROM tmp_identity_target_users);
  END IF;
END $$;

DELETE FROM identity_applications
WHERE user_id IN (SELECT user_id FROM tmp_identity_target_users);

DELETE FROM user_identities
WHERE user_id IN (SELECT user_id FROM tmp_identity_target_users)
  AND identity_type = 'provider';

DELETE FROM providers
WHERE user_id IN (SELECT user_id FROM tmp_identity_target_users);

COMMIT;
