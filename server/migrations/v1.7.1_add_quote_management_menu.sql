DO $$
DECLARE
    project_parent_id BIGINT;
    quote_library_menu_id BIGINT;
    quote_lists_menu_id BIGINT;
    quote_compare_menu_id BIGINT;
    next_menu_id BIGINT;
BEGIN
    SELECT id INTO project_parent_id
    FROM sys_menus
    WHERE path = '/projects'
    ORDER BY id
    LIMIT 1;

    IF project_parent_id IS NULL THEN
        RAISE NOTICE 'skip quote menu migration because /projects parent menu does not exist';
        RETURN;
    END IF;

    SELECT id INTO quote_library_menu_id
    FROM sys_menus
    WHERE path = '/projects/quotes/library'
    ORDER BY id
    LIMIT 1;

    IF quote_library_menu_id IS NULL THEN
        SELECT COALESCE(MAX(id), 0) + 1 INTO next_menu_id FROM sys_menus;
        INSERT INTO sys_menus (
            id, parent_id, title, type, permission, path, component, icon, sort, visible, status, created_at, updated_at
        ) VALUES (
            next_menu_id, project_parent_id, '报价库', 2, 'project:list', '/projects/quotes/library', 'pages/quotes/QuoteLibraryManagement',
            'FileTextOutlined', 3, true, 1, NOW(), NOW()
        )
        RETURNING id INTO quote_library_menu_id;
    END IF;

    SELECT id INTO quote_lists_menu_id
    FROM sys_menus
    WHERE path = '/projects/quotes/lists'
    ORDER BY id
    LIMIT 1;

    IF quote_lists_menu_id IS NULL THEN
        SELECT COALESCE(MAX(id), 0) + 1 INTO next_menu_id FROM sys_menus;
        INSERT INTO sys_menus (
            id, parent_id, title, type, permission, path, component, icon, sort, visible, status, created_at, updated_at
        ) VALUES (
            next_menu_id, project_parent_id, '报价清单', 2, 'project:edit', '/projects/quotes/lists', 'pages/quotes/QuoteListManagement',
            'UnorderedListOutlined', 4, true, 1, NOW(), NOW()
        )
        RETURNING id INTO quote_lists_menu_id;
    END IF;

    SELECT id INTO quote_compare_menu_id
    FROM sys_menus
    WHERE path = '/projects/quotes/compare/:id'
    ORDER BY id
    LIMIT 1;

    IF quote_compare_menu_id IS NULL THEN
        SELECT COALESCE(MAX(id), 0) + 1 INTO next_menu_id FROM sys_menus;
        INSERT INTO sys_menus (
            id, parent_id, title, type, permission, path, component, icon, sort, visible, status, created_at, updated_at
        ) VALUES (
            next_menu_id, project_parent_id, '报价对比', 2, 'project:view', '/projects/quotes/compare/:id', 'pages/quotes/QuoteComparison',
            'FileTextOutlined', 5, false, 1, NOW(), NOW()
        )
        RETURNING id INTO quote_compare_menu_id;
    END IF;

    INSERT INTO sys_role_menus (role_id, menu_id)
    SELECT DISTINCT rm.role_id, quote_library_menu_id
    FROM sys_role_menus rm
    JOIN sys_menus m ON m.id = rm.menu_id
    WHERE m.path = '/projects/list'
      AND NOT EXISTS (
        SELECT 1 FROM sys_role_menus existing
        WHERE existing.role_id = rm.role_id AND existing.menu_id = quote_library_menu_id
      );

    INSERT INTO sys_role_menus (role_id, menu_id)
    SELECT DISTINCT rm.role_id, quote_lists_menu_id
    FROM sys_role_menus rm
    JOIN sys_menus m ON m.id = rm.menu_id
    WHERE m.permission = 'project:edit'
      AND NOT EXISTS (
        SELECT 1 FROM sys_role_menus existing
        WHERE existing.role_id = rm.role_id AND existing.menu_id = quote_lists_menu_id
      );

    INSERT INTO sys_role_menus (role_id, menu_id)
    SELECT DISTINCT rm.role_id, quote_compare_menu_id
    FROM sys_role_menus rm
    JOIN sys_menus m ON m.id = rm.menu_id
    WHERE m.permission = 'project:view'
      AND NOT EXISTS (
        SELECT 1 FROM sys_role_menus existing
        WHERE existing.role_id = rm.role_id AND existing.menu_id = quote_compare_menu_id
      );
END $$;
