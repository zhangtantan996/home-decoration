-- 添加"行政区划管理"菜单项到系统管理
-- 执行前请先确认"系统管理"菜单的 parent_id

-- 查找"系统管理"父菜单（假设路径为 /system）
DO $$
DECLARE
    system_menu_id INT;
BEGIN
    -- 查找系统管理菜单ID
    SELECT id INTO system_menu_id FROM menus WHERE path = '/system' LIMIT 1;

    IF system_menu_id IS NULL THEN
        RAISE NOTICE '未找到"系统管理"菜单，请先创建父菜单';
    ELSE
        -- 插入"行政区划管理"菜单
        INSERT INTO menus (parent_id, title, path, icon, sort_order, visible, created_at, updated_at)
        VALUES (
            system_menu_id,
            '行政区划管理',
            '/system/regions',
            'EnvironmentOutlined',
            2,
            true,
            NOW(),
            NOW()
        )
        ON CONFLICT (path) DO NOTHING;

        RAISE NOTICE '✅ 成功添加"行政区划管理"菜单';
    END IF;
END $$;
