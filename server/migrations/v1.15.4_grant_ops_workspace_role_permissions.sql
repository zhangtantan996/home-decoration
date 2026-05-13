-- Grant Ops workspace permissions to the role whitelist used by the Ops portal.
-- Ops is now the temporary maintenance surface while merchant / supervisor / user-web portals are offline.

WITH target_roles AS (
    SELECT id
    FROM sys_roles
    WHERE key IN ('operations', 'product_manager', 'system_admin')
), target_menus AS (
    SELECT id
    FROM sys_menus
    WHERE path IN (
        '/dashboard',
        '/providers',
        '/providers/designers',
        '/providers/companies',
        '/providers/foremen',
        '/materials',
        '/materials/list',
        '/bookings',
        '/bookings/list',
        '/cases',
        '/cases/manage',
        '/logs',
        '/logs/list',
        '/audit-logs'
    )
       OR permission IN (
        'dashboard:view',
        'provider:designer:list', 'provider:designer:create', 'provider:designer:edit',
        'provider:company:list', 'provider:company:create', 'provider:company:edit',
        'provider:foreman:list', 'provider:foreman:create', 'provider:foreman:edit',
        'material:shop:list', 'material:shop:create', 'material:shop:edit',
        'booking:list', 'booking:edit',
        'system:case:list', 'system:case:view',
        'system:log:list'
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
