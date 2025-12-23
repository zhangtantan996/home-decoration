-- =============================================================================
-- 项目阶段测试数据 (PostgreSQL)
-- 带 [TEST] 标记，方便后期清理
-- =============================================================================

-- 先创建一个测试项目
INSERT INTO projects (id, owner_id, provider_id, name, address, area, budget, status, current_phase, start_date, created_at, updated_at)
VALUES (99001, 1, 1, '汤臣一品 A栋-1201 [TEST]', '上海市浦东新区', 180, 500000, 1, '水电工程', '2024-11-05', NOW(), NOW())
ON CONFLICT (id) DO NOTHING;

-- 插入 7 个阶段
INSERT INTO project_phases (id, project_id, phase_type, seq, status, responsible_person, start_date, end_date, estimated_days, created_at, updated_at) VALUES
(99001, 99001, 'preparation', 1, 'completed', '张工长 [TEST]', '2024-11-05', '2024-11-08', 4, NOW(), NOW()),
(99002, 99001, 'demolition', 2, 'completed', '李师傅 [TEST]', '2024-11-09', '2024-11-15', 7, NOW(), NOW()),
(99003, 99001, 'electrical', 3, 'in_progress', '王师傅 [TEST]', '2024-11-16', NULL, 10, NOW(), NOW()),
(99004, 99001, 'masonry', 4, 'pending', NULL, NULL, NULL, 15, NOW(), NOW()),
(99005, 99001, 'painting', 5, 'pending', NULL, NULL, NULL, 10, NOW(), NOW()),
(99006, 99001, 'installation', 6, 'pending', NULL, NULL, NULL, 7, NOW(), NOW()),
(99007, 99001, 'inspection', 7, 'pending', NULL, NULL, NULL, 3, NOW(), NOW())
ON CONFLICT (id) DO NOTHING;

-- 插入子任务
INSERT INTO phase_tasks (id, phase_id, name, is_completed, completed_at, created_at, updated_at) VALUES
-- 准备阶段
(99001, 99001, '现场交接确认', TRUE, '2024-11-06', NOW(), NOW()),
(99002, 99001, '施工图纸确认', TRUE, '2024-11-07', NOW(), NOW()),
(99003, 99001, '材料进场验收', TRUE, '2024-11-08', NOW(), NOW()),
-- 拆除阶段
(99004, 99002, '客厅隔墙拆除', TRUE, '2024-11-11', NOW(), NOW()),
(99005, 99002, '卫生间墙体拆除', TRUE, '2024-11-13', NOW(), NOW()),
(99006, 99002, '垃圾清运完成', TRUE, '2024-11-15', NOW(), NOW()),
-- 水电阶段 (进行中)
(99007, 99003, '厨房水管布置', TRUE, '2024-11-18', NOW(), NOW()),
(99008, 99003, '卫生间水管布置', TRUE, '2024-11-20', NOW(), NOW()),
(99009, 99003, '全屋电路布线', FALSE, NULL, NOW(), NOW()),
(99010, 99003, '水电验收', FALSE, NULL, NOW(), NOW()),
-- 泥木阶段
(99011, 99004, '瓷砖铺贴', FALSE, NULL, NOW(), NOW()),
(99012, 99004, '木工制作', FALSE, NULL, NOW(), NOW()),
(99013, 99004, '吊顶施工', FALSE, NULL, NOW(), NOW()),
-- 油漆阶段
(99014, 99005, '墙面处理', FALSE, NULL, NOW(), NOW()),
(99015, 99005, '乳胶漆施工', FALSE, NULL, NOW(), NOW()),
-- 安装阶段
(99016, 99006, '灯具安装', FALSE, NULL, NOW(), NOW()),
(99017, 99006, '洁具安装', FALSE, NULL, NOW(), NOW()),
(99018, 99006, '五金安装', FALSE, NULL, NOW(), NOW()),
-- 验收阶段
(99019, 99007, '全屋保洁', FALSE, NULL, NOW(), NOW()),
(99020, 99007, '设备调试', FALSE, NULL, NOW(), NOW()),
(99021, 99007, '交付验收', FALSE, NULL, NOW(), NOW())
ON CONFLICT (id) DO NOTHING;

-- =============================================================================
-- 清理脚本 (后期使用)
-- =============================================================================
-- DELETE FROM phase_tasks WHERE phase_id IN (SELECT id FROM project_phases WHERE project_id = 99001);
-- DELETE FROM project_phases WHERE project_id = 99001;
-- DELETE FROM projects WHERE id = 99001;
