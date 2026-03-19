ALTER TABLE audit_logs
    ADD COLUMN IF NOT EXISTS record_kind VARCHAR(20) NOT NULL DEFAULT 'request',
    ADD COLUMN IF NOT EXISTS operation_type VARCHAR(100) NOT NULL DEFAULT '',
    ADD COLUMN IF NOT EXISTS resource_type VARCHAR(50) NOT NULL DEFAULT '',
    ADD COLUMN IF NOT EXISTS resource_id BIGINT NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS reason TEXT NOT NULL DEFAULT '',
    ADD COLUMN IF NOT EXISTS result VARCHAR(50) NOT NULL DEFAULT '',
    ADD COLUMN IF NOT EXISTS before_state JSONB NOT NULL DEFAULT '{}'::jsonb,
    ADD COLUMN IF NOT EXISTS after_state JSONB NOT NULL DEFAULT '{}'::jsonb,
    ADD COLUMN IF NOT EXISTS metadata JSONB NOT NULL DEFAULT '{}'::jsonb;

CREATE INDEX IF NOT EXISTS idx_audit_logs_record_kind_created_at ON audit_logs(record_kind, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_operation_type ON audit_logs(operation_type);
CREATE INDEX IF NOT EXISTS idx_audit_logs_resource_type_id ON audit_logs(resource_type, resource_id);

COMMENT ON COLUMN audit_logs.record_kind IS 'request=请求级审计，business=业务决策级审计';
COMMENT ON COLUMN audit_logs.operation_type IS '结构化操作类型，如 freeze_funds / confirm_proposal';
COMMENT ON COLUMN audit_logs.resource_type IS '资源类型，如 project / proposal / refund_application';
COMMENT ON COLUMN audit_logs.resource_id IS '资源主键';
COMMENT ON COLUMN audit_logs.reason IS '操作原因';
COMMENT ON COLUMN audit_logs.result IS '操作结果，如 success / rejected / error';
COMMENT ON COLUMN audit_logs.before_state IS '操作前快照';
COMMENT ON COLUMN audit_logs.after_state IS '操作后快照';
COMMENT ON COLUMN audit_logs.metadata IS '扩展上下文';

DO $$
DECLARE
    finance_parent_id BIGINT := 0;
    overview_menu_id BIGINT;
    audit_logs_menu_id BIGINT;
    freeze_perm_menu_id BIGINT;
    unfreeze_perm_menu_id BIGINT;
BEGIN
    SELECT id INTO finance_parent_id
    FROM sys_menus
    WHERE path = '/finance'
       OR title IN ('财务管理', '资金管理')
    ORDER BY id ASC
    LIMIT 1;

    IF finance_parent_id IS NULL THEN
        finance_parent_id := 0;
    END IF;

    SELECT id INTO overview_menu_id
    FROM sys_menus
    WHERE path = '/finance/overview'
       OR component = 'pages/finance/FinanceOverview'
    ORDER BY id ASC
    LIMIT 1;

    IF overview_menu_id IS NULL THEN
        INSERT INTO sys_menus (
            parent_id, title, type, permission, path, component, icon, sort, visible, status, created_at, updated_at
        )
        VALUES (
            finance_parent_id, '资金概览', 2, 'finance:escrow:list', '/finance/overview', 'pages/finance/FinanceOverview', 'AccountBookOutlined', 0, true, 1, NOW(), NOW()
        )
        RETURNING id INTO overview_menu_id;
    ELSE
        UPDATE sys_menus
        SET
            parent_id = finance_parent_id,
            title = '资金概览',
            type = 2,
            permission = 'finance:escrow:list',
            path = '/finance/overview',
            component = 'pages/finance/FinanceOverview',
            icon = 'AccountBookOutlined',
            sort = 0,
            visible = true,
            status = 1,
            updated_at = NOW()
        WHERE id = overview_menu_id;
    END IF;

    SELECT id INTO freeze_perm_menu_id
    FROM sys_menus
    WHERE permission = 'finance:escrow:freeze'
    ORDER BY id ASC
    LIMIT 1;

    IF freeze_perm_menu_id IS NULL THEN
        INSERT INTO sys_menus (
            parent_id, title, type, permission, path, component, icon, sort, visible, status, created_at, updated_at
        )
        VALUES (
            finance_parent_id, '冻结资金', 3, 'finance:escrow:freeze', '', '', '', 10, false, 1, NOW(), NOW()
        )
        RETURNING id INTO freeze_perm_menu_id;
    END IF;

    SELECT id INTO unfreeze_perm_menu_id
    FROM sys_menus
    WHERE permission = 'finance:escrow:unfreeze'
    ORDER BY id ASC
    LIMIT 1;

    IF unfreeze_perm_menu_id IS NULL THEN
        INSERT INTO sys_menus (
            parent_id, title, type, permission, path, component, icon, sort, visible, status, created_at, updated_at
        )
        VALUES (
            finance_parent_id, '解冻资金', 3, 'finance:escrow:unfreeze', '', '', '', 11, false, 1, NOW(), NOW()
        )
        RETURNING id INTO unfreeze_perm_menu_id;
    END IF;

    INSERT INTO sys_role_menus (role_id, menu_id)
    SELECT DISTINCT rm.role_id, overview_menu_id
    FROM sys_role_menus rm
    JOIN sys_menus m ON m.id = rm.menu_id
    WHERE m.permission IN ('finance:escrow:list', 'finance:transaction:list', 'finance:transaction:approve')
       OR m.path IN ('/finance/escrow', '/finance/transactions', '/refunds')
    ON CONFLICT DO NOTHING;

    INSERT INTO sys_role_menus (role_id, menu_id)
    SELECT DISTINCT rm.role_id, freeze_perm_menu_id
    FROM sys_role_menus rm
    JOIN sys_menus m ON m.id = rm.menu_id
    WHERE m.permission IN ('finance:transaction:approve', 'finance:escrow:list')
       OR m.path IN ('/finance/escrow', '/finance/transactions', '/finance/overview')
    ON CONFLICT DO NOTHING;

    INSERT INTO sys_role_menus (role_id, menu_id)
    SELECT DISTINCT rm.role_id, unfreeze_perm_menu_id
    FROM sys_role_menus rm
    JOIN sys_menus m ON m.id = rm.menu_id
    WHERE m.permission IN ('finance:transaction:approve', 'finance:escrow:list')
       OR m.path IN ('/finance/escrow', '/finance/transactions', '/finance/overview')
    ON CONFLICT DO NOTHING;

    SELECT id INTO audit_logs_menu_id
    FROM sys_menus
    WHERE path = '/audit-logs'
       OR component = 'pages/system/AuditLogList'
    ORDER BY id ASC
    LIMIT 1;

    IF audit_logs_menu_id IS NULL THEN
        INSERT INTO sys_menus (
            parent_id, title, type, permission, path, component, icon, sort, visible, status, created_at, updated_at
        )
        VALUES (
            0, '业务审计日志', 2, 'system:log:list', '/audit-logs', 'pages/system/AuditLogList', 'FileTextOutlined', 91, true, 1, NOW(), NOW()
        )
        RETURNING id INTO audit_logs_menu_id;
    ELSE
        UPDATE sys_menus
        SET
            title = '业务审计日志',
            type = 2,
            permission = 'system:log:list',
            path = '/audit-logs',
            component = 'pages/system/AuditLogList',
            icon = 'FileTextOutlined',
            sort = 91,
            visible = true,
            status = 1,
            updated_at = NOW()
        WHERE id = audit_logs_menu_id;
    END IF;

    INSERT INTO sys_role_menus (role_id, menu_id)
    SELECT DISTINCT rm.role_id, audit_logs_menu_id
    FROM sys_role_menus rm
    JOIN sys_menus m ON m.id = rm.menu_id
    WHERE m.permission = 'system:log:list'
       OR m.path IN ('/logs', '/logs/list')
    ON CONFLICT DO NOTHING;
END $$;
