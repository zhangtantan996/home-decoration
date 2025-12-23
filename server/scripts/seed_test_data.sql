-- =============================================================================
-- 测试数据种子脚本 (Seed Test Data)
-- 用于首页推荐功能测试
-- 所有测试数据带有 [TEST] 标记，方便后续清理
-- =============================================================================

-- 先清理已有的测试数据（避免重复插入）
DELETE FROM providers WHERE company_name LIKE '%[TEST]%';
DELETE FROM users WHERE nickname LIKE '%[TEST]%';

-- =============================================================================
-- 1. 创建测试用户 (User)
-- =============================================================================

-- 设计师用户
INSERT INTO users (id, phone, nickname, avatar, password, user_type, status, created_at, updated_at) VALUES
(90001, '13800000001', '张明远 [TEST]', 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?q=80&w=200', '', 2, 1, NOW(), NOW()),
(90002, '13800000002', '李雅婷 [TEST]', 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?q=80&w=200', '', 2, 1, NOW(), NOW()),
(90003, '13800000003', '王建国 [TEST]', 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?q=80&w=200', '', 2, 1, NOW(), NOW()),
(90004, '13800000004', '陈思琪 [TEST]', 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?q=80&w=200', '', 2, 1, NOW(), NOW()),
(90005, '13800000005', '刘伟强 [TEST]', 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?q=80&w=200', '', 2, 1, NOW(), NOW()),
(90006, '13800000006', '周晓燕 [TEST]', 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?q=80&w=200', '', 2, 1, NOW(), NOW());

-- 工长用户
INSERT INTO users (id, phone, nickname, avatar, password, user_type, status, created_at, updated_at) VALUES
(90011, '13900000001', '老李师傅 [TEST]', 'https://images.unsplash.com/photo-1560250097-0b93528c311a?q=80&w=200', '', 3, 1, NOW(), NOW()),
(90012, '13900000002', '张电工 [TEST]', 'https://images.unsplash.com/photo-1566492031773-4f4e44671857?q=80&w=200', '', 3, 1, NOW(), NOW()),
(90013, '13900000003', '王木匠 [TEST]', 'https://images.unsplash.com/photo-1557862921-37829c790f19?q=80&w=200', '', 3, 1, NOW(), NOW()),
(90014, '13900000004', '刘师傅 [TEST]', 'https://images.unsplash.com/photo-1552058544-f2b08422138a?q=80&w=200', '', 3, 1, NOW(), NOW());

-- 公司用户
INSERT INTO users (id, phone, nickname, avatar, password, user_type, status, created_at, updated_at) VALUES
(90021, '13700000001', '匠心装修 [TEST]', 'https://images.unsplash.com/photo-1599305445671-ac291c95aaa9?q=80&w=200', '', 2, 1, NOW(), NOW()),
(90022, '13700000002', '鑫盛建筑 [TEST]', 'https://images.unsplash.com/photo-1560179707-f14e90ef3623?q=80&w=200', '', 2, 1, NOW(), NOW());

-- =============================================================================
-- 2. 创建设计师 (Provider - type=1)
-- =============================================================================

INSERT INTO providers (id, user_id, provider_type, company_name, rating, restore_rate, budget_control, completed_cnt, verified, latitude, longitude, years_experience, specialty, work_types, review_count, price_min, price_max, price_unit, created_at, updated_at) VALUES
(90001, 90001, 1, '独立设计师 [TEST]', 4.9, 96.5, 92.0, 326, true, 31.2304, 121.4737, 8, '现代简约 · 北欧风格', '', 892, 200, 500, '元/㎡', NOW(), NOW()),
(90002, 90002, 1, '雅居设计工作室 [TEST]', 4.8, 94.2, 88.5, 512, true, 31.2345, 121.4802, 12, '新中式 · 轻奢风格', '', 1256, 300, 800, '元/㎡', NOW(), NOW()),
(90003, 90003, 1, '华美装饰设计公司 [TEST]', 4.7, 91.8, 85.0, 892, true, 31.2290, 121.4650, 15, '欧式古典 · 美式田园', '', 2134, 500, 1200, '元/㎡', NOW(), NOW()),
(90004, 90004, 1, '独立设计师 [TEST]', 4.9, 98.0, 95.0, 186, true, 31.2380, 121.4820, 5, '日式原木 · 极简主义', '', 423, 180, 400, '元/㎡', NOW(), NOW()),
(90005, 90005, 1, '强设计工作室 [TEST]', 4.6, 89.5, 82.0, 445, false, 31.2250, 121.4580, 10, '工业风 · 混搭风格', '', 867, 250, 600, '元/㎡', NOW(), NOW()),
(90006, 90006, 1, '燕归来设计公司 [TEST]', 4.8, 93.0, 90.0, 278, true, 31.2200, 121.4500, 7, '法式浪漫 · 地中海风', '', 645, 350, 900, '元/㎡', NOW(), NOW());

-- =============================================================================
-- 3. 创建工长 (Provider - type=3)
-- =============================================================================

INSERT INTO providers (id, user_id, provider_type, company_name, rating, restore_rate, budget_control, completed_cnt, verified, latitude, longitude, years_experience, specialty, work_types, review_count, price_min, price_max, price_unit, created_at, updated_at) VALUES
(90011, 90011, 3, '老李施工队 [TEST]', 4.9, 95.0, 90.0, 568, true, 31.2310, 121.4750, 20, '全屋装修 · 水电改造', 'general,plumber,electrician', 1423, 300, 500, '元/天', NOW(), NOW()),
(90012, 90012, 3, '专业电工 [TEST]', 4.8, 92.0, 88.0, 423, true, 31.2330, 121.4780, 15, '电路改造 · 弱电布线', 'electrician', 856, 350, 450, '元/天', NOW(), NOW()),
(90013, 90013, 3, '王木匠工坊 [TEST]', 4.9, 97.0, 94.0, 312, true, 31.2280, 121.4620, 25, '定制木工 · 吊顶隔断', 'carpenter', 723, 400, 600, '元/天', NOW(), NOW()),
(90014, 90014, 3, '刘油漆 [TEST]', 4.7, 90.0, 85.0, 245, false, 31.2350, 121.4850, 12, '墙面粉刷 · 艺术漆施工', 'painter', 512, 280, 400, '元/天', NOW(), NOW());

-- =============================================================================
-- 4. 创建装修公司 (Provider - type=2)
-- =============================================================================

INSERT INTO providers (id, user_id, provider_type, company_name, rating, restore_rate, budget_control, completed_cnt, verified, latitude, longitude, years_experience, specialty, work_types, review_count, price_min, price_max, price_unit, created_at, updated_at) VALUES
(90021, 90021, 2, '匠心装修工程有限公司 [TEST]', 4.7, 92.5, 88.0, 1256, true, 31.2260, 121.4600, 18, '全包装修 · 整装服务', 'general', 3245, 80000, 150000, '元/全包', NOW(), NOW()),
(90022, 90022, 2, '鑫盛建筑装饰公司 [TEST]', 4.6, 88.0, 82.0, 867, true, 31.2220, 121.4550, 12, '半包装修 · 局部翻新', 'general', 1867, 50000, 100000, '元/半包', NOW(), NOW());

-- =============================================================================
-- 完成提示
-- =============================================================================
-- 插入完成！共创建：
-- - 12 个测试用户
-- - 6 个设计师
-- - 4 个工长  
-- - 2 个装修公司
