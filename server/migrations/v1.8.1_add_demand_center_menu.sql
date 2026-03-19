DO $$
DECLARE
    demand_center_id BIGINT;
    demand_list_id BIGINT;
BEGIN
    -- 某些历史环境手工插入过 sys_menus，导致序列落后于实际最大 ID。
    -- 在创建新菜单前先把序列拨正，避免 nextval 撞主键。
    PERFORM setval(
        'sys_menus_id_seq',
        GREATEST(COALESCE((SELECT MAX(id) FROM sys_menus), 1), 1),
        true
    );

    SELECT id INTO demand_center_id
    FROM sys_menus
    WHERE path = '/demands'
       OR permission = 'demand:center'
       OR title = '需求中心'
    ORDER BY id ASC
    LIMIT 1;

    IF demand_center_id IS NULL THEN
        INSERT INTO sys_menus (
            parent_id, title, type, permission, path, component, icon, sort, visible, status, created_at, updated_at
        ) VALUES (
            0, '需求中心', 1, 'demand:center', '/demands', '', 'UnorderedListOutlined', 45, true, 1, NOW(), NOW()
        ) RETURNING id INTO demand_center_id;
    ELSE
        UPDATE sys_menus
        SET
            parent_id = 0,
            title = '需求中心',
            type = 1,
            permission = 'demand:center',
            path = '/demands',
            component = '',
            icon = 'UnorderedListOutlined',
            sort = 45,
            visible = true,
            status = 1,
            updated_at = NOW()
        WHERE id = demand_center_id;
    END IF;

    SELECT id INTO demand_list_id
    FROM sys_menus
    WHERE path = '/demands/list'
       OR permission = 'demand:list'
    ORDER BY id ASC
    LIMIT 1;

    IF demand_list_id IS NULL THEN
        INSERT INTO sys_menus (
            parent_id, title, type, permission, path, component, icon, sort, visible, status, created_at, updated_at
        ) VALUES (
            demand_center_id, '需求管理', 2, 'demand:list', '/demands/list', 'pages/demands/DemandList', 'UnorderedListOutlined', 1, true, 1, NOW(), NOW()
        ) RETURNING id INTO demand_list_id;
    ELSE
        UPDATE sys_menus
        SET
            parent_id = demand_center_id,
            title = '需求管理',
            type = 2,
            permission = 'demand:list',
            path = '/demands/list',
            component = 'pages/demands/DemandList',
            icon = 'UnorderedListOutlined',
            sort = 1,
            visible = true,
            status = 1,
            updated_at = NOW()
        WHERE id = demand_list_id;
    END IF;

    INSERT INTO sys_menus (
        parent_id, title, type, permission, path, component, icon, sort, visible, status, created_at, updated_at
    )
    SELECT demand_center_id, '审核需求', 3, 'demand:review', '', '', '', 2, false, 1, NOW(), NOW()
    WHERE NOT EXISTS (SELECT 1 FROM sys_menus WHERE permission = 'demand:review');

    INSERT INTO sys_menus (
        parent_id, title, type, permission, path, component, icon, sort, visible, status, created_at, updated_at
    )
    SELECT demand_center_id, '分配需求', 3, 'demand:assign', '', '', '', 3, false, 1, NOW(), NOW()
    WHERE NOT EXISTS (SELECT 1 FROM sys_menus WHERE permission = 'demand:assign');

    INSERT INTO sys_role_menus (role_id, menu_id)
    SELECT DISTINCT rm.role_id, demand_center_id
    FROM sys_role_menus rm
    JOIN sys_menus m ON m.id = rm.menu_id
    WHERE m.permission IN ('project:list', 'provider:audit:list', 'booking:list')
    ON CONFLICT DO NOTHING;

    INSERT INTO sys_role_menus (role_id, menu_id)
    SELECT DISTINCT rm.role_id, demand_list_id
    FROM sys_role_menus rm
    JOIN sys_menus m ON m.id = rm.menu_id
    WHERE m.permission IN ('project:list', 'provider:audit:list', 'booking:list')
    ON CONFLICT DO NOTHING;

    INSERT INTO sys_role_menus (role_id, menu_id)
    SELECT DISTINCT rm.role_id, review_menu.id
    FROM sys_role_menus rm
    JOIN sys_menus m ON m.id = rm.menu_id
    CROSS JOIN LATERAL (
        SELECT id FROM sys_menus WHERE permission = 'demand:review' LIMIT 1
    ) review_menu
    WHERE m.permission IN ('provider:audit:list', 'booking:list')
    ON CONFLICT DO NOTHING;

    INSERT INTO sys_role_menus (role_id, menu_id)
    SELECT DISTINCT rm.role_id, assign_menu.id
    FROM sys_role_menus rm
    JOIN sys_menus m ON m.id = rm.menu_id
    CROSS JOIN LATERAL (
        SELECT id FROM sys_menus WHERE permission = 'demand:assign' LIMIT 1
    ) assign_menu
    WHERE m.permission IN ('provider:audit:list', 'project:list')
    ON CONFLICT DO NOTHING;
END $$;
