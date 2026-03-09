-- 多身份切换系统 - 数据回填脚本
-- 创建日期: 2026-01-26
-- 说明: 将现有用户数据迁移到 user_identities 表

-- 回填现有用户身份
-- 注意: 这个脚本是幂等的，可以安全地多次执行
INSERT INTO user_identities (user_id, identity_type, identity_ref_id, status, verified, created_at, updated_at)
SELECT
  id AS user_id,
  CASE
    WHEN user_type = 1 THEN 'owner'
    WHEN user_type = 2 THEN 'provider'
    WHEN user_type = 3 THEN 'worker'
    WHEN user_type = 4 THEN 'admin'
    ELSE 'owner'  -- 默认为业主
  END AS identity_type,
  NULL AS identity_ref_id,
  1 AS status,  -- 已有用户默认 approved
  TRUE AS verified,
  created_at,
  updated_at
FROM users
WHERE user_type IN (1, 2, 3, 4)
ON CONFLICT (user_id, identity_type) DO NOTHING;  -- 避免重复插入

-- 回填 Provider 关联
-- 将 provider 记录关联到对应的 user_identities
UPDATE user_identities ui
SET identity_ref_id = p.id
FROM providers p
WHERE ui.user_id = p.user_id
  AND ui.identity_type = 'provider'
  AND ui.identity_ref_id IS NULL;  -- 只更新未关联的记录

-- 回填 Worker 关联
-- 将 worker 记录关联到对应的 user_identities
UPDATE user_identities ui
SET identity_ref_id = w.id
FROM workers w
WHERE ui.user_id = w.user_id
  AND ui.identity_type = 'worker'
  AND ui.identity_ref_id IS NULL;  -- 只更新未关联的记录

-- 验证数据完整性
-- 检查所有 users 都有对应的 user_identities 记录
DO $$
DECLARE
  missing_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO missing_count
  FROM users u
  LEFT JOIN user_identities ui ON u.id = ui.user_id
  WHERE ui.id IS NULL;

  IF missing_count > 0 THEN
    RAISE WARNING '发现 % 个用户没有对应的 user_identities 记录', missing_count;
  ELSE
    RAISE NOTICE '数据完整性验证通过：所有用户都有对应的身份记录';
  END IF;
END $$;

-- 统计回填结果
SELECT
  identity_type,
  COUNT(*) as count,
  COUNT(CASE WHEN identity_ref_id IS NOT NULL THEN 1 END) as with_ref_id
FROM user_identities
GROUP BY identity_type
ORDER BY identity_type;
