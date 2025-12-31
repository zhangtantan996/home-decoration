-- 管理后台示例数据初始化SQL

-- 1. 插入测试管理员 (密码: admin123, 已bcrypt加密)
INSERT INTO admins (username, phone, email, password, role, status, created_at, updated_at)
VALUES
('admin', '13800138000', 'admin@example.com', '$2a$10$EixZaYVK1fsbw1ZfbX3OXePaWxn96p36WQoeG6Lruj3vjPGga31lW', 'super', 1, NOW(), NOW()),
('operator1', '13800138001', 'operator1@example.com', '$2a$10$EixZaYVK1fsbw1ZfbX3OXePaWxn96p36WQoeG6Lruj3vjPGga31lW', 'operator', 1, NOW(), NOW())
ON CONFLICT (username) DO NOTHING;

-- 2. 插入服务商资质审核示例数据
INSERT INTO provider_audits (provider_id, provider_type, company_name, contact_person, contact_phone, business_license, certificates, status, submit_time, created_at, updated_at)
VALUES
(1, 1, '张设计工作室', '张伟', '13900139000', 'https://example.com/license1.jpg', '["https://example.com/cert1.jpg","https://example.com/cert2.jpg"]', 0, NOW(), NOW(), NOW()),
(2, 2, '优质装修公司', '李明', '13900139001', 'https://example.com/license2.jpg', '["https://example.com/cert3.jpg"]', 0, NOW(), NOW(), NOW()),
(3, 3, '王工长团队', '王强', '13900139002', 'https://example.com/license3.jpg', '["https://example.com/cert4.jpg"]', 1, NOW() - INTERVAL '2 days', NOW(), NOW())
ON CONFLICT DO NOTHING;

-- 3. 插入门店认证审核示例数据
INSERT INTO material_shop_audits (shop_id, shop_name, type, brand_name, address, contact_person, contact_phone, business_license, store_front, status, submit_time, created_at, updated_at)
VALUES
(1, '欧派橱柜旗舰店', 'brand', '欧派', '北京市朝阳区建材城A区101', '刘经理', '13900139003', 'https://example.com/license4.jpg', '["https://example.com/store1.jpg","https://example.com/store2.jpg"]', 0, NOW(), NOW(), NOW()),
(2, '家居建材展厅', 'showroom', '综合', '上海市浦东新区世纪大道100号', '陈经理', '13900139004', 'https://example.com/license5.jpg', '["https://example.com/store3.jpg"]', 0, NOW(), NOW(), NOW())
ON CONFLICT DO NOTHING;

-- 4. 插入托管账户示例数据（扩展字段）
-- 注意：需要先有项目数据
UPDATE escrow_accounts SET
    user_name = '张业主',
    project_name = '海淀区三居室装修',
    available_amount = total_amount - frozen_amount - released_amount
WHERE id = 1;

-- 5. 插入交易记录示例数据
INSERT INTO transactions (order_id, escrow_id, milestone_id, type, amount, from_user_id, from_account, to_user_id, to_account, status, remark, created_at, updated_at, completed_at)
VALUES
('DEP' || EXTRACT(EPOCH FROM NOW())::BIGINT || '001', 1, 0, 'deposit', 50000.00, 1, '张业主账户', 0, '托管账户', 1, '项目启动款', NOW() - INTERVAL '5 days', NOW(), NOW() - INTERVAL '5 days'),
('REL' || EXTRACT(EPOCH FROM NOW())::BIGINT || '002', 1, 1, 'release', 15000.00, 0, '托管账户', 2, '设计师账户', 1, '设计阶段款项', NOW() - INTERVAL '3 days', NOW(), NOW() - INTERVAL '3 days'),
('WD' || EXTRACT(EPOCH FROM NOW())::BIGINT || '003', 1, 0, 'withdraw', 5000.00, 1, '托管账户', 1, '张业主账户', 0, '退款申请', NOW(), NOW(), NULL)
ON CONFLICT DO NOTHING;

-- 6. 插入风险预警示例数据
INSERT INTO risk_warnings (project_id, project_name, type, level, description, status, created_at, updated_at)
VALUES
(1, '海淀区三居室装修', 'delay', 'medium', '项目进度延期3天，可能影响整体工期', 0, NOW(), NOW()),
(2, '朝阳区复式装修', 'payment', 'high', '业主付款逾期5天，需尽快跟进', 0, NOW(), NOW()),
(3, '西城区老房改造', 'quality', 'low', '墙面找平度略有偏差，建议整改', 2, NOW() - INTERVAL '1 day', NOW())
ON CONFLICT DO NOTHING;

-- 7. 插入仲裁示例数据
INSERT INTO arbitrations (project_id, project_name, applicant, respondent, reason, evidence, status, created_at, updated_at)
VALUES
(1, '海淀区三居室装修', '张业主', '李设计师', '设计方案与合同约定不符，要求退款或重新设计', '["https://example.com/evidence1.jpg","https://example.com/evidence2.pdf"]', 0, NOW(), NOW()),
(2, '朝阳区复式装修', '优质装修公司', '王业主', '业主拒绝支付尾款，理由不充分', '["https://example.com/evidence3.jpg"]', 1, NOW() - INTERVAL '2 days', NOW())
ON CONFLICT DO NOTHING;

-- 8. 插入系统设置示例数据
INSERT INTO system_settings (key, value, description, category, created_at, updated_at)
VALUES
-- 基本设置
('site_name', '家装管理平台', '网站名称', 'basic', NOW(), NOW()),
('site_description', '专业的家装服务管理系统', '网站描述', 'basic', NOW(), NOW()),
('contact_email', 'support@example.com', '联系邮箱', 'basic', NOW(), NOW()),
('contact_phone', '400-888-8888', '联系电话', 'basic', NOW(), NOW()),
('icp', '京ICP备12345678号', 'ICP备案号', 'basic', NOW(), NOW()),
-- 功能开关
('enable_registration', 'true', '是否允许用户注册', 'security', NOW(), NOW()),
('enable_sms_verify', 'true', '是否开启短信验证', 'security', NOW(), NOW()),
('enable_email_verify', 'false', '是否开启邮箱验证', 'security', NOW(), NOW()),
('min_password_length', '6', '最小密码长度', 'security', NOW(), NOW()),
('session_timeout', '30', '会话超时时间（分钟）', 'security', NOW(), NOW()),
('max_upload_size', '10', '最大上传文件大小（MB）', 'security', NOW(), NOW()),
-- 微信支付配置
('wechat_app_id', '', '微信支付AppID', 'payment', NOW(), NOW()),
('wechat_mch_id', '', '微信支付商户号', 'payment', NOW(), NOW()),
('wechat_api_key', '', '微信支付API密钥', 'payment', NOW(), NOW()),
-- 支付宝配置
('alipay_app_id', '', '支付宝AppID', 'payment', NOW(), NOW()),
('alipay_private_key', '', '支付宝应用私钥', 'payment', NOW(), NOW()),
('alipay_public_key', '', '支付宝公钥', 'payment', NOW(), NOW()),
-- 短信配置
('sms_provider', '', '短信服务商（阿里云/腾讯云等）', 'sms', NOW(), NOW()),
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

-- 9. 插入操作日志示例数据
INSERT INTO admin_logs (admin_id, admin_name, action, resource, resource_id, method, path, ip, user_agent, status, created_at, updated_at)
VALUES
(1, 'admin', '审核通过', 'provider_audit', 3, 'POST', '/api/v1/admin/audits/providers/3/approve', '127.0.0.1', 'Mozilla/5.0', 200, NOW() - INTERVAL '1 hour', NOW()),
(1, 'admin', '创建管理员', 'admin', 2, 'POST', '/api/v1/admin/admins', '127.0.0.1', 'Mozilla/5.0', 200, NOW() - INTERVAL '2 hours', NOW()),
(2, 'operator1', '更新系统设置', 'system_settings', 0, 'PUT', '/api/v1/admin/settings', '127.0.0.1', 'Mozilla/5.0', 200, NOW() - INTERVAL '3 hours', NOW())
ON CONFLICT DO NOTHING;

-- 完成提示
SELECT '示例数据初始化完成！' AS message;
SELECT '默认管理员账号：admin / admin123' AS tip;
