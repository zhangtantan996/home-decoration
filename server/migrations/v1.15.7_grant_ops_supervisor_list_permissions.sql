-- Grant Ops workspace roles access to the supervisor pool read-side APIs.
-- Project create / assign flows in Ops read available supervisors before assigning,
-- so assignment-capable roles also need supervisor:list.

WITH target_roles AS (
    SELECT id
    FROM sys_roles
    WHERE key IN ('operations', 'product_manager', 'system_admin')
), target_menus AS (
    SELECT id
    FROM sys_menus
    WHERE path IN (
        '/supervisors/list',
        '/supervisors/whitelist',
        '/supervisors/applications'
    )
       OR permission IN (
        'supervision:supervisor:list'
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
