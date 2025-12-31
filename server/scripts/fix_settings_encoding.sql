-- 修复系统设置中文字段的编码问题
UPDATE system_settings SET value = '家装管理平台' WHERE key = 'site_name';
UPDATE system_settings SET value = '专业的家装服务管理系统' WHERE key = 'site_description';
UPDATE system_settings SET value = '京ICP备12345678号' WHERE key = 'icp';
UPDATE system_settings SET description = '短信服务商（阿里云/腾讯云等）' WHERE key = 'sms_provider';
UPDATE system_settings SET description = '短信服务AccessKey' WHERE key = 'sms_access_key';
UPDATE system_settings SET description = '短信服务SecretKey' WHERE key = 'sms_secret_key';
UPDATE system_settings SET description = '短信签名' WHERE key = 'sms_sign_name';
UPDATE system_settings SET description = '短信模板ID' WHERE key = 'sms_template_id';
UPDATE system_settings SET description = '是否允许用户注册' WHERE key = 'enable_registration';
UPDATE system_settings SET description = '是否开启短信验证' WHERE key = 'sms_verify';
UPDATE system_settings SET description = '是否开启邮箱验证' WHERE key = 'enable_email_verify';
UPDATE system_settings SET description = '最小密码长度' WHERE key = 'min_password_length';
UPDATE system_settings SET description = '会话超时时间（分钟）' WHERE key = 'session_timeout';
UPDATE system_settings SET description = '最大上传文件大小（MB）' WHERE key = 'max_upload_size';
UPDATE system_settings SET description = '网站名称' WHERE key = 'site_name';
UPDATE system_settings SET description = '网站描述' WHERE key = 'site_description';
UPDATE system_settings SET description = '联系邮箱' WHERE key = 'contact_email';
UPDATE system_settings SET description = '联系电话' WHERE key = 'contact_phone';

SELECT 'System settings updated successfully!' AS message;
