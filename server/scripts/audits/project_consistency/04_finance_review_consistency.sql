-- 项目资金 / 正式评分一致性巡检
-- 目标：
-- 1. 扫出像 99140 这类 “托管账已释放，但里程碑 / 交易 / 商家收入未对齐” 的项目
-- 2. 扫出 providers.rating / review_count 与正式评价聚合结果不一致的服务商
--
-- 用法示例：
--   psql ... -f 04_finance_review_consistency.sql
--   psql ... -v project_id=99140 -f 04_finance_review_consistency.sql
--   psql ... -v provider_id=99101 -f 04_finance_review_consistency.sql
--   psql ... -v severity="'high'" -f 04_finance_review_consistency.sql

\if :{?project_id}
\else
\set project_id ''
\endif

\if :{?provider_id}
\else
\set provider_id ''
\endif

\if :{?severity}
\else
\set severity ''
\endif

WITH flow_agg AS (
  SELECT
    project_id,
    COUNT(*) AS flow_total,
    STRING_AGG(current_stage, ',' ORDER BY id) AS flow_stages,
    MIN(current_stage) FILTER (WHERE current_stage IS NOT NULL AND BTRIM(current_stage) <> '') AS flow_stage_one
  FROM business_flows
  WHERE project_id > 0
  GROUP BY project_id
),
milestone_finance_agg AS (
  SELECT
    m.project_id,
    COUNT(*) AS milestone_total,
    COUNT(*) FILTER (
      WHERE m.status = 3
        AND m.paid_at IS NULL
        AND m.released_at IS NULL
    ) AS accepted_unreleased_count,
    COALESCE(SUM(m.amount) FILTER (
      WHERE m.status = 3
        AND m.paid_at IS NULL
        AND m.released_at IS NULL
    ), 0) AS accepted_unreleased_amount,
    COUNT(*) FILTER (
      WHERE m.status = 4
         OR m.paid_at IS NOT NULL
         OR m.released_at IS NOT NULL
    ) AS released_milestone_count,
    COALESCE(SUM(m.amount) FILTER (
      WHERE m.status = 4
         OR m.paid_at IS NOT NULL
         OR m.released_at IS NOT NULL
    ), 0) AS released_milestone_amount
  FROM milestones m
  GROUP BY m.project_id
),
release_tx_agg AS (
  SELECT
    COALESCE(ea.project_id, m.project_id) AS project_id,
    COUNT(*) FILTER (WHERE t.type = 'release' AND t.status = 1) AS release_tx_count,
    COALESCE(SUM(t.amount) FILTER (WHERE t.type = 'release' AND t.status = 1), 0) AS release_tx_amount
  FROM transactions t
  LEFT JOIN escrow_accounts ea ON ea.id = t.escrow_id
  LEFT JOIN milestones m ON m.id = t.milestone_id
  WHERE COALESCE(ea.project_id, m.project_id) IS NOT NULL
  GROUP BY COALESCE(ea.project_id, m.project_id)
),
income_agg AS (
  SELECT
    o.project_id,
    COUNT(*) FILTER (WHERE mi.type = 'construction' AND mi.status = 1) AS construction_income_count,
    COALESCE(SUM(mi.amount) FILTER (WHERE mi.type = 'construction' AND mi.status = 1), 0) AS construction_income_amount
  FROM merchant_incomes mi
  JOIN orders o ON o.id = mi.order_id
  WHERE o.project_id > 0
  GROUP BY o.project_id
),
escrow_agg AS (
  SELECT
    project_id,
    COUNT(*) AS escrow_total,
    COALESCE(SUM(total_amount), 0) AS escrow_total_amount,
    COALESCE(SUM(frozen_amount), 0) AS escrow_frozen_amount,
    COALESCE(SUM(available_amount), 0) AS escrow_available_amount,
    COALESCE(SUM(released_amount), 0) AS escrow_released_amount
  FROM escrow_accounts
  GROUP BY project_id
),
project_finance_snapshot AS (
  SELECT
    p.id AS project_id,
    p.name,
    p.owner_id,
    p.provider_id,
    p.construction_provider_id,
    p.status,
    p.business_status,
    p.current_phase,
    p.completion_submitted_at,
    p.inspiration_case_draft_id,
    COALESCE(fa.flow_stage_one, '') AS flow_stage,
    COALESCE(fa.flow_stages, '') AS flow_stages,
    COALESCE(ms.milestone_total, 0) AS milestone_total,
    COALESCE(ms.accepted_unreleased_count, 0) AS accepted_unreleased_count,
    COALESCE(ms.accepted_unreleased_amount, 0) AS accepted_unreleased_amount,
    COALESCE(ms.released_milestone_count, 0) AS released_milestone_count,
    COALESCE(ms.released_milestone_amount, 0) AS released_milestone_amount,
    COALESCE(tx.release_tx_count, 0) AS release_tx_count,
    COALESCE(tx.release_tx_amount, 0) AS release_tx_amount,
    COALESCE(ia.construction_income_count, 0) AS construction_income_count,
    COALESCE(ia.construction_income_amount, 0) AS construction_income_amount,
    COALESCE(es.escrow_total, 0) AS escrow_total,
    COALESCE(es.escrow_total_amount, 0) AS escrow_total_amount,
    COALESCE(es.escrow_frozen_amount, 0) AS escrow_frozen_amount,
    COALESCE(es.escrow_available_amount, 0) AS escrow_available_amount,
    COALESCE(es.escrow_released_amount, 0) AS escrow_released_amount
  FROM projects p
  LEFT JOIN flow_agg fa ON fa.project_id = p.id
  LEFT JOIN milestone_finance_agg ms ON ms.project_id = p.id
  LEFT JOIN release_tx_agg tx ON tx.project_id = p.id
  LEFT JOIN income_agg ia ON ia.project_id = p.id
  LEFT JOIN escrow_agg es ON es.project_id = p.id
),
project_milestone_tx_snapshot AS (
  SELECT
    m.project_id,
    m.id AS milestone_id,
    m.name AS milestone_name,
    m.status,
    m.amount,
    m.paid_at,
    m.released_at,
    COUNT(t.id) FILTER (WHERE t.type = 'release' AND t.status = 1) AS release_tx_count
  FROM milestones m
  LEFT JOIN transactions t ON t.milestone_id = m.id
  GROUP BY
    m.project_id,
    m.id,
    m.name,
    m.status,
    m.amount,
    m.paid_at,
    m.released_at
),
invalid_official_reviews AS (
  SELECT
    pr.id AS review_id,
    pr.project_id,
    pr.provider_id,
    pr.user_id,
    CASE
      WHEN p.id IS NULL THEN 'project_missing'
      WHEN p.owner_id <> pr.user_id THEN 'owner_mismatch'
      WHEN NOT (
        p.construction_provider_id = pr.provider_id
        OR (COALESCE(p.construction_provider_id, 0) = 0 AND p.provider_id = pr.provider_id)
      ) THEN 'provider_mismatch'
      WHEN p.status <> 1 THEN 'project_status_invalid'
      WHEN p.business_status <> 'completed' THEN 'business_status_invalid'
      WHEN COALESCE(p.inspiration_case_draft_id, 0) <= 0 THEN 'case_draft_missing'
      ELSE 'unknown'
    END AS invalid_reason
  FROM provider_reviews pr
  LEFT JOIN projects p ON p.id = pr.project_id
  WHERE pr.project_id > 0
    AND (
      p.id IS NULL
      OR p.owner_id <> pr.user_id
      OR NOT (
        p.construction_provider_id = pr.provider_id
        OR (COALESCE(p.construction_provider_id, 0) = 0 AND p.provider_id = pr.provider_id)
      )
      OR p.status <> 1
      OR p.business_status <> 'completed'
      OR COALESCE(p.inspiration_case_draft_id, 0) <= 0
    )
),
valid_official_reviews AS (
  SELECT
    pr.id,
    pr.project_id,
    pr.provider_id,
    pr.user_id,
    pr.rating
  FROM provider_reviews pr
  JOIN projects p ON p.id = pr.project_id
  WHERE pr.project_id > 0
    AND p.owner_id = pr.user_id
    AND (
      p.construction_provider_id = pr.provider_id
      OR (COALESCE(p.construction_provider_id, 0) = 0 AND p.provider_id = pr.provider_id)
    )
    AND p.status = 1
    AND p.business_status = 'completed'
    AND p.inspiration_case_draft_id > 0
),
provider_valid_agg AS (
  SELECT
    provider_id,
    COUNT(*) AS valid_review_count,
    COALESCE(SUM(rating), 0) AS valid_rating_sum
  FROM valid_official_reviews
  GROUP BY provider_id
),
provider_expected_snapshot AS (
  SELECT
    p.id AS provider_id,
    p.provider_type,
    COALESCE(p.rating, 0)::numeric AS stored_rating,
    COALESCE(p.review_count, 0)::bigint AS stored_review_count,
    COALESCE(a.valid_review_count, 0)::bigint AS valid_review_count,
    COALESCE(a.valid_rating_sum, 0)::numeric AS valid_rating_sum,
    COALESCE(pm.prior_mean, 4.5)::numeric AS prior_mean,
    CASE
      WHEN COALESCE(a.valid_review_count, 0) = 0 THEN 0::numeric
      ELSE ROUND((((COALESCE(pm.prior_mean, 4.5) * 5) + COALESCE(a.valid_rating_sum, 0)) / (5 + COALESCE(a.valid_review_count, 0)))::numeric, 2)
    END AS expected_display_rating
  FROM providers p
  LEFT JOIN provider_valid_agg a ON a.provider_id = p.id
  LEFT JOIN LATERAL (
    SELECT AVG(vr.rating)::numeric AS prior_mean
    FROM valid_official_reviews vr
    JOIN providers peer ON peer.id = vr.provider_id
    WHERE peer.provider_type = p.provider_type
      AND vr.provider_id <> p.id
  ) pm ON TRUE
),
duplicate_official_reviews AS (
  SELECT
    project_id,
    provider_id,
    user_id,
    COUNT(*) AS duplicate_count,
    STRING_AGG(id::text, ',' ORDER BY id) AS review_ids
  FROM provider_reviews
  WHERE project_id > 0
  GROUP BY project_id, provider_id, user_id
  HAVING COUNT(*) > 1
),
findings AS (
  SELECT
    'project' AS entity_type,
    s.project_id AS entity_id,
    s.project_id AS related_project_id,
    COALESCE(NULLIF(s.construction_provider_id, 0), s.provider_id) AS related_provider_id,
    'F001' AS rule_code,
    'fatal' AS severity,
    '托管账户 released_amount 与里程碑已释放金额不一致' AS summary,
    ('escrow_released=' || s.escrow_released_amount || ', milestone_released=' || s.released_milestone_amount) AS observed_value,
    'escrow_released_amount = released_milestone_amount' AS expected_value
  FROM project_finance_snapshot s
  WHERE s.escrow_total > 0
    AND ABS(s.escrow_released_amount - s.released_milestone_amount) > 0.01

  UNION ALL

  SELECT
    'project',
    s.project_id,
    s.project_id,
    COALESCE(NULLIF(s.construction_provider_id, 0), s.provider_id),
    'F002',
    'fatal',
    '托管账户 released_amount 与 release 交易金额不一致',
    ('escrow_released=' || s.escrow_released_amount || ', release_tx_amount=' || s.release_tx_amount),
    'escrow_released_amount = release_tx_amount'
  FROM project_finance_snapshot s
  WHERE s.escrow_total > 0
    AND ABS(s.escrow_released_amount - s.release_tx_amount) > 0.01

  UNION ALL

  SELECT
    'project',
    s.project_id,
    s.project_id,
    COALESCE(NULLIF(s.construction_provider_id, 0), s.provider_id),
    'F003',
    'fatal',
    '托管账户 released_amount 与施工收入金额不一致',
    ('escrow_released=' || s.escrow_released_amount || ', construction_income_amount=' || s.construction_income_amount),
    'escrow_released_amount = construction_income_amount'
  FROM project_finance_snapshot s
  WHERE s.escrow_total > 0
    AND ABS(s.escrow_released_amount - s.construction_income_amount) > 0.01

  UNION ALL

  SELECT
    'project',
    s.project_id,
    s.project_id,
    COALESCE(NULLIF(s.construction_provider_id, 0), s.provider_id),
    'F004',
    'high',
    '项目已完工/归档，但仍存在已验收未释放节点',
    ('accepted_unreleased_count=' || s.accepted_unreleased_count || ', accepted_unreleased_amount=' || s.accepted_unreleased_amount),
    'completed/archived project should have no accepted but unreleased milestones'
  FROM project_finance_snapshot s
  WHERE s.accepted_unreleased_count > 0
    AND (
      s.business_status = 'completed'
      OR s.current_phase = '已归档'
      OR s.flow_stage = 'archived'
    )

  UNION ALL

  SELECT
    'milestone',
    m.milestone_id,
    m.project_id,
    p.provider_id,
    'F005',
    'high',
    '里程碑已标记放款，但缺少 release 交易记录',
    ('milestone_status=' || m.status || ', release_tx_count=' || m.release_tx_count),
    'released milestone should have at least one release transaction'
  FROM project_milestone_tx_snapshot m
  JOIN projects p ON p.id = m.project_id
  WHERE (m.status = 4 OR m.paid_at IS NOT NULL OR m.released_at IS NOT NULL)
    AND m.release_tx_count = 0

  UNION ALL

  SELECT
    'milestone',
    m.milestone_id,
    m.project_id,
    p.provider_id,
    'F006',
    'high',
    '里程碑已有 release 交易，但自身未标记放款',
    ('milestone_status=' || m.status || ', release_tx_count=' || m.release_tx_count),
    'milestone with release transaction should be paid/released'
  FROM project_milestone_tx_snapshot m
  JOIN projects p ON p.id = m.project_id
  WHERE m.release_tx_count > 0
    AND m.status <> 4
    AND m.paid_at IS NULL
    AND m.released_at IS NULL

  UNION ALL

  SELECT
    'provider',
    p.provider_id,
    NULL::bigint,
    p.provider_id,
    'R001',
    'high',
    'providers.review_count 与正式评价有效样本数不一致',
    ('stored_review_count=' || p.stored_review_count || ', valid_review_count=' || p.valid_review_count),
    'providers.review_count = valid_review_count'
  FROM provider_expected_snapshot p
  WHERE p.stored_review_count <> p.valid_review_count

  UNION ALL

  SELECT
    'provider',
    p.provider_id,
    NULL::bigint,
    p.provider_id,
    'R002',
    'high',
    'providers.rating 与贝叶斯平滑展示分不一致',
    ('stored_rating=' || p.stored_rating || ', expected_rating=' || p.expected_display_rating),
    'providers.rating = expected_display_rating'
  FROM provider_expected_snapshot p
  WHERE ABS(p.stored_rating - p.expected_display_rating) > 0.01

  UNION ALL

  SELECT
    'provider_review',
    r.review_id,
    r.project_id,
    r.provider_id,
    'R003',
    'fatal',
    '正式评价记录不满足官方有效样本约束',
    ('invalid_reason=' || r.invalid_reason),
    'official review must satisfy project/owner/provider/completion scope'
  FROM invalid_official_reviews r

  UNION ALL

  SELECT
    'provider_review_group',
    d.project_id,
    d.project_id,
    d.provider_id,
    'R004',
    'fatal',
    '同一 project + owner + provider 存在多条正式评价',
    ('duplicate_count=' || d.duplicate_count || ', review_ids=' || d.review_ids),
    'one official review per project + owner + provider'
  FROM duplicate_official_reviews d
)
SELECT
  entity_type,
  entity_id,
  related_project_id,
  related_provider_id,
  rule_code,
  severity,
  summary,
  observed_value,
  expected_value
FROM findings
WHERE (NULLIF(:'project_id', '') IS NULL OR related_project_id = CAST(NULLIF(:'project_id', '') AS bigint) OR (entity_type = 'project' AND entity_id = CAST(NULLIF(:'project_id', '') AS bigint)))
  AND (NULLIF(:'provider_id', '') IS NULL OR related_provider_id = CAST(NULLIF(:'provider_id', '') AS bigint) OR (entity_type = 'provider' AND entity_id = CAST(NULLIF(:'provider_id', '') AS bigint)))
  AND (:'severity' = '' OR severity = REPLACE(:'severity', '''', ''))
ORDER BY
  CASE severity
    WHEN 'fatal' THEN 1
    WHEN 'high' THEN 2
    WHEN 'medium' THEN 3
    ELSE 4
  END,
  rule_code,
  entity_type,
  entity_id;
