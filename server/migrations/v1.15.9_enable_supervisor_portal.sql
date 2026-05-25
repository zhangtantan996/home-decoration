-- Open supervisor portal for this rollout.
-- The frontend already builds with VITE_SUPERVISOR_PORTAL_ENABLED=true; this aligns the backend feature gate.

INSERT INTO system_configs (key, value, type, description, editable, created_at, updated_at)
SELECT 'platform.supervisor_portal_enabled', 'true', 'boolean', '是否开放监理端登录、入驻与工作台', true, NOW(), NOW()
WHERE NOT EXISTS (SELECT 1 FROM system_configs WHERE key = 'platform.supervisor_portal_enabled');

UPDATE system_configs
SET value = 'true',
    type = 'boolean',
    description = '是否开放监理端登录、入驻与工作台',
    editable = true,
    updated_at = NOW()
WHERE key = 'platform.supervisor_portal_enabled'
  AND COALESCE(value, '') <> 'true';
