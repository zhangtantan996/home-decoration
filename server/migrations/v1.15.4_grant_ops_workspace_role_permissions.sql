-- Grant Ops workspace permissions to the role whitelist used by the Ops portal.
-- Ops is now the temporary maintenance surface while merchant / supervisor / user-web portals are offline.

WITH target_roles AS (
    SELECT id
    FROM sys_roles
    WHERE key IN ('operations', 'product_manager', 'system_admin')
), target_menus AS (
    SELECT id
    FROM sys_menus
    WHERE key IN (
        'dashboard',
        'providers_root',
        'provider_designers', 'provider_designer_view', 'provider_designer_create', 'provider_designer_edit',
        'provider_companies', 'provider_company_view', 'provider_company_create', 'provider_company_edit',
        'provider_foremen', 'provider_foreman_view', 'provider_foreman_create', 'provider_foreman_edit',
        'materials_root', 'materials_list', 'material_shop_view', 'material_shop_create', 'material_shop_edit',
        'bookings_root', 'bookings_list', 'booking_view', 'booking_edit',
        'cases_root', 'cases_manage',
        'logs_root', 'logs_list', 'log_view', 'audit_logs'
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
