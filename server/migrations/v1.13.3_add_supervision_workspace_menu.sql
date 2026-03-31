DO $$
DECLARE
    supervision_role_id BIGINT;
    supervision_root_id BIGINT;
    supervision_projects_id BIGINT;
    supervision_edit_id BIGINT;
    supervision_risk_id BIGINT;
BEGIN
    PERFORM setval(
        pg_get_serial_sequence('sys_roles', 'id'),
        GREATEST(COALESCE((SELECT MAX(id) FROM sys_roles), 0) + 1, 1),
        false
    );

    INSERT INTO sys_roles (name, key, remark, sort, status, created_at, updated_at)
    VALUES ('监理专员', 'project_supervisor', '负责项目阶段推进、施工日志录入与风险上报', 65, 1, NOW(), NOW())
    ON CONFLICT (key) DO UPDATE
    SET name = EXCLUDED.name,
        remark = EXCLUDED.remark,
        sort = EXCLUDED.sort,
        status = EXCLUDED.status,
        updated_at = NOW()
    RETURNING id INTO supervision_role_id;

    SELECT id INTO supervision_root_id
    FROM sys_menus
    WHERE path = '/supervision'
    ORDER BY id ASC
    LIMIT 1;

    IF supervision_root_id IS NULL THEN
        INSERT INTO sys_menus (parent_id, title, type, permission, path, component, icon, sort, visible, status, created_at, updated_at)
        VALUES (0, '监理工作台', 1, '', '/supervision', '', 'ProjectOutlined', 58, TRUE, 1, NOW(), NOW())
        RETURNING id INTO supervision_root_id;
    ELSE
        UPDATE sys_menus
        SET parent_id = 0,
            title = '监理工作台',
            type = 1,
            permission = '',
            path = '/supervision',
            component = '',
            icon = 'ProjectOutlined',
            sort = 58,
            visible = TRUE,
            status = 1,
            updated_at = NOW()
        WHERE id = supervision_root_id;
    END IF;

    SELECT id INTO supervision_projects_id
    FROM sys_menus
    WHERE path = '/supervision/projects'
    ORDER BY id ASC
    LIMIT 1;

    IF supervision_projects_id IS NULL THEN
        INSERT INTO sys_menus (parent_id, title, type, permission, path, component, icon, sort, visible, status, created_at, updated_at)
        VALUES (supervision_root_id, '项目巡检', 2, 'supervision:workspace:view', '/supervision/projects', 'pages/supervision/WorkbenchList', '', 1, TRUE, 1, NOW(), NOW())
        RETURNING id INTO supervision_projects_id;
    ELSE
        UPDATE sys_menus
        SET parent_id = supervision_root_id,
            title = '项目巡检',
            type = 2,
            permission = 'supervision:workspace:view',
            path = '/supervision/projects',
            component = 'pages/supervision/WorkbenchList',
            icon = '',
            sort = 1,
            visible = TRUE,
            status = 1,
            updated_at = NOW()
        WHERE id = supervision_projects_id;
    END IF;

    SELECT id INTO supervision_edit_id
    FROM sys_menus
    WHERE permission = 'supervision:workspace:edit'
    ORDER BY id ASC
    LIMIT 1;

    IF supervision_edit_id IS NULL THEN
        INSERT INTO sys_menus (parent_id, title, type, permission, path, component, icon, sort, visible, status, created_at, updated_at)
        VALUES (supervision_root_id, '编辑监理工作台', 3, 'supervision:workspace:edit', '', '', '', 1, FALSE, 1, NOW(), NOW())
        RETURNING id INTO supervision_edit_id;
    ELSE
        UPDATE sys_menus
        SET parent_id = supervision_root_id,
            title = '编辑监理工作台',
            type = 3,
            permission = 'supervision:workspace:edit',
            visible = FALSE,
            status = 1,
            updated_at = NOW()
        WHERE id = supervision_edit_id;
    END IF;

    SELECT id INTO supervision_risk_id
    FROM sys_menus
    WHERE permission = 'supervision:risk:create'
    ORDER BY id ASC
    LIMIT 1;

    IF supervision_risk_id IS NULL THEN
        INSERT INTO sys_menus (parent_id, title, type, permission, path, component, icon, sort, visible, status, created_at, updated_at)
        VALUES (supervision_root_id, '上报监理风险', 3, 'supervision:risk:create', '', '', '', 2, FALSE, 1, NOW(), NOW())
        RETURNING id INTO supervision_risk_id;
    ELSE
        UPDATE sys_menus
        SET parent_id = supervision_root_id,
            title = '上报监理风险',
            type = 3,
            permission = 'supervision:risk:create',
            visible = FALSE,
            status = 1,
            updated_at = NOW()
        WHERE id = supervision_risk_id;
    END IF;

    INSERT INTO sys_role_menus (role_id, menu_id)
    VALUES
        (supervision_role_id, supervision_root_id),
        (supervision_role_id, supervision_projects_id),
        (supervision_role_id, supervision_edit_id),
        (supervision_role_id, supervision_risk_id)
    ON CONFLICT DO NOTHING;
END $$;
