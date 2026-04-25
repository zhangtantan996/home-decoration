-- 添加自动出款和结算管理菜单
-- 执行前请确认 finance_root 菜单的 ID

-- 1. 查找 finance_root 的 ID
-- SELECT id FROM sys_menus WHERE menu_key = 'finance_root';

-- 2. 插入自动出款菜单（假设 finance_root 的 ID 是从查询结果获取）
INSERT INTO sys_menus (menu_key, parent_key, title, path, component, icon, sort, permission, menu_type, visible, created_at, updated_at)
VALUES
  ('finance_payouts', 'finance_root', '自动出款', '/finance/payouts', 'pages/finance/PayoutList', '', 3, 'finance:transaction:list', 1, true, NOW(), NOW()),
  ('finance_settlements', 'finance_root', '结算管理', '/finance/settlements', 'pages/finance/SettlementList', '', 4, 'finance:transaction:list', 1, true, NOW(), NOW())
ON CONFLICT (menu_key) DO UPDATE SET
  title = EXCLUDED.title,
  path = EXCLUDED.path,
  component = EXCLUDED.component,
  sort = EXCLUDED.sort,
  permission = EXCLUDED.permission,
  updated_at = NOW();

-- 3. 为财务角色分配权限（假设 finance 角色的 ID 需要查询）
-- SELECT id FROM sys_roles WHERE role_key = 'finance';

-- 插入角色菜单关联（需要替换 role_id 为实际的角色 ID）
INSERT INTO sys_role_menus (role_id, menu_id)
SELECT r.id, m.id
FROM sys_roles r, sys_menus m
WHERE r.role_key = 'finance'
  AND m.menu_key IN ('finance_payouts', 'finance_settlements')
ON CONFLICT (role_id, menu_id) DO NOTHING;

-- 4. 为只读用户角色分配权限
INSERT INTO sys_role_menus (role_id, menu_id)
SELECT r.id, m.id
FROM sys_roles r, sys_menus m
WHERE r.role_key = 'viewer'
  AND m.menu_key IN ('finance_payouts', 'finance_settlements')
ON CONFLICT (role_id, menu_id) DO NOTHING;

-- 5. 验证插入结果
SELECT m.menu_key, m.title, m.path, m.sort, m.permission
FROM sys_menus m
WHERE m.parent_key = 'finance_root'
ORDER BY m.sort;
