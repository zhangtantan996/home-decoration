-- v1.14.1: 将 admin 报价经营治理入口收口为独立的“报价ERP”栏目。
-- 说明：监理工作台/项目巡检属于履约执行域；报价ERP/施工主体价格库巡检属于报价经营治理域。
DO $$
DECLARE
    quote_erp_root_id BIGINT;
    quote_library_id BIGINT;
    quote_templates_id BIGINT;
    quote_lists_id BIGINT;
    quote_compare_id BIGINT;
    quote_price_books_id BIGINT;
    order_center_id BIGINT;
    order_center_view_id BIGINT;
BEGIN
    PERFORM setval(
        pg_get_serial_sequence('sys_menus', 'id'),
        GREATEST(COALESCE((SELECT MAX(id) FROM sys_menus), 0) + 1, 1),
        false
    );

    SELECT id INTO quote_erp_root_id
    FROM sys_menus
    WHERE path = '/projects/quotes'
    ORDER BY id ASC
    LIMIT 1;

    IF quote_erp_root_id IS NULL THEN
        INSERT INTO sys_menus (parent_id, title, type, permission, path, component, icon, sort, visible, status, created_at, updated_at)
        VALUES (0, '报价ERP', 1, '', '/projects/quotes', '', 'FileTextOutlined', 44, TRUE, 1, NOW(), NOW())
        RETURNING id INTO quote_erp_root_id;
    ELSE
        UPDATE sys_menus
        SET parent_id = 0,
            title = '报价ERP',
            type = 1,
            permission = '',
            path = '/projects/quotes',
            component = '',
            icon = 'FileTextOutlined',
            sort = 44,
            visible = TRUE,
            status = 1,
            updated_at = NOW()
        WHERE id = quote_erp_root_id;
    END IF;

    SELECT id INTO quote_library_id
    FROM sys_menus
    WHERE path = '/projects/quotes/library'
    ORDER BY id ASC
    LIMIT 1;

    IF quote_library_id IS NULL THEN
        INSERT INTO sys_menus (parent_id, title, type, permission, path, component, icon, sort, visible, status, created_at, updated_at)
        VALUES (quote_erp_root_id, '标准项库', 2, 'project:list', '/projects/quotes/library', 'pages/quotes/QuoteLibraryManagement', '', 1, TRUE, 1, NOW(), NOW())
        RETURNING id INTO quote_library_id;
    ELSE
        UPDATE sys_menus
        SET parent_id = quote_erp_root_id,
            title = '标准项库',
            type = 2,
            permission = 'project:list',
            component = 'pages/quotes/QuoteLibraryManagement',
            icon = '',
            sort = 1,
            visible = TRUE,
            status = 1,
            updated_at = NOW()
        WHERE id = quote_library_id;
    END IF;

    SELECT id INTO quote_templates_id
    FROM sys_menus
    WHERE path = '/projects/quotes/templates'
    ORDER BY id ASC
    LIMIT 1;

    IF quote_templates_id IS NULL THEN
        INSERT INTO sys_menus (parent_id, title, type, permission, path, component, icon, sort, visible, status, created_at, updated_at)
        VALUES (quote_erp_root_id, '报价模板', 2, 'project:list', '/projects/quotes/templates', 'pages/quotes/QuoteTemplateManagement', '', 2, TRUE, 1, NOW(), NOW())
        RETURNING id INTO quote_templates_id;
    ELSE
        UPDATE sys_menus
        SET parent_id = quote_erp_root_id,
            title = '报价模板',
            type = 2,
            permission = 'project:list',
            component = 'pages/quotes/QuoteTemplateManagement',
            icon = '',
            sort = 2,
            visible = TRUE,
            status = 1,
            updated_at = NOW()
        WHERE id = quote_templates_id;
    END IF;

    SELECT id INTO quote_lists_id
    FROM sys_menus
    WHERE path = '/projects/quotes/lists'
    ORDER BY id ASC
    LIMIT 1;

    IF quote_lists_id IS NULL THEN
        INSERT INTO sys_menus (parent_id, title, type, permission, path, component, icon, sort, visible, status, created_at, updated_at)
        VALUES (quote_erp_root_id, '施工报价单', 2, 'project:edit', '/projects/quotes/lists', 'pages/quotes/QuoteListManagement', '', 3, TRUE, 1, NOW(), NOW())
        RETURNING id INTO quote_lists_id;
    ELSE
        UPDATE sys_menus
        SET parent_id = quote_erp_root_id,
            title = '施工报价单',
            type = 2,
            permission = 'project:edit',
            component = 'pages/quotes/QuoteListManagement',
            icon = '',
            sort = 3,
            visible = TRUE,
            status = 1,
            updated_at = NOW()
        WHERE id = quote_lists_id;
    END IF;

    SELECT id INTO quote_price_books_id
    FROM sys_menus
    WHERE path = '/projects/quotes/price-books'
    ORDER BY id ASC
    LIMIT 1;

    IF quote_price_books_id IS NULL THEN
        INSERT INTO sys_menus (parent_id, title, type, permission, path, component, icon, sort, visible, status, created_at, updated_at)
        VALUES (quote_erp_root_id, '施工主体价格库巡检', 2, 'provider:list', '/projects/quotes/price-books', 'pages/quotes/ProviderPriceBookInspection', '', 4, TRUE, 1, NOW(), NOW())
        RETURNING id INTO quote_price_books_id;
    ELSE
        UPDATE sys_menus
        SET parent_id = quote_erp_root_id,
            title = '施工主体价格库巡检',
            type = 2,
            permission = 'provider:list',
            component = 'pages/quotes/ProviderPriceBookInspection',
            icon = '',
            sort = 4,
            visible = TRUE,
            status = 1,
            updated_at = NOW()
        WHERE id = quote_price_books_id;
    END IF;

    SELECT id INTO order_center_id
    FROM sys_menus
    WHERE path = '/orders'
    ORDER BY id ASC
    LIMIT 1;

    IF order_center_id IS NOT NULL THEN
        UPDATE sys_menus
        SET parent_id = quote_erp_root_id,
            title = '变更与结算',
            type = 2,
            permission = 'order:center:list',
            component = 'pages/orders/OrderList',
            icon = '',
            sort = 5,
            visible = TRUE,
            status = 1,
            updated_at = NOW()
        WHERE id = order_center_id;

        SELECT id INTO order_center_view_id
        FROM sys_menus
        WHERE permission = 'order:center:view'
        ORDER BY id ASC
        LIMIT 1;

        IF order_center_view_id IS NOT NULL THEN
            UPDATE sys_menus
            SET parent_id = order_center_id,
                title = '查看变更与结算',
                type = 3,
                visible = FALSE,
                status = 1,
                updated_at = NOW()
            WHERE id = order_center_view_id;
        END IF;
    END IF;

    SELECT id INTO quote_compare_id
    FROM sys_menus
    WHERE path = '/projects/quotes/compare/:id'
    ORDER BY id ASC
    LIMIT 1;

    IF quote_compare_id IS NULL THEN
        INSERT INTO sys_menus (parent_id, title, type, permission, path, component, icon, sort, visible, status, created_at, updated_at)
        VALUES (quote_erp_root_id, '报价对比', 2, 'project:view', '/projects/quotes/compare/:id', 'pages/quotes/QuoteComparison', '', 6, FALSE, 1, NOW(), NOW())
        RETURNING id INTO quote_compare_id;
    ELSE
        UPDATE sys_menus
        SET parent_id = quote_erp_root_id,
            title = '报价对比',
            type = 2,
            permission = 'project:view',
            component = 'pages/quotes/QuoteComparison',
            icon = '',
            sort = 6,
            visible = FALSE,
            status = 1,
            updated_at = NOW()
        WHERE id = quote_compare_id;
    END IF;

    INSERT INTO sys_role_menus (role_id, menu_id)
    SELECT DISTINCT rm.role_id, quote_templates_id
    FROM sys_role_menus rm
    JOIN sys_menus m ON m.id = rm.menu_id
    WHERE m.permission = 'project:list'
      AND quote_templates_id IS NOT NULL
      AND NOT EXISTS (
        SELECT 1 FROM sys_role_menus existing
        WHERE existing.role_id = rm.role_id
          AND existing.menu_id = quote_templates_id
      );

    INSERT INTO sys_role_menus (role_id, menu_id)
    SELECT DISTINCT rm.role_id, quote_price_books_id
    FROM sys_role_menus rm
    JOIN sys_menus m ON m.id = rm.menu_id
    WHERE m.permission = 'provider:list'
      AND quote_price_books_id IS NOT NULL
      AND NOT EXISTS (
        SELECT 1 FROM sys_role_menus existing
        WHERE existing.role_id = rm.role_id
          AND existing.menu_id = quote_price_books_id
      );

    INSERT INTO sys_role_menus (role_id, menu_id)
    SELECT DISTINCT rm.role_id, quote_erp_root_id
    FROM sys_role_menus rm
    WHERE rm.menu_id IN (
        COALESCE(quote_library_id, 0),
        COALESCE(quote_templates_id, 0),
        COALESCE(quote_lists_id, 0),
        COALESCE(quote_compare_id, 0),
        COALESCE(quote_price_books_id, 0),
        COALESCE(order_center_id, 0)
    )
      AND NOT EXISTS (
        SELECT 1 FROM sys_role_menus existing
        WHERE existing.role_id = rm.role_id
          AND existing.menu_id = quote_erp_root_id
      );
END $$;
