-- 回滚“身份申请审核”菜单与权限点（identity:application:audit）
-- 仅回滚 RBAC 菜单与角色授权，不影响业务数据（identity_applications 等）

DO $$
DECLARE
    target_menu_count INT := 0;
BEGIN
    SELECT COUNT(1) INTO target_menu_count
    FROM sys_menus
    WHERE permission = 'identity:application:audit'
       OR path IN ('/providers/identity-applications', '/audits/identity-applications');

    -- 先删角色授权
    DELETE FROM sys_role_menus
    WHERE menu_id IN (
        SELECT id
        FROM sys_menus
        WHERE permission = 'identity:application:audit'
           OR path IN ('/providers/identity-applications', '/audits/identity-applications')
    );

    -- 再删菜单
    DELETE FROM sys_menus
    WHERE permission = 'identity:application:audit'
       OR path IN ('/providers/identity-applications', '/audits/identity-applications');

    RAISE NOTICE '已回滚身份申请审核菜单，删除记录数: %', target_menu_count;
END $$;
