-- 重新插入系统设置（使用UTF8编码）
SET CLIENT_ENCODING TO 'UTF8';

INSERT INTO system_settings (key, value, description, category, created_at, updated_at)
VALUES
-- 基本设置
('site_name', '家装管理平台', '网站名称', 'basic', NOW(), NOW()),
('site_description', '专业的家装服务管理系统', '网站描述', 'basic', NOW(), NOW()),
('contact_email', 'support@example.com', '联系邮箱', 'basic', NOW(), NOW()),
('contact_phone', '400-888-8888', '联系电话', 'basic', NOW(), NOW()),
('icp', '京ICP备12345678号', 'ICP备案号', 'basic', NOW(), NOW()),
-- 短信配置  
('sms_provider', '', '短信服务商', 'sms', NOW(), NOW()),
('sms_access_key', '', '短信服务AccessKey', 'sms', NOW(), NOW()),
('sms_secret_key', '', '短信服务SecretKey', 'sms', NOW(), NOW()),
('sms_sign_name', '', '短信签名', 'sms', NOW(), NOW()),
('sms_template_id', '', '短信模板ID', 'sms', NOW(), NOW()),
-- 腾讯云 IM 配置
('im_tencent_enabled', 'false', '是否启用腾讯云IM', 'im', NOW(), NOW()),
('im_tencent_sdk_app_id', '', '腾讯云IM SDKAppID', 'im', NOW(), NOW()),
('im_tencent_secret_key', '', '腾讯云IM SecretKey', 'im', NOW(), NOW())
ON CONFLICT (key) DO UPDATE SET
    value = EXCLUDED.value,
    description = EXCLUDED.description,
    category = EXCLUDED.category;

-- 验证插入
SELECT key, value FROM system_settings WHERE category IN ('basic', 'sms', 'im') ORDER BY category, key;
