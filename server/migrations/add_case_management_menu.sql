-- 添加"作品管理"菜单项
-- 该菜单整合了作品列表、审核和历史功能

-- 1. 查找审核菜单的父ID（用于插入到相同位置）
DO $$
DECLARE
    audits_parent_id BIGINT;
    max_sort_value INT;
    new_menu_id BIGINT;
BEGIN
    -- 查找审核类菜单的父ID（如果存在）
    SELECT parent_id INTO audits_parent_id
    FROM sys_menus
    WHERE path LIKE '%audits%' OR title LIKE '%审核%'
    LIMIT 1;

    -- 如果没有找到，默认为根菜单
    IF audits_parent_id IS NULL THEN
        audits_parent_id := 0;
    END IF;

    -- 获取当前最大排序值
    SELECT COALESCE(MAX(sort), 0) + 10 INTO max_sort_value
    FROM sys_menus
    WHERE parent_id = audits_parent_id;

    -- 插入"作品管理"菜单（目录）
    INSERT INTO sys_menus (parent_id, title, type, permission, path, component, icon, sort, visible, status, created_at, updated_at)
    VALUES (
        audits_parent_id,           -- 父菜单ID
        '作品管理',                  -- 菜单标题
        2,                          -- 类型：2=菜单
        'system:case:view',         -- 权限标识
        '/cases',                   -- 路由路径
        '',                         -- 组件路径（留空）
        'FileImageOutlined',        -- 图标
        max_sort_value,             -- 排序
        true,                       -- 可见
        1,                          -- 状态：1=启用
        NOW(),
        NOW()
    )
    ON CONFLICT DO NOTHING
    RETURNING id INTO new_menu_id;

    -- 如果成功插入，为超级管理员角色分配此菜单权限
    IF new_menu_id IS NOT NULL THEN
        -- 为角色ID=1（超级管理员）分配权限
        INSERT INTO sys_role_menus (role_id, menu_id)
        VALUES (1, new_menu_id)
        ON CONFLICT DO NOTHING;

        -- 为角色ID=8（管理员）分配权限（如果存在）
        INSERT INTO sys_role_menus (role_id, menu_id)
        SELECT 8, new_menu_id
        WHERE EXISTS (SELECT 1 FROM sys_roles WHERE id = 8)
        ON CONFLICT DO NOTHING;

        RAISE NOTICE '✅ 成功添加"作品管理"菜单，ID: %', new_menu_id;
    ELSE
        RAISE NOTICE 'ℹ️  "作品管理"菜单已存在，跳过插入';
    END IF;
END $$;

-- 2. 删除旧的"作品审核"菜单（如果存在）
DELETE FROM sys_role_menus
WHERE menu_id IN (
    SELECT id FROM sys_menus WHERE path = '/audits/cases'
);

DELETE FROM sys_menus WHERE path = '/audits/cases';

-- 3. 显示结果
SELECT
    m.id,
    m.title,
    m.path,
    m.icon,
    m.permission,
    m.sort,
    CASE m.type
        WHEN 1 THEN '目录'
        WHEN 2 THEN '菜单'
        WHEN 3 THEN '按钮'
    END as type_name,
    COUNT(rm.role_id) as assigned_roles
FROM sys_menus m
LEFT JOIN sys_role_menus rm ON m.id = rm.menu_id
WHERE m.path = '/cases' OR m.title = '作品管理'
GROUP BY m.id, m.title, m.path, m.icon, m.permission, m.sort, m.type
ORDER BY m.id;

SELECT '✅ 作品管理菜单配置完成！' AS message;
SELECT '📝 请在前端添加 FileImageOutlined 图标映射（如果尚未添加）' AS reminder;
