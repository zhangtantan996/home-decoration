BEGIN;

DO $$
DECLARE
    finance_parent_id BIGINT := 0;
    payment_order_menu_id BIGINT := 0;
BEGIN
    SELECT id INTO finance_parent_id
    FROM sys_menus
    WHERE path = '/finance'
       OR title IN ('资金中心', '财务管理', '资金管理')
    ORDER BY id ASC
    LIMIT 1;

    IF finance_parent_id IS NULL THEN
        finance_parent_id := 0;
    END IF;

    SELECT id INTO payment_order_menu_id
    FROM sys_menus
    WHERE path = '/finance/payment-orders'
       OR component = 'pages/finance/PaymentOrderList'
    ORDER BY id ASC
    LIMIT 1;

    IF payment_order_menu_id IS NULL OR payment_order_menu_id = 0 THEN
        INSERT INTO sys_menus (
            parent_id, title, type, permission, path, component, icon, sort, visible, status, created_at, updated_at
        )
        VALUES (
            finance_parent_id, '支付单', 2, 'finance:transaction:list', '/finance/payment-orders', 'pages/finance/PaymentOrderList', 'AccountBookOutlined', 1, true, 1, NOW(), NOW()
        )
        RETURNING id INTO payment_order_menu_id;
    ELSE
        UPDATE sys_menus
        SET
            parent_id = finance_parent_id,
            title = '支付单',
            type = 2,
            permission = 'finance:transaction:list',
            path = '/finance/payment-orders',
            component = 'pages/finance/PaymentOrderList',
            icon = 'AccountBookOutlined',
            sort = 1,
            visible = true,
            status = 1,
            updated_at = NOW()
        WHERE id = payment_order_menu_id;
    END IF;

    INSERT INTO sys_role_menus (role_id, menu_id)
    SELECT DISTINCT rm.role_id, payment_order_menu_id
    FROM sys_role_menus rm
    JOIN sys_menus m ON m.id = rm.menu_id
    WHERE m.permission IN ('finance:transaction:list', 'finance:transaction:view', 'finance:transaction:approve')
       OR m.path IN ('/finance/transactions', '/finance/overview', '/refunds')
    ON CONFLICT DO NOTHING;

    INSERT INTO sys_role_menus (role_id, menu_id)
    SELECT r.id, payment_order_menu_id
    FROM sys_roles r
    WHERE r.key IN ('super_admin', 'finance', 'risk', 'viewer')
    ON CONFLICT DO NOTHING;
END $$;

COMMIT;
