BEGIN;

CREATE TEMP TABLE tmp_business_flow_backfill (
  source_type VARCHAR(20) NOT NULL,
  source_id BIGINT NOT NULL,
  customer_user_id BIGINT NOT NULL DEFAULT 0,
  designer_provider_id BIGINT NOT NULL DEFAULT 0,
  confirmed_proposal_id BIGINT NOT NULL DEFAULT 0,
  selected_foreman_provider_id BIGINT NOT NULL DEFAULT 0,
  selected_quote_task_id BIGINT NOT NULL DEFAULT 0,
  selected_quote_submission_id BIGINT NOT NULL DEFAULT 0,
  project_id BIGINT NOT NULL DEFAULT 0,
  inspiration_case_draft_id BIGINT NOT NULL DEFAULT 0,
  current_stage VARCHAR(40) NOT NULL,
  stage_changed_at TIMESTAMPTZ,
  closed_reason VARCHAR(255) NOT NULL DEFAULT ''
) ON COMMIT DROP;

WITH booking_latest_proposal AS (
  SELECT DISTINCT ON (p.booking_id)
    p.booking_id,
    p.id AS proposal_id,
    p.designer_id,
    p.status AS proposal_status,
    COALESCE(p.confirmed_at, p.updated_at, p.created_at) AS proposal_changed_at
  FROM proposals p
  WHERE COALESCE(p.booking_id, 0) > 0
  ORDER BY
    p.booking_id,
    CASE p.status
      WHEN 2 THEN 0
      WHEN 1 THEN 1
      WHEN 3 THEN 2
      WHEN 4 THEN 3
      ELSE 9
    END,
    COALESCE(p.confirmed_at, p.updated_at, p.created_at) DESC,
    p.id DESC
),
booking_project AS (
  SELECT DISTINCT ON (booking_id)
    booking_id,
    project_id,
    project_status,
    business_status,
    current_phase,
    provider_id,
    construction_provider_id,
    foreman_id,
    selected_quote_submission_id,
    inspiration_case_draft_id,
    project_changed_at
  FROM (
    SELECT
      p.booking_id,
      pr.id AS project_id,
      pr.status AS project_status,
      COALESCE(pr.business_status, '') AS business_status,
      COALESCE(pr.current_phase, '') AS current_phase,
      pr.provider_id,
      pr.construction_provider_id,
      pr.foreman_id,
      pr.selected_quote_submission_id,
      pr.inspiration_case_draft_id,
      pr.updated_at AS project_changed_at
    FROM proposals p
    JOIN projects pr ON pr.proposal_id = p.id
    WHERE COALESCE(p.booking_id, 0) > 0

    UNION ALL

    SELECT
      o.booking_id,
      pr.id AS project_id,
      pr.status AS project_status,
      COALESCE(pr.business_status, '') AS business_status,
      COALESCE(pr.current_phase, '') AS current_phase,
      pr.provider_id,
      pr.construction_provider_id,
      pr.foreman_id,
      pr.selected_quote_submission_id,
      pr.inspiration_case_draft_id,
      pr.updated_at AS project_changed_at
    FROM orders o
    JOIN projects pr ON pr.id = o.project_id
    WHERE COALESCE(o.booking_id, 0) > 0
      AND COALESCE(o.project_id, 0) > 0
  ) s
  ORDER BY booking_id, project_id DESC
),
demand_latest_proposal AS (
  SELECT DISTINCT ON (p.demand_id)
    p.demand_id,
    p.id AS proposal_id,
    p.designer_id,
    p.status AS proposal_status,
    COALESCE(p.confirmed_at, p.updated_at, p.created_at) AS proposal_changed_at
  FROM proposals p
  WHERE COALESCE(p.demand_id, 0) > 0
  ORDER BY
    p.demand_id,
    CASE p.status
      WHEN 2 THEN 0
      WHEN 1 THEN 1
      WHEN 3 THEN 2
      WHEN 4 THEN 3
      ELSE 9
    END,
    COALESCE(p.confirmed_at, p.updated_at, p.created_at) DESC,
    p.id DESC
),
demand_primary_match AS (
  SELECT DISTINCT ON (dm.demand_id)
    dm.demand_id,
    dm.provider_id,
    dm.status AS match_status,
    dm.proposal_id,
    COALESCE(dm.responded_at, dm.assigned_at, dm.updated_at, dm.created_at) AS match_changed_at
  FROM demand_matches dm
  WHERE COALESCE(dm.demand_id, 0) > 0
  ORDER BY
    dm.demand_id,
    CASE dm.status
      WHEN 'quoted' THEN 0
      WHEN 'accepted' THEN 1
      WHEN 'pending' THEN 2
      WHEN 'declined' THEN 3
      ELSE 9
    END,
    COALESCE(dm.responded_at, dm.assigned_at, dm.updated_at, dm.created_at) DESC,
    dm.id DESC
),
demand_project AS (
  SELECT DISTINCT ON (demand_id)
    demand_id,
    project_id,
    project_status,
    business_status,
    current_phase,
    provider_id,
    construction_provider_id,
    foreman_id,
    selected_quote_submission_id,
    inspiration_case_draft_id,
    project_changed_at
  FROM (
    SELECT
      p.demand_id,
      pr.id AS project_id,
      pr.status AS project_status,
      COALESCE(pr.business_status, '') AS business_status,
      COALESCE(pr.current_phase, '') AS current_phase,
      pr.provider_id,
      pr.construction_provider_id,
      pr.foreman_id,
      pr.selected_quote_submission_id,
      pr.inspiration_case_draft_id,
      pr.updated_at AS project_changed_at
    FROM proposals p
    JOIN projects pr ON pr.proposal_id = p.id
    WHERE COALESCE(p.demand_id, 0) > 0

    UNION ALL

    SELECT
      p.demand_id,
      pr.id AS project_id,
      pr.status AS project_status,
      COALESCE(pr.business_status, '') AS business_status,
      COALESCE(pr.current_phase, '') AS current_phase,
      pr.provider_id,
      pr.construction_provider_id,
      pr.foreman_id,
      pr.selected_quote_submission_id,
      pr.inspiration_case_draft_id,
      pr.updated_at AS project_changed_at
    FROM orders o
    JOIN proposals p ON p.id = o.proposal_id
    JOIN projects pr ON pr.id = o.project_id
    WHERE COALESCE(p.demand_id, 0) > 0
      AND COALESCE(o.project_id, 0) > 0
  ) s
  ORDER BY demand_id, project_id DESC
),
quote_by_project AS (
  SELECT DISTINCT ON (q.project_id)
    q.project_id,
    q.id AS quote_list_id,
    q.status AS quote_status,
    q.user_confirmation_status,
    q.active_submission_id,
    q.awarded_provider_id,
    qs.provider_id AS submission_provider_id,
    COALESCE(q.user_confirmed_at, q.submitted_to_user_at, q.rejected_at, q.updated_at, q.created_at) AS quote_changed_at
  FROM quote_lists q
  LEFT JOIN quote_submissions qs ON qs.id = q.active_submission_id
  WHERE COALESCE(q.project_id, 0) > 0
  ORDER BY
    q.project_id,
    CASE
      WHEN q.user_confirmation_status = 'confirmed' OR q.status = 'user_confirmed' THEN 0
      WHEN q.status = 'submitted_to_user' THEN 1
      WHEN q.status = 'rejected' THEN 2
      WHEN q.status = 'pricing_in_progress' THEN 3
      WHEN q.status = 'draft' THEN 4
      ELSE 5
    END,
    COALESCE(q.user_confirmed_at, q.submitted_to_user_at, q.rejected_at, q.updated_at, q.created_at) DESC,
    q.id DESC
),
quote_by_proposal AS (
  SELECT DISTINCT ON (q.proposal_id)
    q.proposal_id,
    q.id AS quote_list_id,
    q.status AS quote_status,
    q.user_confirmation_status,
    q.active_submission_id,
    q.awarded_provider_id,
    qs.provider_id AS submission_provider_id,
    COALESCE(q.user_confirmed_at, q.submitted_to_user_at, q.rejected_at, q.updated_at, q.created_at) AS quote_changed_at
  FROM quote_lists q
  LEFT JOIN quote_submissions qs ON qs.id = q.active_submission_id
  WHERE COALESCE(q.proposal_id, 0) > 0
  ORDER BY
    q.proposal_id,
    CASE
      WHEN q.user_confirmation_status = 'confirmed' OR q.status = 'user_confirmed' THEN 0
      WHEN q.status = 'submitted_to_user' THEN 1
      WHEN q.status = 'rejected' THEN 2
      WHEN q.status = 'pricing_in_progress' THEN 3
      WHEN q.status = 'draft' THEN 4
      ELSE 5
    END,
    COALESCE(q.user_confirmed_at, q.submitted_to_user_at, q.rejected_at, q.updated_at, q.created_at) DESC,
    q.id DESC
),
project_milestone_state AS (
  SELECT
    m.project_id,
    BOOL_OR(m.status = 2) AS has_submitted,
    BOOL_OR(m.status = 1) AS has_in_progress
  FROM milestones m
  GROUP BY m.project_id
),
project_case_draft AS (
  SELECT
    COALESCE(ca.source_project_id, 0) AS project_id,
    MAX(ca.id) AS case_audit_id
  FROM case_audits ca
  WHERE COALESCE(ca.source_project_id, 0) > 0
  GROUP BY COALESCE(ca.source_project_id, 0)
)
INSERT INTO tmp_business_flow_backfill (
  source_type, source_id, customer_user_id, designer_provider_id, confirmed_proposal_id,
  selected_foreman_provider_id, selected_quote_task_id, selected_quote_submission_id,
  project_id, inspiration_case_draft_id, current_stage, stage_changed_at, closed_reason
)
SELECT
  'booking' AS source_type,
  b.id AS source_id,
  COALESCE(b.user_id, 0) AS customer_user_id,
  COALESCE(blp.designer_id, b.provider_id, 0) AS designer_provider_id,
  CASE WHEN COALESCE(blp.proposal_status, 0) = 2 THEN blp.proposal_id ELSE 0 END AS confirmed_proposal_id,
  COALESCE(qp.submission_provider_id, qp.awarded_provider_id, bp.foreman_id, bp.construction_provider_id, 0) AS selected_foreman_provider_id,
  COALESCE(qp.quote_list_id, qq.quote_list_id, 0) AS selected_quote_task_id,
  COALESCE(qp.active_submission_id, qq.active_submission_id, bp.selected_quote_submission_id, 0) AS selected_quote_submission_id,
  COALESCE(bp.project_id, 0) AS project_id,
  COALESCE(NULLIF(bp.inspiration_case_draft_id, 0), pcd.case_audit_id, 0) AS inspiration_case_draft_id,
  CASE
    WHEN b.status = 4 THEN 'cancelled'
    WHEN COALESCE(NULLIF(bp.inspiration_case_draft_id, 0), pcd.case_audit_id, 0) > 0 THEN 'archived'
    WHEN bp.business_status = 'completed' OR bp.project_status = 1 OR bp.current_phase = '已完工' THEN 'completed'
    WHEN COALESCE(pms.has_submitted, FALSE) OR bp.current_phase LIKE '%待验收%' THEN 'node_acceptance_in_progress'
    WHEN bp.business_status = 'in_progress' OR COALESCE(pms.has_in_progress, FALSE) OR bp.current_phase LIKE '%施工中%' OR bp.current_phase LIKE '%待整改%' OR bp.current_phase LIKE '%工程%' THEN 'in_construction'
    WHEN bp.business_status = 'construction_quote_confirmed' OR COALESCE(qp.quote_status, qq.quote_status, '') IN ('user_confirmed', 'locked', 'awarded', 'closed') OR bp.current_phase LIKE '%待开工%' THEN 'ready_to_start'
    WHEN COALESCE(qp.quote_status, qq.quote_status, '') IN ('submitted_to_user', 'rejected') THEN 'construction_quote_pending'
    WHEN bp.business_status IN ('construction_confirmed', 'proposal_confirmed') OR COALESCE(blp.proposal_status, 0) = 2 THEN 'construction_party_pending'
    WHEN COALESCE(blp.proposal_status, 0) = 1 THEN 'design_pending_confirmation'
    WHEN b.status IN (2, 3) OR COALESCE(blp.proposal_id, 0) > 0 THEN 'negotiating'
    ELSE 'lead_pending'
  END AS current_stage,
  COALESCE(qp.quote_changed_at, qq.quote_changed_at, bp.project_changed_at, blp.proposal_changed_at, b.updated_at, b.created_at) AS stage_changed_at,
  CASE WHEN b.status = 4 THEN 'booking_cancelled' ELSE '' END AS closed_reason
FROM bookings b
LEFT JOIN booking_latest_proposal blp ON blp.booking_id = b.id
LEFT JOIN booking_project bp ON bp.booking_id = b.id
LEFT JOIN quote_by_project qp ON qp.project_id = bp.project_id
LEFT JOIN quote_by_proposal qq ON qq.proposal_id = blp.proposal_id AND COALESCE(bp.project_id, 0) = 0
LEFT JOIN project_milestone_state pms ON pms.project_id = bp.project_id
LEFT JOIN project_case_draft pcd ON pcd.project_id = bp.project_id
WHERE COALESCE(b.id, 0) > 0;

WITH demand_latest_proposal AS (
  SELECT DISTINCT ON (p.demand_id)
    p.demand_id,
    p.id AS proposal_id,
    p.designer_id,
    p.status AS proposal_status,
    COALESCE(p.confirmed_at, p.updated_at, p.created_at) AS proposal_changed_at
  FROM proposals p
  WHERE COALESCE(p.demand_id, 0) > 0
  ORDER BY
    p.demand_id,
    CASE p.status
      WHEN 2 THEN 0
      WHEN 1 THEN 1
      WHEN 3 THEN 2
      WHEN 4 THEN 3
      ELSE 9
    END,
    COALESCE(p.confirmed_at, p.updated_at, p.created_at) DESC,
    p.id DESC
),
demand_primary_match AS (
  SELECT DISTINCT ON (dm.demand_id)
    dm.demand_id,
    dm.provider_id,
    dm.status AS match_status,
    dm.proposal_id,
    COALESCE(dm.responded_at, dm.assigned_at, dm.updated_at, dm.created_at) AS match_changed_at
  FROM demand_matches dm
  WHERE COALESCE(dm.demand_id, 0) > 0
  ORDER BY
    dm.demand_id,
    CASE dm.status
      WHEN 'quoted' THEN 0
      WHEN 'accepted' THEN 1
      WHEN 'pending' THEN 2
      WHEN 'declined' THEN 3
      ELSE 9
    END,
    COALESCE(dm.responded_at, dm.assigned_at, dm.updated_at, dm.created_at) DESC,
    dm.id DESC
),
demand_project AS (
  SELECT DISTINCT ON (demand_id)
    demand_id,
    project_id,
    project_status,
    business_status,
    current_phase,
    provider_id,
    construction_provider_id,
    foreman_id,
    selected_quote_submission_id,
    inspiration_case_draft_id,
    project_changed_at
  FROM (
    SELECT
      p.demand_id,
      pr.id AS project_id,
      pr.status AS project_status,
      COALESCE(pr.business_status, '') AS business_status,
      COALESCE(pr.current_phase, '') AS current_phase,
      pr.provider_id,
      pr.construction_provider_id,
      pr.foreman_id,
      pr.selected_quote_submission_id,
      pr.inspiration_case_draft_id,
      pr.updated_at AS project_changed_at
    FROM proposals p
    JOIN projects pr ON pr.proposal_id = p.id
    WHERE COALESCE(p.demand_id, 0) > 0

    UNION ALL

    SELECT
      p.demand_id,
      pr.id AS project_id,
      pr.status AS project_status,
      COALESCE(pr.business_status, '') AS business_status,
      COALESCE(pr.current_phase, '') AS current_phase,
      pr.provider_id,
      pr.construction_provider_id,
      pr.foreman_id,
      pr.selected_quote_submission_id,
      pr.inspiration_case_draft_id,
      pr.updated_at AS project_changed_at
    FROM orders o
    JOIN proposals p ON p.id = o.proposal_id
    JOIN projects pr ON pr.id = o.project_id
    WHERE COALESCE(p.demand_id, 0) > 0
      AND COALESCE(o.project_id, 0) > 0
  ) s
  ORDER BY demand_id, project_id DESC
),
quote_by_project AS (
  SELECT DISTINCT ON (q.project_id)
    q.project_id,
    q.id AS quote_list_id,
    q.status AS quote_status,
    q.user_confirmation_status,
    q.active_submission_id,
    q.awarded_provider_id,
    qs.provider_id AS submission_provider_id,
    COALESCE(q.user_confirmed_at, q.submitted_to_user_at, q.rejected_at, q.updated_at, q.created_at) AS quote_changed_at
  FROM quote_lists q
  LEFT JOIN quote_submissions qs ON qs.id = q.active_submission_id
  WHERE COALESCE(q.project_id, 0) > 0
  ORDER BY
    q.project_id,
    CASE
      WHEN q.user_confirmation_status = 'confirmed' OR q.status = 'user_confirmed' THEN 0
      WHEN q.status = 'submitted_to_user' THEN 1
      WHEN q.status = 'rejected' THEN 2
      WHEN q.status = 'pricing_in_progress' THEN 3
      WHEN q.status = 'draft' THEN 4
      ELSE 5
    END,
    COALESCE(q.user_confirmed_at, q.submitted_to_user_at, q.rejected_at, q.updated_at, q.created_at) DESC,
    q.id DESC
),
quote_by_proposal AS (
  SELECT DISTINCT ON (q.proposal_id)
    q.proposal_id,
    q.id AS quote_list_id,
    q.status AS quote_status,
    q.user_confirmation_status,
    q.active_submission_id,
    q.awarded_provider_id,
    qs.provider_id AS submission_provider_id,
    COALESCE(q.user_confirmed_at, q.submitted_to_user_at, q.rejected_at, q.updated_at, q.created_at) AS quote_changed_at
  FROM quote_lists q
  LEFT JOIN quote_submissions qs ON qs.id = q.active_submission_id
  WHERE COALESCE(q.proposal_id, 0) > 0
  ORDER BY
    q.proposal_id,
    CASE
      WHEN q.user_confirmation_status = 'confirmed' OR q.status = 'user_confirmed' THEN 0
      WHEN q.status = 'submitted_to_user' THEN 1
      WHEN q.status = 'rejected' THEN 2
      WHEN q.status = 'pricing_in_progress' THEN 3
      WHEN q.status = 'draft' THEN 4
      ELSE 5
    END,
    COALESCE(q.user_confirmed_at, q.submitted_to_user_at, q.rejected_at, q.updated_at, q.created_at) DESC,
    q.id DESC
),
project_milestone_state AS (
  SELECT
    m.project_id,
    BOOL_OR(m.status = 2) AS has_submitted,
    BOOL_OR(m.status = 1) AS has_in_progress
  FROM milestones m
  GROUP BY m.project_id
),
project_case_draft AS (
  SELECT
    COALESCE(ca.source_project_id, 0) AS project_id,
    MAX(ca.id) AS case_audit_id
  FROM case_audits ca
  WHERE COALESCE(ca.source_project_id, 0) > 0
  GROUP BY COALESCE(ca.source_project_id, 0)
)
INSERT INTO tmp_business_flow_backfill (
  source_type, source_id, customer_user_id, designer_provider_id, confirmed_proposal_id,
  selected_foreman_provider_id, selected_quote_task_id, selected_quote_submission_id,
  project_id, inspiration_case_draft_id, current_stage, stage_changed_at, closed_reason
)
SELECT
  'demand' AS source_type,
  d.id AS source_id,
  COALESCE(d.user_id, 0) AS customer_user_id,
  COALESCE(dlp.designer_id, dpm.provider_id, 0) AS designer_provider_id,
  CASE WHEN COALESCE(dlp.proposal_status, 0) = 2 THEN dlp.proposal_id ELSE 0 END AS confirmed_proposal_id,
  COALESCE(qp.submission_provider_id, qp.awarded_provider_id, dp.foreman_id, dp.construction_provider_id, 0) AS selected_foreman_provider_id,
  COALESCE(qp.quote_list_id, qq.quote_list_id, 0) AS selected_quote_task_id,
  COALESCE(qp.active_submission_id, qq.active_submission_id, dp.selected_quote_submission_id, 0) AS selected_quote_submission_id,
  COALESCE(dp.project_id, 0) AS project_id,
  COALESCE(NULLIF(dp.inspiration_case_draft_id, 0), pcd.case_audit_id, 0) AS inspiration_case_draft_id,
  CASE
    WHEN d.status = 'closed' THEN 'cancelled'
    WHEN COALESCE(NULLIF(dp.inspiration_case_draft_id, 0), pcd.case_audit_id, 0) > 0 THEN 'archived'
    WHEN dp.business_status = 'completed' OR dp.project_status = 1 OR dp.current_phase = '已完工' THEN 'completed'
    WHEN COALESCE(pms.has_submitted, FALSE) OR dp.current_phase LIKE '%待验收%' THEN 'node_acceptance_in_progress'
    WHEN dp.business_status = 'in_progress' OR COALESCE(pms.has_in_progress, FALSE) OR dp.current_phase LIKE '%施工中%' OR dp.current_phase LIKE '%待整改%' OR dp.current_phase LIKE '%工程%' THEN 'in_construction'
    WHEN dp.business_status = 'construction_quote_confirmed' OR COALESCE(qp.quote_status, qq.quote_status, '') IN ('user_confirmed', 'locked', 'awarded', 'closed') OR dp.current_phase LIKE '%待开工%' THEN 'ready_to_start'
    WHEN COALESCE(qp.quote_status, qq.quote_status, '') IN ('submitted_to_user', 'rejected') THEN 'construction_quote_pending'
    WHEN dp.business_status IN ('construction_confirmed', 'proposal_confirmed') OR COALESCE(dlp.proposal_status, 0) = 2 THEN 'construction_party_pending'
    WHEN COALESCE(dlp.proposal_status, 0) = 1 THEN 'design_pending_confirmation'
    WHEN d.status IN ('matching', 'matched', 'approved') OR COALESCE(dlp.proposal_id, 0) > 0 OR COALESCE(dpm.provider_id, 0) > 0 THEN 'negotiating'
    ELSE 'lead_pending'
  END AS current_stage,
  COALESCE(qp.quote_changed_at, qq.quote_changed_at, dp.project_changed_at, dlp.proposal_changed_at, dpm.match_changed_at, d.updated_at, d.created_at) AS stage_changed_at,
  COALESCE(NULLIF(d.closed_reason, ''), '') AS closed_reason
FROM demands d
LEFT JOIN demand_latest_proposal dlp ON dlp.demand_id = d.id
LEFT JOIN demand_primary_match dpm ON dpm.demand_id = d.id
LEFT JOIN demand_project dp ON dp.demand_id = d.id
LEFT JOIN quote_by_project qp ON qp.project_id = dp.project_id
LEFT JOIN quote_by_proposal qq ON qq.proposal_id = dlp.proposal_id AND COALESCE(dp.project_id, 0) = 0
LEFT JOIN project_milestone_state pms ON pms.project_id = dp.project_id
LEFT JOIN project_case_draft pcd ON pcd.project_id = dp.project_id
WHERE COALESCE(d.id, 0) > 0;

INSERT INTO business_flows (
  source_type, source_id, customer_user_id, designer_provider_id, confirmed_proposal_id,
  selected_foreman_provider_id, selected_quote_task_id, selected_quote_submission_id,
  project_id, inspiration_case_draft_id, current_stage, stage_changed_at, closed_reason,
  created_at, updated_at
)
SELECT
  t.source_type,
  t.source_id,
  t.customer_user_id,
  t.designer_provider_id,
  t.confirmed_proposal_id,
  t.selected_foreman_provider_id,
  t.selected_quote_task_id,
  t.selected_quote_submission_id,
  t.project_id,
  t.inspiration_case_draft_id,
  t.current_stage,
  t.stage_changed_at,
  t.closed_reason,
  NOW(),
  NOW()
FROM tmp_business_flow_backfill t
ON CONFLICT (source_type, source_id) DO UPDATE SET
  customer_user_id = CASE WHEN business_flows.customer_user_id = 0 THEN EXCLUDED.customer_user_id ELSE business_flows.customer_user_id END,
  designer_provider_id = CASE WHEN business_flows.designer_provider_id = 0 THEN EXCLUDED.designer_provider_id ELSE business_flows.designer_provider_id END,
  confirmed_proposal_id = CASE WHEN business_flows.confirmed_proposal_id = 0 THEN EXCLUDED.confirmed_proposal_id ELSE business_flows.confirmed_proposal_id END,
  selected_foreman_provider_id = CASE WHEN business_flows.selected_foreman_provider_id = 0 THEN EXCLUDED.selected_foreman_provider_id ELSE business_flows.selected_foreman_provider_id END,
  selected_quote_task_id = CASE WHEN business_flows.selected_quote_task_id = 0 THEN EXCLUDED.selected_quote_task_id ELSE business_flows.selected_quote_task_id END,
  selected_quote_submission_id = CASE WHEN business_flows.selected_quote_submission_id = 0 THEN EXCLUDED.selected_quote_submission_id ELSE business_flows.selected_quote_submission_id END,
  project_id = CASE WHEN business_flows.project_id = 0 THEN EXCLUDED.project_id ELSE business_flows.project_id END,
  inspiration_case_draft_id = CASE WHEN business_flows.inspiration_case_draft_id = 0 THEN EXCLUDED.inspiration_case_draft_id ELSE business_flows.inspiration_case_draft_id END,
  current_stage = CASE
    WHEN (COALESCE(business_flows.current_stage, '') = '' OR business_flows.current_stage = 'lead_pending') AND EXCLUDED.current_stage <> 'lead_pending'
      THEN EXCLUDED.current_stage
    WHEN business_flows.current_stage = 'completed' AND EXCLUDED.current_stage = 'archived'
      THEN 'archived'
    ELSE business_flows.current_stage
  END,
  stage_changed_at = CASE
    WHEN (COALESCE(business_flows.current_stage, '') = '' OR business_flows.current_stage = 'lead_pending') AND EXCLUDED.current_stage <> 'lead_pending'
      THEN COALESCE(EXCLUDED.stage_changed_at, business_flows.stage_changed_at, NOW())
    WHEN business_flows.stage_changed_at IS NULL
      THEN EXCLUDED.stage_changed_at
    ELSE business_flows.stage_changed_at
  END,
  closed_reason = CASE WHEN COALESCE(business_flows.closed_reason, '') = '' THEN EXCLUDED.closed_reason ELSE business_flows.closed_reason END,
  updated_at = NOW();

COMMIT;
