-- worker -> provider.foreman 迁移脚本（幂等）
-- 目标：统一主身份为 owner/provider/admin，worker 收敛为 provider 子类型 foreman

BEGIN;

-- 1) 为存在 worker 记录但缺少 provider 的用户创建 provider（工长）
INSERT INTO providers (
  user_id,
  provider_type,
  sub_type,
  company_name,
  verified,
  status,
  created_at,
  updated_at
)
SELECT
  w.user_id,
  3,
  'foreman',
  '',
  TRUE,
  1,
  NOW(),
  NOW()
FROM workers w
LEFT JOIN providers p ON p.user_id = w.user_id
WHERE p.id IS NULL;

-- 2) 将 provider_type=3 的 provider 统一设置为 foreman 子类型
UPDATE providers
SET sub_type = 'foreman',
    updated_at = NOW()
WHERE provider_type = 3
  AND (sub_type IS NULL OR sub_type = '' OR sub_type = 'worker');

-- 3) worker 身份映射为 provider（仅处理已存在 worker identity 的用户）
UPDATE user_identities ui
SET identity_type = 'provider',
    updated_at = NOW()
WHERE ui.identity_type = 'worker'
  AND EXISTS (
    SELECT 1
    FROM providers p
    WHERE p.user_id = ui.user_id
  );

-- 4) 修正 provider identity 的 identity_ref_id 指向 provider.id
UPDATE user_identities ui
SET identity_ref_id = p.id,
    updated_at = NOW()
FROM providers p
WHERE ui.user_id = p.user_id
  AND ui.identity_type = 'provider'
  AND (ui.identity_ref_id IS NULL OR ui.identity_ref_id <> p.id);

-- 5) 去重：同一用户仅保留一条 provider identity（保留最小 id）
DELETE FROM user_identities ui
USING user_identities dup
WHERE ui.user_id = dup.user_id
  AND ui.identity_type = 'provider'
  AND dup.identity_type = 'provider'
  AND ui.id > dup.id;

COMMIT;

-- 验证结果
SELECT identity_type, COUNT(*) AS cnt
FROM user_identities
GROUP BY identity_type
ORDER BY identity_type;

