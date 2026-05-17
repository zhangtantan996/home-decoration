-- Grant Ops workspace roles access to project management and supervisor assignment screens.
-- Keeps Ops focused on project build-out and assignment, without opening supervisor account governance.

WITH target_roles AS (
    SELECT id
    FROM sys_roles
    WHERE key IN ('operations', 'product_manager', 'system_admin')
), target_menus AS (
    SELECT id
    FROM sys_menus
    WHERE path IN (
        '/projects',
        '/projects/list',
        '/supervisors/assignments'
    )
       OR permission IN (
        'project:list',
        'project:view',
        'project:edit',
        'supervision:assignment:manage'
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
