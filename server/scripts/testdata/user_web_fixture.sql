-- =============================================================================
-- User Web deterministic fixture
-- Covers provider -> booking -> proposal -> order -> project for pure web smoke.
-- Safe to rerun locally and in test environments.
-- =============================================================================

BEGIN;

-- Cleanup in dependency order
DELETE FROM payment_plans WHERE id IN (99131);
DELETE FROM milestones WHERE id IN (99161, 99162);
DELETE FROM phase_tasks WHERE id IN (99151, 99152, 99153, 99154);
DELETE FROM project_phases WHERE id IN (99141, 99142);
DELETE FROM escrow_accounts WHERE project_id IN (99140);
DELETE FROM orders WHERE id IN (99130);
DELETE FROM projects WHERE id IN (99140);
DELETE FROM proposals WHERE id IN (99120);
DELETE FROM bookings WHERE id IN (99110);
DELETE FROM provider_reviews WHERE id IN (99101);
DELETE FROM provider_cases WHERE id IN (99101, 99102);
DELETE FROM providers WHERE id IN (99101);
DELETE FROM users
WHERE id IN (99100, 99101, 99102)
   OR phone IN ('19999100001', '19999100002', '19999100003')
   OR public_id IN ('user-web-owner-99100', 'user-web-provider-99101', 'user-web-reviewer-99102');

-- Owner / provider / reviewer users
INSERT INTO users (id, public_id, phone, nickname, avatar, password, user_type, status, created_at, updated_at)
VALUES
  (99100, 'user-web-owner-99100', '19999100001', '用户端联调业主', 'https://placehold.co/160x160/e4e4e7/27272a?text=OW', '', 1, 1, NOW(), NOW()),
  (99101, 'user-web-provider-99101', '19999100002', '拾光设计联调', 'https://placehold.co/160x160/e4e4e7/27272a?text=SD', '', 2, 1, NOW(), NOW()),
  (99102, 'user-web-reviewer-99102', '19999100003', '联调评价用户', 'https://placehold.co/160x160/e4e4e7/27272a?text=RV', '', 1, 1, NOW(), NOW());

-- Provider
INSERT INTO providers (
  id, user_id, provider_type, company_name, source_application_id, avatar, license_no,
  rating, restore_rate, budget_control, completed_cnt, verified, status,
  latitude, longitude, sub_type, entity_type, years_experience, specialty, work_types,
  highlight_tags, pricing_json, graduate_school, design_philosophy, review_count,
  price_min, price_max, price_unit, cover_image, followers_count, service_intro,
  team_size, established_year, certifications, service_area, office_address,
  created_at, updated_at
) VALUES (
  99101, 99101, 1, '拾光设计联调工作室', 0, 'https://placehold.co/160x160/e4e4e7/27272a?text=SD', '',
  4.9, 96.0, 93.0, 58, true, 1,
  34.2351, 108.9485, 'studio', 'personal', 9, '老房改造 · 收纳优化 · 动线梳理', '',
  '["预算透明","节点清晰","响应快"]', '{"flat":180,"duplex":260}', '西安美院', '先把需求说透，再给方案和施工边界。', 1,
  180, 260, '元/㎡', 'https://placehold.co/1280x540/27272a/faf7ef?text=%E6%8B%BE%E5%85%89%E8%AE%BE%E8%AE%A1', 128,
  '专注旧房焕新与中小户型改造，强调预算透明、节点留痕和施工协同。',
  6, 2019, '["实名核验","平台履约记录"]', '["610113","610104"]', '西安市高新区云杉路 88 号',
  NOW(), NOW()
);

-- Cases
INSERT INTO provider_cases (
  id, provider_id, title, cover_image, style, area, year, description, images, sort_order,
  price, layout, quote_total_cent, quote_currency, quote_items, created_at, updated_at
) VALUES
  (99101, 99101, '雁塔区 98㎡ 旧房焕新', 'https://placehold.co/640x360/e4e4e7/27272a?text=CASE-1', '现代简约', '98㎡', '2026', '重点解决收纳、采光与餐厨动线。', '["https://placehold.co/960x640/e4e4e7/27272a?text=CASE-1A"]', 1, 220000, '三室两厅', 22000000, 'CNY', '[]', NOW(), NOW()),
  (99102, 99101, '高新区 120㎡ 三代同堂改造', 'https://placehold.co/640x360/e4e4e7/27272a?text=CASE-2', '奶油原木', '120㎡', '2026', '重点处理老人房动线与儿童收纳。', '["https://placehold.co/960x640/e4e4e7/27272a?text=CASE-2A"]', 2, 298000, '四室两厅', 29800000, 'CNY', '[]', NOW(), NOW());

-- Review
INSERT INTO provider_reviews (
  id, provider_id, user_id, rating, content, images, service_type, area, style, tags, helpful_count, reply, reply_at, created_at, updated_at
) VALUES (
  99101, 99101, 99102, 4.9, '预算透明，节点清晰，施工安排很稳。', '["https://placehold.co/120x120/e4e4e7/27272a?text=RV1"]',
  '整装', '98㎡', '现代简约', '["预算透明","节点清晰"]', 12, '感谢认可，我们继续把项目跑顺。', NOW(), NOW(), NOW()
);

-- Booking already paid, with proposal linked
INSERT INTO bookings (
  id, user_id, provider_id, provider_type, address, area, renovation_type, budget_range,
  preferred_date, phone, notes, house_layout, status, intent_fee, intent_fee_paid,
  intent_fee_deducted, intent_fee_refunded, intent_fee_refund_reason, intent_fee_refunded_at,
  merchant_response_deadline, created_at, updated_at
) VALUES (
  99110, 99100, 99101, 'designer', '西安市高新区测试路 18 号', 88, '全屋整装', '10-30万',
  '2026-03-20', '19999100001', 'fixture booking for pure web user smoke', '三室两厅', 1, 99, true,
  false, false, '', NULL, NOW() + interval '2 day', NOW(), NOW()
);

-- Proposal confirmed
INSERT INTO proposals (
  id, booking_id, designer_id, summary, design_fee, construction_fee, material_fee,
  estimated_days, attachments, status, confirmed_at, version, parent_proposal_id,
  rejection_count, rejection_reason, rejected_at, submitted_at, user_response_deadline,
  created_at, updated_at
) VALUES (
  99120, 99110, 99101,
  '基于 88㎡ 老房焕新，优先处理收纳、餐厨动线和采光。',
  12000, 168000, 42000, 75,
  '["https://placehold.co/600x400/e4e4e7/27272a?text=PLAN"]',
  2, NOW(), 1, 0, 0, '', NULL, NOW(), NOW() + interval '14 day', NOW(), NOW()
);

-- Design order + one plan + linked project
INSERT INTO orders (
  id, project_id, proposal_id, booking_id, order_no, order_type, total_amount,
  paid_amount, discount, status, expire_at, paid_at, created_at, updated_at
) VALUES (
  99130, 99140, 99120, 99110, 'UW-DF-99130', 'design', 11901,
  0, 99, 0, NOW() + interval '2 day', NULL, NOW(), NOW()
);

INSERT INTO payment_plans (
  id, order_id, type, seq, name, amount, percentage, status, due_at, paid_at, created_at, updated_at
) VALUES (
  99131, 99130, 'onetime', 1, '设计费', 11901, 100, 0, NOW() + interval '2 day', NULL, NOW(), NOW()
);

INSERT INTO projects (
  id, owner_id, provider_id, proposal_id, name, address, latitude, longitude, area, budget,
  status, current_phase, start_date, expected_end, actual_end, material_method, crew_id,
  entry_start_date, entry_end_date, created_at, updated_at
) VALUES (
  99140, 99100, 99101, 99120, '测试路旧房改造项目', '西安市高新区测试路 18 号', 34.2351, 108.9485, 88, 220000,
  1, '泥木阶段', NOW() - interval '10 day', NOW() + interval '65 day', NULL, 'self', 0,
  NOW() - interval '8 day', NOW() - interval '7 day', NOW(), NOW()
);

INSERT INTO escrow_accounts (
  id, project_id, user_id, project_name, user_name, total_amount, frozen_amount, available_amount, released_amount, status, created_at, updated_at
) VALUES (
  99170, 99140, 99100, '测试路旧房改造项目', '用户端联调业主', 220000, 66000, 88000, 66000, 1, NOW(), NOW()
);

INSERT INTO project_phases (
  id, project_id, phase_type, seq, status, responsible_person, start_date, end_date, estimated_days, created_at, updated_at
) VALUES
  (99141, 99140, 'electrical', 3, 'completed', '张工长', CURRENT_DATE - 12, CURRENT_DATE - 3, 10, NOW(), NOW()),
  (99142, 99140, 'masonry', 4, 'in_progress', '李工长', CURRENT_DATE - 2, CURRENT_DATE + 10, 15, NOW(), NOW());

INSERT INTO phase_tasks (id, phase_id, name, is_completed, completed_at, created_at, updated_at) VALUES
  (99151, 99141, '现场保护', true, NOW() - interval '9 day', NOW(), NOW()),
  (99152, 99141, '强弱电布线', true, NOW() - interval '5 day', NOW(), NOW()),
  (99153, 99142, '瓦工排砖', true, NOW() - interval '1 day', NOW(), NOW()),
  (99154, 99142, '木作基层', false, NULL, NOW(), NOW());

INSERT INTO milestones (
  id, project_id, name, seq, amount, percentage, status, criteria, submitted_at, accepted_at, paid_at, created_at, updated_at
) VALUES
  (99161, 99140, '水电验收', 1, 66000, 30, 3, '线路、给排水和试压记录全部合格。', NOW() - interval '6 day', NOW() - interval '5 day', NULL, NOW(), NOW()),
  (99162, 99140, '泥木验收', 2, 66000, 30, 1, '木作基层与瓦工排砖到位。', NOW() - interval '1 day', NULL, NULL, NOW(), NOW());

COMMIT;
