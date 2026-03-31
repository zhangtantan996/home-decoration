BEGIN;

DO $$
DECLARE
    canonical_order_center_id BIGINT := 0;
    duplicate_order_center_id BIGINT := 0;
    canonical_order_center_view_id BIGINT := 0;
    duplicate_order_center_view_id BIGINT := 0;
    canonical_proposal_review_id BIGINT := 0;
    duplicate_proposal_review_id BIGINT := 0;
    canonical_audit_logs_id BIGINT := 0;
    duplicate_audit_logs_id BIGINT := 0;
    canonical_finance_overview_id BIGINT := 0;
    duplicate_finance_overview_id BIGINT := 0;
    canonical_demand_center_id BIGINT := 0;
    duplicate_demand_center_id BIGINT := 0;
    cases_manage_menu_id BIGINT := 0;
BEGIN
    -- 订单控制台：保留最早的主菜单与权限点，合并角色绑定后删除重复项。
    SELECT id INTO canonical_order_center_id
    FROM sys_menus
    WHERE path = '/orders'
    ORDER BY id ASC
    LIMIT 1;

    IF canonical_order_center_id IS NOT NULL AND canonical_order_center_id <> 0 THEN
        SELECT id INTO canonical_order_center_view_id
        FROM sys_menus
        WHERE permission = 'order:center:view'
        ORDER BY id ASC
        LIMIT 1;

        SELECT id INTO canonical_proposal_review_id
        FROM sys_menus
        WHERE permission = 'proposal:review'
        ORDER BY id ASC
        LIMIT 1;

        FOR duplicate_order_center_view_id IN
            SELECT id
            FROM sys_menus
            WHERE permission = 'order:center:view'
              AND id <> canonical_order_center_view_id
            ORDER BY id DESC
        LOOP
            INSERT INTO sys_role_menus (role_id, menu_id)
            SELECT role_id, canonical_order_center_view_id
            FROM sys_role_menus
            WHERE menu_id = duplicate_order_center_view_id
            ON CONFLICT DO NOTHING;

            DELETE FROM sys_role_menus WHERE menu_id = duplicate_order_center_view_id;
            DELETE FROM sys_menus WHERE id = duplicate_order_center_view_id;
        END LOOP;

        FOR duplicate_proposal_review_id IN
            SELECT id
            FROM sys_menus
            WHERE permission = 'proposal:review'
              AND id <> canonical_proposal_review_id
            ORDER BY id DESC
        LOOP
            INSERT INTO sys_role_menus (role_id, menu_id)
            SELECT role_id, canonical_proposal_review_id
            FROM sys_role_menus
            WHERE menu_id = duplicate_proposal_review_id
            ON CONFLICT DO NOTHING;

            DELETE FROM sys_role_menus WHERE menu_id = duplicate_proposal_review_id;
            DELETE FROM sys_menus WHERE id = duplicate_proposal_review_id;
        END LOOP;

        FOR duplicate_order_center_id IN
            SELECT id
            FROM sys_menus
            WHERE path = '/orders'
              AND id <> canonical_order_center_id
            ORDER BY id DESC
        LOOP
            INSERT INTO sys_role_menus (role_id, menu_id)
            SELECT role_id, canonical_order_center_id
            FROM sys_role_menus
            WHERE menu_id = duplicate_order_center_id
            ON CONFLICT DO NOTHING;

            DELETE FROM sys_role_menus WHERE menu_id = duplicate_order_center_id;
            DELETE FROM sys_menus WHERE id = duplicate_order_center_id;
        END LOOP;
    END IF;

    -- 业务审计日志：按 path 去重。
    SELECT id INTO canonical_audit_logs_id
    FROM sys_menus
    WHERE path = '/audit-logs'
    ORDER BY id ASC
    LIMIT 1;

    IF canonical_audit_logs_id IS NOT NULL AND canonical_audit_logs_id <> 0 THEN
        FOR duplicate_audit_logs_id IN
            SELECT id
            FROM sys_menus
            WHERE path = '/audit-logs'
              AND id <> canonical_audit_logs_id
            ORDER BY id DESC
        LOOP
            INSERT INTO sys_role_menus (role_id, menu_id)
            SELECT role_id, canonical_audit_logs_id
            FROM sys_role_menus
            WHERE menu_id = duplicate_audit_logs_id
            ON CONFLICT DO NOTHING;

            DELETE FROM sys_role_menus WHERE menu_id = duplicate_audit_logs_id;
            DELETE FROM sys_menus WHERE id = duplicate_audit_logs_id;
        END LOOP;
    END IF;

    -- 资金概览：按 path 去重。
    SELECT id INTO canonical_finance_overview_id
    FROM sys_menus
    WHERE path = '/finance/overview'
    ORDER BY id ASC
    LIMIT 1;

    IF canonical_finance_overview_id IS NOT NULL AND canonical_finance_overview_id <> 0 THEN
        FOR duplicate_finance_overview_id IN
            SELECT id
            FROM sys_menus
            WHERE path = '/finance/overview'
              AND id <> canonical_finance_overview_id
            ORDER BY id DESC
        LOOP
            INSERT INTO sys_role_menus (role_id, menu_id)
            SELECT role_id, canonical_finance_overview_id
            FROM sys_role_menus
            WHERE menu_id = duplicate_finance_overview_id
            ON CONFLICT DO NOTHING;

            DELETE FROM sys_role_menus WHERE menu_id = duplicate_finance_overview_id;
            DELETE FROM sys_menus WHERE id = duplicate_finance_overview_id;
        END LOOP;
    END IF;

    -- 需求中心：优先保留带 demand:center 权限的那棵正确菜单树。
    SELECT id INTO canonical_demand_center_id
    FROM sys_menus
    WHERE path = '/demands'
      AND permission = 'demand:center'
    ORDER BY id ASC
    LIMIT 1;

    IF canonical_demand_center_id IS NULL OR canonical_demand_center_id = 0 THEN
        SELECT id INTO canonical_demand_center_id
        FROM sys_menus
        WHERE path = '/demands'
        ORDER BY id ASC
        LIMIT 1;
    END IF;

    SELECT id INTO cases_manage_menu_id
    FROM sys_menus
    WHERE path = '/cases/manage'
    ORDER BY id ASC
    LIMIT 1;

    IF canonical_demand_center_id IS NOT NULL AND canonical_demand_center_id <> 0 THEN
        UPDATE sys_menus
        SET parent_id = canonical_demand_center_id,
            updated_at = NOW()
        WHERE permission IN ('demand:list', 'demand:review', 'demand:assign');

        FOR duplicate_demand_center_id IN
            SELECT id
            FROM sys_menus
            WHERE path = '/demands'
              AND id <> canonical_demand_center_id
            ORDER BY id DESC
        LOOP
            UPDATE sys_menus
            SET parent_id = COALESCE(cases_manage_menu_id, 0),
                updated_at = NOW()
            WHERE permission IN ('case:audit:view', 'case:audit:approve', 'case:audit:reject')
              AND parent_id = duplicate_demand_center_id;

            INSERT INTO sys_role_menus (role_id, menu_id)
            SELECT role_id, canonical_demand_center_id
            FROM sys_role_menus
            WHERE menu_id = duplicate_demand_center_id
            ON CONFLICT DO NOTHING;

            DELETE FROM sys_role_menus WHERE menu_id = duplicate_demand_center_id;
            DELETE FROM sys_menus WHERE id = duplicate_demand_center_id;
        END LOOP;
    END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS idx_sys_menus_path_unique_nonempty
    ON sys_menus(path)
    WHERE path <> '';

COMMIT;
