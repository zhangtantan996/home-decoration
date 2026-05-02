-- 收口 Admin 资金权限：
-- 1. 非 finance/super_admin 不持有资金审批、冻结、解冻、导出权限。
-- 2. viewer 仅保留资金中心只读入口，不进入退款审核。
-- 3. finance 补齐资金中心全部菜单/按钮权限。

DO $$
DECLARE
    finance_role_id BIGINT := 0;
BEGIN
    SELECT id INTO finance_role_id FROM sys_roles WHERE key = 'finance' LIMIT 1;

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
