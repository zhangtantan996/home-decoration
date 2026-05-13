-- Mini program comment feature gate.
-- Default closed for light-booking rollout; existing comments are retained for future recovery.

INSERT INTO system_configs (key, value, type, description, editable, created_at, updated_at)
SELECT 'platform.mini_comments_enabled', 'false', 'boolean', '是否开放小程序灵感评论功能', true, NOW(), NOW()
WHERE NOT EXISTS (SELECT 1 FROM system_configs WHERE key = 'platform.mini_comments_enabled');
