BEGIN;

CREATE UNIQUE INDEX IF NOT EXISTS idx_sys_menus_button_permission_unique
    ON sys_menus(permission)
    WHERE type = 3 AND permission <> '';

COMMIT;
