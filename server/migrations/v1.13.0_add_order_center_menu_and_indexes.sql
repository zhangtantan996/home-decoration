BEGIN;

CREATE INDEX IF NOT EXISTS idx_orders_status_created_at ON orders(status, created_at);
CREATE INDEX IF NOT EXISTS idx_orders_project_id_status ON orders(project_id, status);
CREATE INDEX IF NOT EXISTS idx_payment_plans_status_due_at ON payment_plans(status, due_at);
CREATE INDEX IF NOT EXISTS idx_audit_logs_resource_type_resource_id_created_at ON audit_logs(resource_type, resource_id, created_at);

DO $$
DECLARE
    order_center_menu_id BIGINT := 0;
    order_center_view_perm_id BIGINT := 0;
    proposal_review_perm_id BIGINT := 0;
BEGIN
    SELECT id INTO order_center_menu_id
    FROM sys_menus
    WHERE path = '/orders'
       OR permission = 'order:center:list'
    ORDER BY id ASC
    LIMIT 1;

    IF order_center_menu_id IS NULL OR order_center_menu_id = 0 THEN
        INSERT INTO sys_menus (
            parent_id, title, type, permission, path, component, icon, sort, visible, status, created_at, updated_at
        )
        VALUES (
            0, '订单控制台', 2, 'order:center:list', '/orders', 'pages/orders/OrderList', 'ProjectOutlined', 45, true, 1, NOW(), NOW()
        )
        RETURNING id INTO order_center_menu_id;
    ELSE
        UPDATE sys_menus
        SET
            parent_id = 0,
            title = '订单控制台',
            type = 2,
            permission = 'order:center:list',
            path = '/orders',
            component = 'pages/orders/OrderList',
            icon = 'ProjectOutlined',
            sort = 45,
            visible = true,
            status = 1,
            updated_at = NOW()
        WHERE id = order_center_menu_id;
    END IF;

    SELECT id INTO order_center_view_perm_id
    FROM sys_menus
    WHERE permission = 'order:center:view'
    ORDER BY id ASC
    LIMIT 1;

    IF order_center_view_perm_id IS NULL OR order_center_view_perm_id = 0 THEN
        INSERT INTO sys_menus (
            parent_id, title, type, permission, path, component, icon, sort, visible, status, created_at, updated_at
        )
        VALUES (
            order_center_menu_id, '查看订单控制台', 3, 'order:center:view', '', '', '', 1, false, 1, NOW(), NOW()
        )
        RETURNING id INTO order_center_view_perm_id;
    ELSE
        UPDATE sys_menus
        SET
            parent_id = order_center_menu_id,
            title = '查看订单控制台',
            type = 3,
            permission = 'order:center:view',
            visible = false,
            status = 1,
            updated_at = NOW()
        WHERE id = order_center_view_perm_id;
    END IF;

    SELECT id INTO proposal_review_perm_id
    FROM sys_menus
    WHERE permission = 'proposal:review'
    ORDER BY id ASC
    LIMIT 1;

    IF proposal_review_perm_id IS NULL OR proposal_review_perm_id = 0 THEN
        INSERT INTO sys_menus (
            parent_id, title, type, permission, path, component, icon, sort, visible, status, created_at, updated_at
        )
        VALUES (
            order_center_menu_id, '审核方案', 3, 'proposal:review', '', '', '', 2, false, 1, NOW(), NOW()
        )
        RETURNING id INTO proposal_review_perm_id;
    ELSE
        UPDATE sys_menus
        SET
            parent_id = order_center_menu_id,
            title = '审核方案',
            type = 3,
            permission = 'proposal:review',
            visible = false,
            status = 1,
            updated_at = NOW()
        WHERE id = proposal_review_perm_id;
    END IF;

    INSERT INTO sys_role_menus (role_id, menu_id)
    SELECT r.id, required.menu_id
    FROM sys_roles r
    CROSS JOIN (
        VALUES (order_center_menu_id), (order_center_view_perm_id)
    ) AS required(menu_id)
    WHERE r.key IN ('super_admin', 'operations', 'product_manager', 'customer_service', 'finance', 'risk', 'viewer')
    ON CONFLICT DO NOTHING;

    INSERT INTO sys_role_menus (role_id, menu_id)
    SELECT r.id, proposal_review_perm_id
    FROM sys_roles r
    WHERE r.key IN ('super_admin', 'operations', 'product_manager', 'customer_service')
    ON CONFLICT DO NOTHING;
END $$;

COMMIT;
