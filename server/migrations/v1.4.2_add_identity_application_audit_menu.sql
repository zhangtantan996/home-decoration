-- 新增“身份申请审核”菜单与权限点
-- 目标权限：identity:application:audit
-- 目标路由：/providers/identity-applications

DO $$
DECLARE
    providers_parent_id BIGINT := 0;
    identity_audit_menu_id BIGINT;
    next_sort_value INT := 5;
BEGIN
    -- 1) 识别服务商管理父菜单
    SELECT id INTO providers_parent_id
    FROM sys_menus
    WHERE path = '/providers' AND type = 1
    ORDER BY id ASC
    LIMIT 1;

    IF providers_parent_id IS NULL THEN
        providers_parent_id := 0;
    END IF;

    -- 2) 优先按 permission 定位历史菜单，兼容旧 path
    SELECT id INTO identity_audit_menu_id
    FROM sys_menus
    WHERE permission = 'identity:application:audit'
    ORDER BY id ASC
    LIMIT 1;

    IF identity_audit_menu_id IS NULL THEN
        SELECT id INTO identity_audit_menu_id
        FROM sys_menus
        WHERE path IN ('/providers/identity-applications', '/audits/identity-applications')
        ORDER BY id ASC
        LIMIT 1;
    END IF;

    -- 3) 若不存在则创建（幂等）
    IF identity_audit_menu_id IS NULL THEN
        SELECT COALESCE(MAX(sort), 0) + 1 INTO next_sort_value
        FROM sys_menus
        WHERE parent_id = providers_parent_id;

        IF next_sort_value < 5 THEN
            next_sort_value := 5;
        END IF;

        INSERT INTO sys_menus (
            parent_id,
            title,
            type,
            permission,
            path,
            component,
            icon,
            sort,
            visible,
            status,
            created_at,
            updated_at
        )
        VALUES (
            providers_parent_id,
            '身份申请审核',
            2,
            'identity:application:audit',
            '/providers/identity-applications',
            'pages/audits/IdentityApplicationAudit',
            'FileTextOutlined',
            next_sort_value,
            true,
            1,
            NOW(),
            NOW()
        )
        RETURNING id INTO identity_audit_menu_id;
    ELSE
        -- 4) 已存在则修正为统一配置（保留原有 sort，避免重跑漂移）
        UPDATE sys_menus
        SET
            parent_id = providers_parent_id,
            title = '身份申请审核',
            type = 2,
            permission = 'identity:application:audit',
            path = '/providers/identity-applications',
            component = 'pages/audits/IdentityApplicationAudit',
            icon = 'FileTextOutlined',
            sort = CASE WHEN sort > 0 THEN sort ELSE 5 END,
            visible = true,
            status = 1,
            updated_at = NOW()
        WHERE id = identity_audit_menu_id;
    END IF;

    -- 5) 授权给超级管理员（role_id=1）
    INSERT INTO sys_role_menus (role_id, menu_id)
    VALUES (1, identity_audit_menu_id)
    ON CONFLICT DO NOTHING;

    -- 6) 授权给管理员（role_id=8，若存在）
    INSERT INTO sys_role_menus (role_id, menu_id)
    SELECT 8, identity_audit_menu_id
    WHERE EXISTS (SELECT 1 FROM sys_roles WHERE id = 8)
    ON CONFLICT DO NOTHING;
END $$;
