-- v1.6.6: 接入“审核中心”动态菜单（幂等）
-- 目标：
-- 1) 新增/更新菜单：path=/audits, title=审核中心
-- 2) 菜单仅分配给已拥有任一审核相关菜单关系的角色
-- 3) 保持现有路由权限控制（前端 /audits 继续按 any-of 既有权限）

DO $$
DECLARE
    target_parent_id BIGINT := 0;
    audit_center_menu_id BIGINT;
    next_sort_value INT := 5;
BEGIN
    -- 1) 优先复用审核相关菜单所在父级
    SELECT parent_id INTO target_parent_id
    FROM sys_menus
    WHERE path IN (
        '/providers/audit',
        '/materials/audit',
        '/providers/identity-applications',
        '/audits/identity-applications',
        '/audits/cases'
    )
    ORDER BY id ASC
    LIMIT 1;

    IF target_parent_id IS NULL THEN
        target_parent_id := 0;
    END IF;

    -- 2) 查找已存在“审核中心”菜单（按 path > permission > title）
    SELECT id INTO audit_center_menu_id
    FROM sys_menus
    WHERE path = '/audits'
       OR permission = 'audit:center:view'
       OR title = '审核中心'
    ORDER BY
        CASE
            WHEN path = '/audits' THEN 1
            WHEN permission = 'audit:center:view' THEN 2
            WHEN title = '审核中心' THEN 3
            ELSE 4
        END,
        id ASC
    LIMIT 1;

    -- 3) 不存在则创建，存在则统一更新（幂等）
    IF audit_center_menu_id IS NULL THEN
        SELECT COALESCE(MAX(sort), 0) + 1 INTO next_sort_value
        FROM sys_menus
        WHERE parent_id = target_parent_id;

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
            target_parent_id,
            '审核中心',
            2,
            'audit:center:view',
            '/audits',
            'pages/audits/AuditCenter',
            'FileTextOutlined',
            next_sort_value,
            true,
            1,
            NOW(),
            NOW()
        )
        RETURNING id INTO audit_center_menu_id;
    ELSE
        UPDATE sys_menus
        SET
            parent_id = target_parent_id,
            title = '审核中心',
            type = 2,
            permission = 'audit:center:view',
            path = '/audits',
            component = 'pages/audits/AuditCenter',
            icon = 'FileTextOutlined',
            sort = CASE WHEN sort > 0 THEN sort ELSE 5 END,
            visible = true,
            status = 1,
            updated_at = NOW()
        WHERE id = audit_center_menu_id;
    END IF;

    -- 4) 仅分配给“已拥有任一审核相关菜单关系”的角色
    INSERT INTO sys_role_menus (role_id, menu_id)
    SELECT DISTINCT rm.role_id, audit_center_menu_id
    FROM sys_role_menus rm
    JOIN sys_menus m ON m.id = rm.menu_id
    WHERE m.permission IN (
              'provider:audit:list',
              'material:audit:list',
              'identity:application:audit',
              'system:case:view'
          )
       OR m.path IN (
              '/providers/audit',
              '/materials/audit',
              '/providers/identity-applications',
              '/audits/identity-applications',
              '/cases/manage',
              '/audits/cases'
          )
    ON CONFLICT DO NOTHING;
END $$;
