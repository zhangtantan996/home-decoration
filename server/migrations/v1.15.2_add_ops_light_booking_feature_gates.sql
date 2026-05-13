-- Ops Web and light-booking feature gates.
-- Default closed for production rollout; local/test can explicitly enable through Admin config when needed.

INSERT INTO system_configs (key, value, type, description, editable, created_at, updated_at)
SELECT 'platform.merchant_portal_enabled', 'false', 'boolean', '是否开放商家端登录、入驻与工作台', true, NOW(), NOW()
WHERE NOT EXISTS (SELECT 1 FROM system_configs WHERE key = 'platform.merchant_portal_enabled');

INSERT INTO system_configs (key, value, type, description, editable, created_at, updated_at)
SELECT 'platform.supervisor_portal_enabled', 'false', 'boolean', '是否开放监理端登录、入驻与工作台', true, NOW(), NOW()
WHERE NOT EXISTS (SELECT 1 FROM system_configs WHERE key = 'platform.supervisor_portal_enabled');

INSERT INTO system_configs (key, value, type, description, editable, created_at, updated_at)
SELECT 'platform.transaction_flow_enabled', 'false', 'boolean', '是否开放订单、支付、退款、投诉和履约主链路', true, NOW(), NOW()
WHERE NOT EXISTS (SELECT 1 FROM system_configs WHERE key = 'platform.transaction_flow_enabled');

INSERT INTO system_configs (key, value, type, description, editable, created_at, updated_at)
SELECT 'platform.mini_progress_enabled', 'false', 'boolean', '是否开放小程序项目进度入口', true, NOW(), NOW()
WHERE NOT EXISTS (SELECT 1 FROM system_configs WHERE key = 'platform.mini_progress_enabled');
