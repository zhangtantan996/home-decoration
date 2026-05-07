\echo '== 统一身份中心回填核对（核心计数） =='
SELECT 'active_users_total' AS metric, COUNT(*)::BIGINT AS value
FROM users
WHERE status = 1
UNION ALL
SELECT 'owner_identity_active_total', COUNT(*)::BIGINT
FROM user_identities
WHERE identity_type = 'owner' AND status = 1
UNION ALL
SELECT 'active_users_without_owner_identity', COUNT(*)::BIGINT
FROM users u
LEFT JOIN user_identities ui
  ON ui.user_id = u.id
 AND ui.identity_type = 'owner'
 AND ui.status = 1
WHERE u.status = 1
  AND ui.id IS NULL
UNION ALL
SELECT 'active_providers_total', COUNT(*)::BIGINT
FROM providers
WHERE status = 1 AND user_id > 0
UNION ALL
SELECT 'active_providers_without_active_identity', COUNT(*)::BIGINT
FROM providers p
LEFT JOIN user_identities ui
  ON ui.user_id = p.user_id
 AND ui.identity_type = 'provider'
 AND ui.status = 1
WHERE p.status = 1
  AND p.user_id > 0
  AND ui.id IS NULL
UNION ALL
SELECT 'active_sys_admins_total', COUNT(*)::BIGINT
FROM sys_admins
WHERE status = 1
UNION ALL
SELECT 'active_sys_admins_without_admin_identity', COUNT(*)::BIGINT
FROM sys_admins sa
LEFT JOIN admin_profiles ap
  ON ap.sys_admin_id = sa.id
LEFT JOIN user_identities ui
  ON ui.identity_type = 'admin'
 AND ui.identity_ref_id = ap.id
 AND ui.status = 1
WHERE sa.status = 1
  AND ui.id IS NULL;

\echo ''
\echo '== 默认身份分布（active users） =='
SELECT default_identity_type, COUNT(*)::BIGINT AS count
FROM users
WHERE status = 1
GROUP BY default_identity_type
ORDER BY count DESC, default_identity_type ASC;

\echo ''
\echo '== 抽样：active users 缺 owner identity（最多20条） =='
SELECT u.id AS user_id, u.phone, u.default_identity_type
FROM users u
LEFT JOIN user_identities ui
  ON ui.user_id = u.id
 AND ui.identity_type = 'owner'
 AND ui.status = 1
WHERE u.status = 1
  AND ui.id IS NULL
ORDER BY u.id ASC
LIMIT 20;

\echo ''
\echo '== 抽样：active providers 缺 active provider identity（最多20条） =='
SELECT p.id AS provider_id, p.user_id, p.status AS provider_status, u.phone, u.default_identity_type
FROM providers p
LEFT JOIN users u
  ON u.id = p.user_id
LEFT JOIN user_identities ui
  ON ui.user_id = p.user_id
 AND ui.identity_type = 'provider'
 AND ui.status = 1
WHERE p.status = 1
  AND p.user_id > 0
  AND ui.id IS NULL
ORDER BY p.id ASC
LIMIT 20;

\echo ''
\echo '== 抽样：active sys_admin 缺 admin identity（最多20条） =='
SELECT sa.id AS sys_admin_id, sa.username, sa.phone, ap.id AS admin_profile_id
FROM sys_admins sa
LEFT JOIN admin_profiles ap
  ON ap.sys_admin_id = sa.id
LEFT JOIN user_identities ui
  ON ui.identity_type = 'admin'
 AND ui.identity_ref_id = ap.id
 AND ui.status = 1
WHERE sa.status = 1
  AND ui.id IS NULL
ORDER BY sa.id ASC
LIMIT 20;
