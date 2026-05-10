-- v1.14.8: 将订单控制台从报价 ERP 移到顶级“订单管理”模块。
DO $$
DECLARE
    orders_root_id BIGINT;
    order_center_id BIGINT;
    order_center_view_id BIGINT;
    proposal_review_id BIGINT;
    quote_erp_root_id BIGINT;
BEGIN
    PERFORM setval(
        pg_get_serial_sequence('sys_menus', 'id'),
        GREATEST(COALESCE((SELECT MAX(id) FROM sys_menus), 0) + 1, 1),
        false
    );

    SELECT id INTO orders_root_id
    FROM sys_menus
    WHERE path = '/order-management'
    ORDER BY id ASC
    LIMIT 1;

    IF orders_root_id IS NULL THEN
        INSERT INTO sys_menus (parent_id, title, type, permission, path, component, icon, sort, visible, status, created_at, updated_at)
        VALUES (0, '订单管理', 1, '', '/order-management', '', 'ProjectOutlined', 45, TRUE, 1, NOW(), NOW())
        RETURNING id INTO orders_root_id;
    ELSE
        UPDATE sys_menus
        SET parent_id = 0,
            title = '订单管理',
            type = 1,
            permission = '',
            path = '/order-management',
            component = '',
            icon = 'ProjectOutlined',
            sort = 45,
            visible = TRUE,
            status = 1,
            updated_at = NOW()
        WHERE id = orders_root_id;
    END IF;

    SELECT id INTO order_center_id
    FROM sys_menus
    WHERE path = '/orders'
    ORDER BY id ASC
    LIMIT 1;

    IF order_center_id IS NULL THEN
        INSERT INTO sys_menus (parent_id, title, type, permission, path, component, icon, sort, visible, status, created_at, updated_at)
        VALUES (orders_root_id, '订单控制台', 2, 'order:center:list', '/orders', 'pages/orders/OrderList', '', 1, TRUE, 1, NOW(), NOW())
        RETURNING id INTO order_center_id;
    ELSE
        UPDATE sys_menus
        SET parent_id = orders_root_id,
            title = '订单控制台',
            type = 2,
            permission = 'order:center:list',
            path = '/orders',
            component = 'pages/orders/OrderList',
            icon = '',
            sort = 1,
            visible = TRUE,
            status = 1,
            updated_at = NOW()
        WHERE id = order_center_id;
    END IF;

    -- 历史版本可能已经把 /orders 同时挂到报价 ERP 和顶级入口。
    -- 先合并角色授权与子权限，再删除多余页面，避免侧边栏再次出现重复订单入口。
    INSERT INTO sys_role_menus (role_id, menu_id)
    SELECT DISTINCT rm.role_id, order_center_id
    FROM sys_role_menus rm
    JOIN sys_menus duplicate_order ON duplicate_order.id = rm.menu_id
    WHERE duplicate_order.path = '/orders'
      AND duplicate_order.id <> order_center_id
    ON CONFLICT DO NOTHING;

    DELETE FROM sys_role_menus rm
    USING sys_menus duplicate_order
    WHERE rm.menu_id = duplicate_order.id
      AND duplicate_order.path = '/orders'
      AND duplicate_order.id <> order_center_id;

    UPDATE sys_menus
    SET parent_id = order_center_id,
        updated_at = NOW()
    WHERE parent_id IN (
        SELECT id FROM sys_menus WHERE path = '/orders' AND id <> order_center_id
    );

    DELETE FROM sys_menus
    WHERE path = '/orders'
      AND id <> order_center_id;

    SELECT id INTO order_center_view_id
    FROM sys_menus
    WHERE permission = 'order:center:view'
    ORDER BY id ASC
    LIMIT 1;

    IF order_center_view_id IS NULL THEN
        INSERT INTO sys_menus (parent_id, title, type, permission, path, component, icon, sort, visible, status, created_at, updated_at)
        VALUES (order_center_id, '查看订单控制台', 3, 'order:center:view', '', '', '', 1, FALSE, 1, NOW(), NOW())
        RETURNING id INTO order_center_view_id;
    ELSE
        UPDATE sys_menus
        SET parent_id = order_center_id,
            title = '查看订单控制台',
            type = 3,
            permission = 'order:center:view',
            visible = FALSE,
            status = 1,
            updated_at = NOW()
        WHERE id = order_center_view_id;
    END IF;

    INSERT INTO sys_role_menus (role_id, menu_id)
    SELECT DISTINCT rm.role_id, order_center_view_id
    FROM sys_role_menus rm
    JOIN sys_menus duplicate_button ON duplicate_button.id = rm.menu_id
    WHERE duplicate_button.permission = 'order:center:view'
      AND duplicate_button.id <> order_center_view_id
    ON CONFLICT DO NOTHING;

    DELETE FROM sys_role_menus rm
    USING sys_menus duplicate_button
    WHERE rm.menu_id = duplicate_button.id
      AND duplicate_button.permission = 'order:center:view'
      AND duplicate_button.id <> order_center_view_id;

    DELETE FROM sys_menus
    WHERE permission = 'order:center:view'
      AND id <> order_center_view_id;

    SELECT id INTO proposal_review_id
    FROM sys_menus
    WHERE permission = 'proposal:review'
    ORDER BY id ASC
    LIMIT 1;

    IF proposal_review_id IS NULL THEN
        INSERT INTO sys_menus (parent_id, title, type, permission, path, component, icon, sort, visible, status, created_at, updated_at)
        VALUES (order_center_id, '审核方案', 3, 'proposal:review', '', '', '', 2, FALSE, 1, NOW(), NOW())
        RETURNING id INTO proposal_review_id;
    ELSE
        UPDATE sys_menus
        SET parent_id = order_center_id,
            title = '审核方案',
            type = 3,
            permission = 'proposal:review',
            visible = FALSE,
            status = 1,
            updated_at = NOW()
        WHERE id = proposal_review_id;
    END IF;

    INSERT INTO sys_role_menus (role_id, menu_id)
    SELECT DISTINCT rm.role_id, proposal_review_id
    FROM sys_role_menus rm
    JOIN sys_menus duplicate_button ON duplicate_button.id = rm.menu_id
    WHERE duplicate_button.permission = 'proposal:review'
      AND duplicate_button.id <> proposal_review_id
    ON CONFLICT DO NOTHING;

    DELETE FROM sys_role_menus rm
    USING sys_menus duplicate_button
    WHERE rm.menu_id = duplicate_button.id
      AND duplicate_button.permission = 'proposal:review'
      AND duplicate_button.id <> proposal_review_id;

    DELETE FROM sys_menus
    WHERE permission = 'proposal:review'
      AND id <> proposal_review_id;

    INSERT INTO sys_role_menus (role_id, menu_id)
    SELECT r.id, required.menu_id
    FROM sys_roles r
    CROSS JOIN (
        VALUES (orders_root_id), (order_center_id), (order_center_view_id)
    ) AS required(menu_id)
    WHERE r.key IN ('super_admin', 'operations', 'product_manager', 'customer_service', 'finance', 'risk', 'viewer')
      AND required.menu_id IS NOT NULL
    ON CONFLICT DO NOTHING;

    IF proposal_review_id IS NOT NULL THEN
        INSERT INTO sys_role_menus (role_id, menu_id)
        SELECT r.id, proposal_review_id
        FROM sys_roles r
        WHERE r.key IN ('super_admin', 'operations', 'product_manager', 'customer_service')
        ON CONFLICT DO NOTHING;
    END IF;

    SELECT id INTO quote_erp_root_id
    FROM sys_menus
    WHERE path = '/projects/quotes'
    ORDER BY id ASC
    LIMIT 1;

    IF quote_erp_root_id IS NOT NULL THEN
        DELETE FROM sys_role_menus qrm
        WHERE qrm.menu_id = quote_erp_root_id
          AND NOT EXISTS (
              SELECT 1
              FROM sys_role_menus child_rm
              JOIN sys_menus child ON child.id = child_rm.menu_id
              WHERE child_rm.role_id = qrm.role_id
                AND child.parent_id = quote_erp_root_id
                AND child.visible = TRUE
          );
    END IF;
END $$;
