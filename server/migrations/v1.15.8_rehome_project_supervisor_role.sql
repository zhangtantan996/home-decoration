-- Retire the admin-only project_supervisor role and migrate its governance
-- permissions to the remaining Ops management roles.

WITH target_roles AS (
    SELECT id
    FROM sys_roles
    WHERE key IN ('operations', 'product_manager', 'system_admin')
), target_menus AS (
    SELECT id
    FROM sys_menus
    WHERE path IN (
        '/supervision',
        '/supervision/projects'
    )
       OR permission IN (
        'supervision:workspace:view',
        'supervision:workspace:edit',
        'supervision:risk:create'
       )
)
INSERT INTO sys_role_menus (role_id, menu_id)
SELECT r.id, m.id
FROM target_roles r
CROSS JOIN target_menus m
WHERE NOT EXISTS (
    SELECT 1
    FROM sys_role_menus existing
    WHERE existing.role_id = r.id
      AND existing.menu_id = m.id
);

DELETE FROM sys_admin_roles
WHERE role_id IN (
    SELECT id
    FROM sys_roles
    WHERE key = 'project_supervisor'
);

UPDATE sys_roles
SET status = 0,
    remark = CASE
        WHEN coalesce(remark, '') = '' THEN '已废弃：监理后台角色已下线，治理权限迁移至 Ops 管理角色'
        ELSE remark || '（已废弃：监理后台角色已下线，治理权限迁移至 Ops 管理角色）'
    END
WHERE key = 'project_supervisor'
  AND status <> 0;
