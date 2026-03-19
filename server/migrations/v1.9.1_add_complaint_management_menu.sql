DO $$
DECLARE
    risk_parent_id BIGINT;
BEGIN
    SELECT id INTO risk_parent_id
    FROM sys_menus
    WHERE path = '/risk'
       OR title = '风控中心'
    ORDER BY id ASC
    LIMIT 1;

    IF risk_parent_id IS NULL THEN
        RETURN;
    END IF;

    PERFORM setval(
        'sys_menus_id_seq',
        GREATEST(COALESCE((SELECT MAX(id) FROM sys_menus), 1), 1),
        true
    );

    INSERT INTO sys_menus (
        parent_id, title, type, permission, path, component, icon, sort, visible, status, created_at, updated_at
    )
    SELECT risk_parent_id, '投诉处理', 2, 'risk:arbitration:list', '/complaints', 'pages/complaints/ComplaintManagement', 'WarningOutlined', 3, true, 1, NOW(), NOW()
    WHERE NOT EXISTS (
        SELECT 1 FROM sys_menus WHERE path = '/complaints'
    );

    UPDATE sys_menus
    SET
        parent_id = risk_parent_id,
        title = '投诉处理',
        type = 2,
        permission = 'risk:arbitration:list',
        path = '/complaints',
        component = 'pages/complaints/ComplaintManagement',
        icon = 'WarningOutlined',
        sort = 3,
        visible = true,
        status = 1,
        updated_at = NOW()
    WHERE path = '/complaints';
END $$;
