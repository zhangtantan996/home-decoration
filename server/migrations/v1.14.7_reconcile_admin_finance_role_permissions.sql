-- 收口 Admin 资金权限：
-- 1. 非 finance/super_admin 不持有资金审批、冻结、解冻、导出权限。
-- 2. viewer 仅保留资金中心只读入口，不进入退款审核。
-- 3. finance 补齐资金中心全部菜单/按钮权限。

DO $$
DECLARE
    finance_role_id BIGINT := 0;
    finance_parent_id BIGINT := 0;
    payout_menu_id BIGINT := 0;
    settlement_menu_id BIGINT := 0;
BEGIN
    SELECT id INTO finance_role_id FROM sys_roles WHERE key = 'finance' LIMIT 1;
    SELECT id INTO finance_parent_id
    FROM sys_menus
    WHERE path = '/finance'
       OR title IN ('资金中心', '财务管理', '资金管理')
    ORDER BY id ASC
    LIMIT 1;

    IF finance_parent_id IS NULL THEN
        finance_parent_id := 0;
    END IF;

    SELECT id INTO payout_menu_id
    FROM sys_menus
    WHERE path = '/finance/payouts'
       OR component = 'pages/finance/PayoutList'
    ORDER BY id ASC
    LIMIT 1;

    IF payout_menu_id IS NULL OR payout_menu_id = 0 THEN
        INSERT INTO sys_menus (
            parent_id, title, type, permission, path, component, icon, sort, visible, status, created_at, updated_at
        )
        VALUES (
            finance_parent_id, '自动出款', 2, 'finance:transaction:list', '/finance/payouts', 'pages/finance/PayoutList', 'AccountBookOutlined', 6, true, 1, NOW(), NOW()
        )
        RETURNING id INTO payout_menu_id;
    ELSE
        UPDATE sys_menus
        SET
            parent_id = finance_parent_id,
            title = '自动出款',
            type = 2,
            permission = 'finance:transaction:list',
            path = '/finance/payouts',
            component = 'pages/finance/PayoutList',
            icon = 'AccountBookOutlined',
            sort = 6,
            visible = true,
            status = 1,
            updated_at = NOW()
        WHERE id = payout_menu_id;
    END IF;

    SELECT id INTO settlement_menu_id
    FROM sys_menus
    WHERE path = '/finance/settlements'
       OR component = 'pages/finance/SettlementList'
    ORDER BY id ASC
    LIMIT 1;

    IF settlement_menu_id IS NULL OR settlement_menu_id = 0 THEN
        INSERT INTO sys_menus (
            parent_id, title, type, permission, path, component, icon, sort, visible, status, created_at, updated_at
        )
        VALUES (
            finance_parent_id, '结算单', 2, 'finance:transaction:list', '/finance/settlements', 'pages/finance/SettlementList', 'AccountBookOutlined', 7, true, 1, NOW(), NOW()
        )
        RETURNING id INTO settlement_menu_id;
    ELSE
        UPDATE sys_menus
        SET
            parent_id = finance_parent_id,
            title = '结算单',
            type = 2,
            permission = 'finance:transaction:list',
            path = '/finance/settlements',
            component = 'pages/finance/SettlementList',
            icon = 'AccountBookOutlined',
            sort = 7,
            visible = true,
            status = 1,
            updated_at = NOW()
        WHERE id = settlement_menu_id;
    END IF;

    DELETE FROM sys_role_menus rm
    USING sys_roles r, sys_menus m
    WHERE rm.role_id = r.id
      AND rm.menu_id = m.id
      AND r.key NOT IN ('super_admin', 'finance')
      AND m.permission IN (
          'finance:escrow:freeze',
          'finance:escrow:unfreeze',
          'finance:transaction:approve',
          'finance:transaction:export'
      );

    DELETE FROM sys_role_menus rm
    USING sys_roles r, sys_menus m
    WHERE rm.role_id = r.id
      AND rm.menu_id = m.id
      AND r.key = 'viewer'
      AND (
          m.path = '/refunds'
          OR (
              (
                  m.path LIKE '/finance%'
                  OR m.permission LIKE 'finance:%'
              )
              AND m.id NOT IN (
                  SELECT id
                  FROM sys_menus
                  WHERE path IN (
                      '/finance',
                      '/finance/overview',
                      '/finance/payment-orders',
                      '/finance/escrow',
                      '/finance/transactions',
                      '/finance/payouts',
                      '/finance/settlements'
                  )
                     OR permission IN (
                         'finance:escrow:list',
                         'finance:escrow:view',
                         'finance:transaction:list',
                         'finance:transaction:view'
                     )
              )
          )
      );

    IF finance_role_id IS NOT NULL AND finance_role_id <> 0 THEN
        INSERT INTO sys_role_menus (role_id, menu_id, created_at, updated_at)
        SELECT finance_role_id, m.id, NOW(), NOW()
        FROM sys_menus m
        WHERE (
            m.path IN (
                '/finance',
                '/finance/overview',
                '/finance/payment-orders',
                '/finance/escrow',
                '/finance/transactions',
                '/finance/payouts',
                '/finance/settlements',
                '/refunds'
            )
            OR m.permission LIKE 'finance:%'
        )
          AND NOT EXISTS (
              SELECT 1
              FROM sys_role_menus existing
              WHERE existing.role_id = finance_role_id
                AND existing.menu_id = m.id
          );
    END IF;
END $$;
