DO $$
DECLARE
    users_root_id BIGINT := 0;
    phone_view_menu_id BIGINT := 0;
BEGIN
    SELECT id INTO users_root_id
    FROM sys_menus
    WHERE path = '/users'
    ORDER BY id ASC
    LIMIT 1;

    IF users_root_id IS NULL OR users_root_id = 0 THEN
        INSERT INTO sys_menus (parent_id, title, type, path, component, icon, sort, permission, visible, status, created_at, updated_at)
        VALUES (0, '用户管理', 1, '/users', '', 'UserOutlined', 10, '', true, 1, NOW(), NOW())
        RETURNING id INTO users_root_id;
    END IF;

    SELECT id INTO phone_view_menu_id
    FROM sys_menus
    WHERE permission = 'system:user:phone:view'
    ORDER BY id ASC
    LIMIT 1;

    IF phone_view_menu_id IS NULL OR phone_view_menu_id = 0 THEN
        INSERT INTO sys_menus (parent_id, title, type, path, component, icon, sort, permission, visible, status, created_at, updated_at)
        VALUES (users_root_id, '查看完整手机号', 3, '', '', '', 4, 'system:user:phone:view', false, 1, NOW(), NOW())
        RETURNING id INTO phone_view_menu_id;
    ELSE
        UPDATE sys_menus
        SET parent_id = users_root_id,
            title = '查看完整手机号',
            type = 3,
            sort = 4,
            visible = false,
            status = 1,
            updated_at = NOW()
        WHERE id = phone_view_menu_id;
    END IF;

    DELETE FROM sys_role_menus
    WHERE menu_id = phone_view_menu_id
      AND role_id IN (
          SELECT id
          FROM sys_roles
          WHERE key IN ('operations', 'finance', 'risk', 'customer_service')
      );
END $$;
