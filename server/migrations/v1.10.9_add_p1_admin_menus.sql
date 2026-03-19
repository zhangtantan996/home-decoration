DO $$
DECLARE
    risk_parent_id BIGINT := 0;
    finance_parent_id BIGINT := 0;
    project_audit_menu_id BIGINT;
    refund_menu_id BIGINT;
BEGIN
    SELECT id INTO risk_parent_id
    FROM sys_menus
    WHERE path = '/risk'
       OR title = '风控中心'
    ORDER BY id ASC
    LIMIT 1;

    IF risk_parent_id IS NULL THEN
        risk_parent_id := 0;
    END IF;

    SELECT id INTO finance_parent_id
    FROM sys_menus
    WHERE path = '/finance'
       OR title IN ('财务管理', '资金管理')
    ORDER BY id ASC
    LIMIT 1;

    IF finance_parent_id IS NULL THEN
        finance_parent_id := 0;
    END IF;

    SELECT id INTO project_audit_menu_id
    FROM sys_menus
    WHERE path = '/project-audits'
       OR component = 'pages/projectAudits/ProjectAuditList'
    ORDER BY id ASC
    LIMIT 1;

    IF project_audit_menu_id IS NULL THEN
        INSERT INTO sys_menus (
            parent_id, title, type, permission, path, component, icon, sort, visible, status, created_at, updated_at
        )
        VALUES (
            risk_parent_id, '项目审计', 2, 'risk:arbitration:list', '/project-audits', 'pages/projectAudits/ProjectAuditList', 'AuditOutlined', 4, true, 1, NOW(), NOW()
        )
        RETURNING id INTO project_audit_menu_id;
    ELSE
        UPDATE sys_menus
        SET
            parent_id = risk_parent_id,
            title = '项目审计',
            type = 2,
            permission = 'risk:arbitration:list',
            path = '/project-audits',
            component = 'pages/projectAudits/ProjectAuditList',
            icon = 'AuditOutlined',
            sort = 4,
            visible = true,
            status = 1,
            updated_at = NOW()
        WHERE id = project_audit_menu_id;
    END IF;

    INSERT INTO sys_role_menus (role_id, menu_id)
    SELECT DISTINCT rm.role_id, project_audit_menu_id
    FROM sys_role_menus rm
    JOIN sys_menus m ON m.id = rm.menu_id
    WHERE m.permission IN ('risk:arbitration:list', 'risk:arbitration:judge')
       OR m.path IN ('/complaints', '/risk/arbitration')
    ON CONFLICT DO NOTHING;

    SELECT id INTO refund_menu_id
    FROM sys_menus
    WHERE path = '/refunds'
       OR component = 'pages/refunds/RefundList'
    ORDER BY id ASC
    LIMIT 1;

    IF refund_menu_id IS NULL THEN
        INSERT INTO sys_menus (
            parent_id, title, type, permission, path, component, icon, sort, visible, status, created_at, updated_at
        )
        VALUES (
            finance_parent_id, '退款审核', 2, 'finance:transaction:list', '/refunds', 'pages/refunds/RefundList', 'AccountBookOutlined', 5, true, 1, NOW(), NOW()
        )
        RETURNING id INTO refund_menu_id;
    ELSE
        UPDATE sys_menus
        SET
            parent_id = finance_parent_id,
            title = '退款审核',
            type = 2,
            permission = 'finance:transaction:list',
            path = '/refunds',
            component = 'pages/refunds/RefundList',
            icon = 'AccountBookOutlined',
            sort = 5,
            visible = true,
            status = 1,
            updated_at = NOW()
        WHERE id = refund_menu_id;
    END IF;

    INSERT INTO sys_role_menus (role_id, menu_id)
    SELECT DISTINCT rm.role_id, refund_menu_id
    FROM sys_role_menus rm
    JOIN sys_menus m ON m.id = rm.menu_id
    WHERE m.permission IN ('finance:transaction:list', 'finance:transaction:view', 'finance:transaction:approve')
       OR m.path IN ('/finance/transactions', '/finance/escrow')
    ON CONFLICT DO NOTHING;
END $$;
