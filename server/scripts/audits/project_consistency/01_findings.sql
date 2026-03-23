-- 项目一致性巡检明细
-- 用法示例：
--   psql ... -v project_id=99001 -f 01_findings.sql
--   psql ... -v severity="'fatal'" -f 01_findings.sql
-- 未传参时默认扫描全库、不过滤严重度。

\if :{?project_id}
\else
\set project_id ''
\endif

\if :{?severity}
\else
\set severity ''
\endif

WITH phase_agg AS (
  SELECT
    project_id,
    COUNT(*) AS phase_total,
    COUNT(*) FILTER (WHERE status = 'pending') AS phase_pending_count,
    COUNT(*) FILTER (WHERE status = 'in_progress') AS phase_in_progress_count,
    COUNT(*) FILTER (WHERE status = 'completed') AS phase_completed_count
  FROM project_phases
  GROUP BY project_id
),
milestone_agg AS (
  SELECT
    project_id,
    COUNT(*) AS milestone_total,
    COUNT(*) FILTER (WHERE status = 0) AS milestone_pending_count,
    COUNT(*) FILTER (WHERE status = 1) AS milestone_in_progress_count,
    COUNT(*) FILTER (WHERE status = 2) AS milestone_submitted_count,
    COUNT(*) FILTER (WHERE status IN (3, 4)) AS milestone_accepted_or_paid_count
  FROM milestones
  GROUP BY project_id
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
flow_agg AS (
  SELECT
    project_id,
    COUNT(*) AS flow_total,
    STRING_AGG(current_stage, ',' ORDER BY id) AS flow_stages,
    MIN(current_stage) FILTER (WHERE current_stage IS NOT NULL AND BTRIM(current_stage) <> '') AS flow_stage_one
  FROM business_flows
  WHERE project_id > 0
  GROUP BY project_id
),
provider_agg AS (
  SELECT
    p.id AS provider_id,
    p.user_id,
    p.provider_type,
    NULLIF(BTRIM(p.company_name), '') AS company_name,
    NULLIF(BTRIM(u.nickname), '') AS nickname,
    NULLIF(BTRIM(u.phone), '') AS phone
  FROM providers p
  LEFT JOIN users u ON u.id = p.user_id
),
snapshot AS (
  SELECT
    p.id AS project_id,
    p.name,
    p.owner_id,
    p.provider_id,
    p.construction_provider_id,
    p.foreman_id,
    p.status,
    p.business_status,
    p.current_phase,
    p.budget,
    p.construction_quote,
    p.started_at,
    p.start_date,
    p.expected_end,
    p.actual_end,
    p.completion_submitted_at,
    p.completion_rejected_at,
    p.disputed_at,
    p.inspiration_case_draft_id,

    COALESCE(ph.phase_total, 0) AS phase_total,
    COALESCE(ph.phase_pending_count, 0) AS phase_pending_count,
    COALESCE(ph.phase_in_progress_count, 0) AS phase_in_progress_count,
    COALESCE(ph.phase_completed_count, 0) AS phase_completed_count,

    COALESCE(ms.milestone_total, 0) AS milestone_total,
    COALESCE(ms.milestone_pending_count, 0) AS milestone_pending_count,
    COALESCE(ms.milestone_in_progress_count, 0) AS milestone_in_progress_count,
    COALESCE(ms.milestone_submitted_count, 0) AS milestone_submitted_count,
    COALESCE(ms.milestone_accepted_or_paid_count, 0) AS milestone_accepted_or_paid_count,

    COALESCE(es.escrow_total, 0) AS escrow_total,
    COALESCE(es.escrow_total_amount, 0) AS escrow_total_amount,
    COALESCE(es.escrow_frozen_amount, 0) AS escrow_frozen_amount,
    COALESCE(es.escrow_available_amount, 0) AS escrow_available_amount,
    COALESCE(es.escrow_released_amount, 0) AS escrow_released_amount,

    COALESCE(fl.flow_total, 0) AS flow_total,
    fl.flow_stages,
    fl.flow_stage_one,

    pa.provider_type,
    COALESCE(pa.nickname, pa.company_name, pa.phone) AS provider_display_seed
  FROM projects p
  LEFT JOIN phase_agg ph ON ph.project_id = p.id
  LEFT JOIN milestone_agg ms ON ms.project_id = p.id
  LEFT JOIN escrow_agg es ON es.project_id = p.id
  LEFT JOIN flow_agg fl ON fl.project_id = p.id
  LEFT JOIN provider_agg pa ON pa.provider_id = p.provider_id
),
findings AS (
  SELECT
    'P001' AS rule_code,
    'fatal' AS severity,
    project_id,
    name,
    status,
    business_status,
    current_phase,
    flow_stage_one AS flow_stage,
    flow_stages,
    phase_total,
    milestone_total,
    escrow_total,
    provider_id,
    construction_provider_id,
    foreman_id,
    completion_submitted_at,
    inspiration_case_draft_id,
    '项目缺托管账户' AS detail
  FROM snapshot
  WHERE escrow_total = 0
    AND (
      status IN (0, 1, 2)
      OR business_status IN ('construction_quote_confirmed', 'in_progress', 'completed')
    )

  UNION ALL

  SELECT
    'P002', 'fatal', project_id, name, status, business_status, current_phase, flow_stage_one, flow_stages,
    phase_total, milestone_total, escrow_total, provider_id, construction_provider_id, foreman_id,
    completion_submitted_at, inspiration_case_draft_id,
    '项目缺施工阶段(project_phases)' AS detail
  FROM snapshot
  WHERE phase_total = 0
    AND business_status IN ('construction_quote_confirmed', 'in_progress', 'completed')

  UNION ALL

  SELECT
    'P003', 'fatal', project_id, name, status, business_status, current_phase, flow_stage_one, flow_stages,
    phase_total, milestone_total, escrow_total, provider_id, construction_provider_id, foreman_id,
    completion_submitted_at, inspiration_case_draft_id,
    '项目缺里程碑(milestones)' AS detail
  FROM snapshot
  WHERE milestone_total = 0
    AND business_status IN ('construction_quote_confirmed', 'in_progress', 'completed')

  UNION ALL

  SELECT
    'P004', 'high', project_id, name, status, business_status, current_phase, flow_stage_one, flow_stages,
    phase_total, milestone_total, escrow_total, provider_id, construction_provider_id, foreman_id,
    completion_submitted_at, inspiration_case_draft_id,
    '项目缺业务流(business_flows.project_id)' AS detail
  FROM snapshot
  WHERE flow_total = 0
    AND (
      provider_id > 0
      OR construction_provider_id > 0
      OR foreman_id > 0
      OR business_status <> 'draft'
    )

  UNION ALL

  SELECT
    'P005', 'high', project_id, name, status, business_status, current_phase, flow_stage_one, flow_stages,
    phase_total, milestone_total, escrow_total, provider_id, construction_provider_id, foreman_id,
    completion_submitted_at, inspiration_case_draft_id,
    '一个项目绑定了多条业务流' AS detail
  FROM snapshot
  WHERE flow_total > 1

  UNION ALL

  SELECT
    'P006', 'high', project_id, name, status, business_status, current_phase, flow_stage_one, flow_stages,
    phase_total, milestone_total, escrow_total, provider_id, construction_provider_id, foreman_id,
    completion_submitted_at, inspiration_case_draft_id,
    '项目已完工，但业务状态不是 completed' AS detail
  FROM snapshot
  WHERE status = 1
    AND business_status <> 'completed'

  UNION ALL

  SELECT
    'P007', 'high', project_id, name, status, business_status, current_phase, flow_stage_one, flow_stages,
    phase_total, milestone_total, escrow_total, provider_id, construction_provider_id, foreman_id,
    completion_submitted_at, inspiration_case_draft_id,
    '项目已完工，但业务流阶段不是 completed/archived' AS detail
  FROM snapshot
  WHERE status = 1
    AND COALESCE(flow_stage_one, '') NOT IN ('completed', 'archived')

  UNION ALL

  SELECT
    'P008', 'high', project_id, name, status, business_status, current_phase, flow_stage_one, flow_stages,
    phase_total, milestone_total, escrow_total, provider_id, construction_provider_id, foreman_id,
    completion_submitted_at, inspiration_case_draft_id,
    '项目施工中，但没有进行中阶段/节点' AS detail
  FROM snapshot
  WHERE business_status = 'in_progress'
    AND phase_in_progress_count = 0
    AND milestone_in_progress_count = 0
    AND milestone_submitted_count = 0
    AND COALESCE(current_phase, '') NOT IN ('待提交完工材料', '等待支付下一期施工款')

  UNION ALL

  SELECT
    'P009', 'high', project_id, name, status, business_status, current_phase, flow_stage_one, flow_stages,
    phase_total, milestone_total, escrow_total, provider_id, construction_provider_id, foreman_id,
    completion_submitted_at, inspiration_case_draft_id,
    'current_phase 显示待验收，但没有 submitted 节点' AS detail
  FROM snapshot
  WHERE current_phase LIKE '%待验收%'
    AND milestone_submitted_count = 0
    AND current_phase <> '已完工待验收'

  UNION ALL

  SELECT
    'P010', 'high', project_id, name, status, business_status, current_phase, flow_stage_one, flow_stages,
    phase_total, milestone_total, escrow_total, provider_id, construction_provider_id, foreman_id,
    completion_submitted_at, inspiration_case_draft_id,
    'current_phase 显示施工中，但没有进行中阶段' AS detail
  FROM snapshot
  WHERE current_phase LIKE '%施工中%'
    AND phase_in_progress_count = 0
    AND milestone_in_progress_count = 0

  UNION ALL

  SELECT
    'P011', 'high', project_id, name, status, business_status, current_phase, flow_stage_one, flow_stages,
    phase_total, milestone_total, escrow_total, provider_id, construction_provider_id, foreman_id,
    completion_submitted_at, inspiration_case_draft_id,
    'current_phase=已完工待验收，但 completion_submitted_at 为空' AS detail
  FROM snapshot
  WHERE current_phase = '已完工待验收'
    AND completion_submitted_at IS NULL

  UNION ALL

  SELECT
    'P012', 'medium', project_id, name, status, business_status, current_phase, flow_stage_one, flow_stages,
    phase_total, milestone_total, escrow_total, provider_id, construction_provider_id, foreman_id,
    completion_submitted_at, inspiration_case_draft_id,
    'current_phase=已归档，但 inspiration_case_draft_id 为空' AS detail
  FROM snapshot
  WHERE current_phase = '已归档'
    AND COALESCE(inspiration_case_draft_id, 0) = 0

  UNION ALL

  SELECT
    'P013', 'medium', project_id, name, status, business_status, current_phase, flow_stage_one, flow_stages,
    phase_total, milestone_total, escrow_total, provider_id, construction_provider_id, foreman_id,
    completion_submitted_at, inspiration_case_draft_id,
    'provider_id 无效或服务商展示名会退化' AS detail
  FROM snapshot
  WHERE provider_id = 0
     OR provider_type IS NULL
     OR provider_display_seed IS NULL

  UNION ALL

  SELECT
    'P014', 'medium', project_id, name, status, business_status, current_phase, flow_stage_one, flow_stages,
    phase_total, milestone_total, escrow_total, provider_id, construction_provider_id, foreman_id,
    completion_submitted_at, inspiration_case_draft_id,
    '托管账户金额口径异常' AS detail
  FROM snapshot
  WHERE escrow_total > 0
    AND (
      escrow_released_amount > escrow_total_amount
      OR escrow_frozen_amount + escrow_available_amount + escrow_released_amount > escrow_total_amount + 0.01
    )

  UNION ALL

  SELECT
    'P015', 'fatal', project_id, name, status, business_status, current_phase, flow_stage_one, flow_stages,
    phase_total, milestone_total, escrow_total, provider_id, construction_provider_id, foreman_id,
    completion_submitted_at, inspiration_case_draft_id,
    '已完工项目缺阶段/节点/托管，属于结构断裂项目' AS detail
  FROM snapshot
  WHERE status = 1
    AND (phase_total = 0 OR milestone_total = 0 OR escrow_total = 0)
)
SELECT *
FROM findings
WHERE (:'project_id' = '' OR project_id = CAST(:'project_id' AS bigint))
  AND (:'severity' = '' OR severity = REPLACE(:'severity', '''', ''))
ORDER BY
  CASE severity
    WHEN 'fatal' THEN 1
    WHEN 'high' THEN 2
    WHEN 'medium' THEN 3
    ELSE 4
  END,
  project_id,
  rule_code;
