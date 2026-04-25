-- Seed realistic foreman quotation data for quote_list_id=49
-- 5 foremen, 99 items each, differentiated pricing based on market reference prices
-- Strategy:
--   刘进步(90014): balanced  ×0.95
--   王胜利(90011): premium    ×1.10
--   谢大脚(13):    plumbing/electric specialist  水电×0.85, rest×1.05
--   王思源(90012): budget      ×0.90
--   张电工(90013): masonry specialist  泥瓦×0.88, rest×1.02

BEGIN;

-- Step 1: Clean only this seed batch. Do not touch unrelated quote data.
CREATE TEMP TABLE seed_foreman_quote_providers (provider_id BIGINT PRIMARY KEY) ON COMMIT DROP;
INSERT INTO seed_foreman_quote_providers (provider_id)
VALUES (90014), (90011), (13), (90012), (90013);

DELETE FROM quote_submission_items
WHERE quote_submission_id IN (
  SELECT qs.id
  FROM quote_submissions qs
  JOIN seed_foreman_quote_providers p ON p.provider_id = qs.provider_id
  WHERE qs.quote_list_id = 49
);

DELETE FROM quote_submissions
WHERE quote_list_id = 49
  AND provider_id IN (SELECT provider_id FROM seed_foreman_quote_providers);

-- Step 2: Activate existing price books + create new ones
UPDATE quote_price_books SET status = 'active', version = 2 WHERE id IN (1, 2, 3);

INSERT INTO quote_price_books (provider_id, status, version, remark, created_at, updated_at)
VALUES
  (90013, 'active', 1, '张电工-泥瓦专长价目簿', NOW(), NOW()),
  (90012, 'active', 1, '王思源-实惠型价目簿', NOW(), NOW())
ON CONFLICT DO NOTHING;

-- Step 3: Insert quote_price_book_items (99 items × 5 foremen = 495 rows)
-- Pricing formula: round(reference_price_cent × coefficient / 100) × 100

-- 刘进步 pb=1: ×0.95
INSERT INTO quote_price_book_items (price_book_id, standard_item_id, unit, unit_price_cent, min_charge_cent, status, created_at, updated_at)
SELECT 1, qi.standard_item_id, li.unit,
  ROUND(li.reference_price_cent * 0.95 / 100.0) * 100,
  0, 1, NOW(), NOW()
FROM quote_list_items qi
JOIN quote_library_items li ON qi.standard_item_id = li.id
WHERE qi.quote_list_id = 49 AND li.reference_price_cent > 0
ON CONFLICT (price_book_id, standard_item_id) DO UPDATE SET
  unit = EXCLUDED.unit,
  unit_price_cent = EXCLUDED.unit_price_cent,
  min_charge_cent = EXCLUDED.min_charge_cent,
  status = EXCLUDED.status,
  updated_at = NOW();

-- 王胜利 pb=2: ×1.10
INSERT INTO quote_price_book_items (price_book_id, standard_item_id, unit, unit_price_cent, min_charge_cent, status, created_at, updated_at)
SELECT 2, qi.standard_item_id, li.unit,
  ROUND(li.reference_price_cent * 1.10 / 100.0) * 100,
  0, 1, NOW(), NOW()
FROM quote_list_items qi
JOIN quote_library_items li ON qi.standard_item_id = li.id
WHERE qi.quote_list_id = 49 AND li.reference_price_cent > 0
ON CONFLICT (price_book_id, standard_item_id) DO UPDATE SET
  unit = EXCLUDED.unit,
  unit_price_cent = EXCLUDED.unit_price_cent,
  min_charge_cent = EXCLUDED.min_charge_cent,
  status = EXCLUDED.status,
  updated_at = NOW();

-- 谢大脚 pb=3: 水电×0.85, rest×1.05
INSERT INTO quote_price_book_items (price_book_id, standard_item_id, unit, unit_price_cent, min_charge_cent, status, created_at, updated_at)
SELECT 3, qi.standard_item_id, li.unit,
  ROUND(li.reference_price_cent * CASE WHEN li.category_l1 = '水电' THEN 0.85 ELSE 1.05 END / 100.0) * 100,
  0, 1, NOW(), NOW()
FROM quote_list_items qi
JOIN quote_library_items li ON qi.standard_item_id = li.id
WHERE qi.quote_list_id = 49 AND li.reference_price_cent > 0
ON CONFLICT (price_book_id, standard_item_id) DO UPDATE SET
  unit = EXCLUDED.unit,
  unit_price_cent = EXCLUDED.unit_price_cent,
  min_charge_cent = EXCLUDED.min_charge_cent,
  status = EXCLUDED.status,
  updated_at = NOW();

-- 王思源 pb=(next val): ×0.90
INSERT INTO quote_price_book_items (price_book_id, standard_item_id, unit, unit_price_cent, min_charge_cent, status, created_at, updated_at)
SELECT (SELECT id FROM quote_price_books WHERE provider_id = 90012 ORDER BY id DESC LIMIT 1),
  qi.standard_item_id, li.unit,
  ROUND(li.reference_price_cent * 0.90 / 100.0) * 100,
  0, 1, NOW(), NOW()
FROM quote_list_items qi
JOIN quote_library_items li ON qi.standard_item_id = li.id
WHERE qi.quote_list_id = 49 AND li.reference_price_cent > 0
ON CONFLICT (price_book_id, standard_item_id) DO UPDATE SET
  unit = EXCLUDED.unit,
  unit_price_cent = EXCLUDED.unit_price_cent,
  min_charge_cent = EXCLUDED.min_charge_cent,
  status = EXCLUDED.status,
  updated_at = NOW();

-- 张电工 pb=(next val): 泥瓦×0.88, rest×1.02
INSERT INTO quote_price_book_items (price_book_id, standard_item_id, unit, unit_price_cent, min_charge_cent, status, created_at, updated_at)
SELECT (SELECT id FROM quote_price_books WHERE provider_id = 90013 ORDER BY id DESC LIMIT 1),
  qi.standard_item_id, li.unit,
  ROUND(li.reference_price_cent * CASE WHEN li.category_l1 = '泥瓦' THEN 0.88 ELSE 1.02 END / 100.0) * 100,
  0, 1, NOW(), NOW()
FROM quote_list_items qi
JOIN quote_library_items li ON qi.standard_item_id = li.id
WHERE qi.quote_list_id = 49 AND li.reference_price_cent > 0
ON CONFLICT (price_book_id, standard_item_id) DO UPDATE SET
  unit = EXCLUDED.unit,
  unit_price_cent = EXCLUDED.unit_price_cent,
  min_charge_cent = EXCLUDED.min_charge_cent,
  status = EXCLUDED.status,
  updated_at = NOW();

-- Step 4: Insert 5 quote_submissions for quote_list_id=49
INSERT INTO quote_submissions (quote_list_id, provider_id, provider_type, status, generation_status, currency, total_cent, estimated_days, remark, submitted_to_user, review_status, created_at, updated_at)
VALUES
  (49, 90014, 3, 'submitted', 'generated', 'CNY', 0, 60, '刘进步-均衡型报价，全屋半包', false, 'not_required', NOW(), NOW()),
  (49, 90011, 3, 'submitted', 'generated', 'CNY', 0, 55, '王胜利-品质溢价型报价，师傅经验丰富', false, 'not_required', NOW(), NOW()),
  (49, 13, 3, 'submitted', 'generated', 'CNY', 0, 65, '谢大脚-水电专长型报价，水电工价优惠', false, 'not_required', NOW(), NOW()),
  (49, 90012, 3, 'submitted', 'generated', 'CNY', 0, 70, '王思源-实惠型报价，性价比高', false, 'not_required', NOW(), NOW()),
  (49, 90013, 3, 'submitted', 'generated', 'CNY', 0, 58, '张电工-泥瓦专长型报价，泥瓦工优惠', false, 'not_required', NOW(), NOW());

-- Step 5: Insert quote_submission_items (99 items × 5 foremen = 495 rows)
-- 刘进步: submission row 1, price_book 1, coefficient ×0.95
INSERT INTO quote_submission_items (quote_submission_id, quote_list_item_id, unit_price_cent, quoted_quantity, amount_cent, adjusted_flag, missing_price_flag, remark, created_at, updated_at)
SELECT
  (SELECT id FROM quote_submissions WHERE quote_list_id = 49 AND provider_id = 90014 ORDER BY id DESC LIMIT 1),
  qi.id,
  ROUND(li.reference_price_cent * 0.95 / 100.0) * 100,
  qi.quantity,
  ROUND(ROUND(li.reference_price_cent * 0.95 / 100.0) * 100 * qi.quantity),
  false, false, '', NOW(), NOW()
FROM quote_list_items qi
JOIN quote_library_items li ON qi.standard_item_id = li.id
WHERE qi.quote_list_id = 49 AND li.reference_price_cent > 0;

-- 王胜利: submission row 2, coefficient ×1.10
INSERT INTO quote_submission_items (quote_submission_id, quote_list_item_id, unit_price_cent, quoted_quantity, amount_cent, adjusted_flag, missing_price_flag, remark, created_at, updated_at)
SELECT
  (SELECT id FROM quote_submissions WHERE quote_list_id = 49 AND provider_id = 90011 ORDER BY id DESC LIMIT 1),
  qi.id,
  ROUND(li.reference_price_cent * 1.10 / 100.0) * 100,
  qi.quantity,
  ROUND(ROUND(li.reference_price_cent * 1.10 / 100.0) * 100 * qi.quantity),
  false, false, '', NOW(), NOW()
FROM quote_list_items qi
JOIN quote_library_items li ON qi.standard_item_id = li.id
WHERE qi.quote_list_id = 49 AND li.reference_price_cent > 0;

-- 谢大脚: submission row 3, 水电×0.85 rest×1.05
INSERT INTO quote_submission_items (quote_submission_id, quote_list_item_id, unit_price_cent, quoted_quantity, amount_cent, adjusted_flag, missing_price_flag, remark, created_at, updated_at)
SELECT
  (SELECT id FROM quote_submissions WHERE quote_list_id = 49 AND provider_id = 13 ORDER BY id DESC LIMIT 1),
  qi.id,
  ROUND(li.reference_price_cent * CASE WHEN li.category_l1 = '水电' THEN 0.85 ELSE 1.05 END / 100.0) * 100,
  qi.quantity,
  ROUND(ROUND(li.reference_price_cent * CASE WHEN li.category_l1 = '水电' THEN 0.85 ELSE 1.05 END / 100.0) * 100 * qi.quantity),
  false, false, '', NOW(), NOW()
FROM quote_list_items qi
JOIN quote_library_items li ON qi.standard_item_id = li.id
WHERE qi.quote_list_id = 49 AND li.reference_price_cent > 0;

-- 王思源: submission row 4, coefficient ×0.90
INSERT INTO quote_submission_items (quote_submission_id, quote_list_item_id, unit_price_cent, quoted_quantity, amount_cent, adjusted_flag, missing_price_flag, remark, created_at, updated_at)
SELECT
  (SELECT id FROM quote_submissions WHERE quote_list_id = 49 AND provider_id = 90012 ORDER BY id DESC LIMIT 1),
  qi.id,
  ROUND(li.reference_price_cent * 0.90 / 100.0) * 100,
  qi.quantity,
  ROUND(ROUND(li.reference_price_cent * 0.90 / 100.0) * 100 * qi.quantity),
  false, false, '', NOW(), NOW()
FROM quote_list_items qi
JOIN quote_library_items li ON qi.standard_item_id = li.id
WHERE qi.quote_list_id = 49 AND li.reference_price_cent > 0;

-- 张电工: submission row 5, 泥瓦×0.88 rest×1.02
INSERT INTO quote_submission_items (quote_submission_id, quote_list_item_id, unit_price_cent, quoted_quantity, amount_cent, adjusted_flag, missing_price_flag, remark, created_at, updated_at)
SELECT
  (SELECT id FROM quote_submissions WHERE quote_list_id = 49 AND provider_id = 90013 ORDER BY id DESC LIMIT 1),
  qi.id,
  ROUND(li.reference_price_cent * CASE WHEN li.category_l1 = '泥瓦' THEN 0.88 ELSE 1.02 END / 100.0) * 100,
  qi.quantity,
  ROUND(ROUND(li.reference_price_cent * CASE WHEN li.category_l1 = '泥瓦' THEN 0.88 ELSE 1.02 END / 100.0) * 100 * qi.quantity),
  false, false, '', NOW(), NOW()
FROM quote_list_items qi
JOIN quote_library_items li ON qi.standard_item_id = li.id
WHERE qi.quote_list_id = 49 AND li.reference_price_cent > 0;

-- Step 6: Update total_cent for each submission
UPDATE quote_submissions qs SET total_cent = sub.total
FROM (
  SELECT qi.quote_submission_id, SUM(qi.amount_cent) as total
  FROM quote_submission_items qi
  GROUP BY qi.quote_submission_id
) sub, seed_foreman_quote_providers p
WHERE qs.id = sub.quote_submission_id
  AND qs.provider_id = p.provider_id
  AND qs.quote_list_id = 49;

-- Step 7: Update quote_list status to reflect submissions
UPDATE quote_lists SET status = 'pricing_in_progress' WHERE id = 49;

COMMIT;
