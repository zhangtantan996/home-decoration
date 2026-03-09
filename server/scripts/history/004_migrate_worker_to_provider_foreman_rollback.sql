-- 004 回滚脚本（尽量保守）
-- 说明：仅回滚 user_identities 的 identity_type，并不删除已创建的 providers 记录。

BEGIN;

UPDATE user_identities
SET identity_type = 'worker',
    updated_at = NOW()
WHERE identity_type = 'provider'
  AND id IN (
    SELECT ui.id
    FROM user_identities ui
    JOIN providers p ON p.user_id = ui.user_id
    WHERE ui.identity_type = 'provider'
      AND p.provider_type = 3
      AND p.sub_type = 'foreman'
  );

COMMIT;

