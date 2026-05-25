-- v1.15.10: 将“监理管理”归入账号/商家治理区，保持与用户、服务商、主材门店同组展示。
DO $$
DECLARE
    supervisors_root_id BIGINT;
BEGIN
    PERFORM setval(
        pg_get_serial_sequence('sys_menus', 'id'),
        GREATEST(COALESCE((SELECT MAX(id) FROM sys_menus), 0) + 1, 1),
        false
    );

    SELECT id INTO supervisors_root_id
    FROM sys_menus
    WHERE path = '/supervisors'
    ORDER BY id ASC
    LIMIT 1;

    IF supervisors_root_id IS NULL THEN
        INSERT INTO sys_menus (parent_id, title, type, permission, path, component, icon, sort, visible, status, created_at, updated_at)
        VALUES (0, '监理管理', 1, '', '/supervisors', '', 'TeamOutlined', 35, TRUE, 1, NOW(), NOW())
        RETURNING id INTO supervisors_root_id;
    ELSE
        UPDATE sys_menus
        SET parent_id = 0,
            title = '监理管理',
            type = 1,
            permission = '',
            path = '/supervisors',
            component = '',
            icon = 'TeamOutlined',
            sort = 35,
            visible = TRUE,
            status = 1,
            updated_at = NOW()
        WHERE id = supervisors_root_id;
    END IF;

    UPDATE sys_menus
    SET parent_id = supervisors_root_id,
        updated_at = NOW()
    WHERE path IN (
        '/supervisors/list',
        '/supervisors/whitelist',
        '/supervisors/applications',
        '/supervisors/assignments'
    )
      AND supervisors_root_id IS NOT NULL;
END $$;
