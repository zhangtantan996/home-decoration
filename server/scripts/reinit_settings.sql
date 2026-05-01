-- 重新插入系统设置（使用UTF8编码）
SET CLIENT_ENCODING TO 'UTF8';

INSERT INTO system_settings (key, value, description, category, created_at, updated_at)
VALUES
-- 基本设置
('site_name', '禾泽云', '网站名称', 'basic', NOW(), NOW()),
('site_description', '家装服务撮合、交易流程管理与履约协同平台', '网站描述', 'basic', NOW(), NOW()),
('contact_email', '', '联系邮箱', 'basic', NOW(), NOW()),
('contact_phone', '17764774797', '联系电话', 'basic', NOW(), NOW()),
('icp', '陕ICP备2026004441号', 'ICP备案号', 'basic', NOW(), NOW()),
-- 短信配置  
('sms_provider', '', '短信服务商', 'sms', NOW(), NOW()),
('sms_sign_name', '', '短信签名', 'sms', NOW(), NOW()),
('sms_template_id', '', '短信模板ID', 'sms', NOW(), NOW()),
-- 腾讯云 IM 配置
('im_tencent_enabled', 'false', '是否启用腾讯云IM', 'im', NOW(), NOW()),
('im_tencent_sdk_app_id', '', '腾讯云IM SDKAppID', 'im', NOW(), NOW())
ON CONFLICT (key) DO UPDATE SET
    value = EXCLUDED.value,
    description = EXCLUDED.description,
    category = EXCLUDED.category;

-- 验证插入
SELECT key, value FROM system_settings WHERE category IN ('basic', 'sms', 'im') ORDER BY category, key;
