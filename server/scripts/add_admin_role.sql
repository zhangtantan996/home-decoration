-- 添加"管理员"角色（权限仅次于超级管理员）
-- 该角色拥有大部分管理权限，但不能管理其他管理员账号和系统角色

-- 1. 插入管理员角色
INSERT INTO sys_roles (id, name, key, remark, sort, status, created_at, updated_at)
VALUES (8, '管理员', 'admin', '系统管理员，拥有除超级管理员外的所有权限', 5, 1, NOW(), NOW())
ON CONFLICT (id) DO UPDATE SET
    name = EXCLUDED.name,
    key = EXCLUDED.key,
    remark = EXCLUDED.remark,
    sort = EXCLUDED.sort,
    updated_at = NOW();

-- 2. 获取所有菜单ID（除了管理员管理和角色管理相关的权限）
-- 管理员角色可以访问所有菜单，但不能：
-- - 创建/编辑/删除其他管理员 (system:admin:*)
-- - 管理角色和权限 (system:role:*, system:menu:*)

-- 删除旧的角色菜单关联
DELETE FROM sys_role_menus WHERE role_id = 8;

-- 分配所有菜单权限（排除管理员管理和角色管理）
INSERT INTO sys_role_menus (role_id, menu_id)
SELECT 8, id FROM sys_menus
WHERE permission IS NULL
   OR permission NOT LIKE 'system:admin:%'
   AND permission NOT LIKE 'system:role:%'
   AND permission NOT LIKE 'system:menu:%'
ON CONFLICT DO NOTHING;

-- 3. 输出结果
SELECT
    r.id,
    r.name,
    r.key,
    r.remark,
    COUNT(rm.menu_id) as menu_count
FROM sys_roles r
LEFT JOIN sys_role_menus rm ON r.id = rm.role_id
WHERE r.id = 8
GROUP BY r.id, r.name, r.key, r.remark;

-- 4. 显示管理员角色拥有的权限列表
SELECT
    m.id,
    m.title,
    m.permission,
    CASE m.type
        WHEN 1 THEN '目录'
        WHEN 2 THEN '菜单'
        WHEN 3 THEN '按钮'
    END as type_name
FROM sys_menus m
INNER JOIN sys_role_menus rm ON m.id = rm.menu_id
WHERE rm.role_id = 8
ORDER BY m.sort, m.id;
