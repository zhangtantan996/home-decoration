CREATE TABLE IF NOT EXISTS business_flows (
  id BIGSERIAL PRIMARY KEY,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
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
  current_stage VARCHAR(40) NOT NULL DEFAULT 'lead_pending',
  stage_changed_at TIMESTAMPTZ,
  closed_reason VARCHAR(255) NOT NULL DEFAULT ''
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_business_flow_source ON business_flows(source_type, source_id);
CREATE INDEX IF NOT EXISTS idx_business_flow_project_id ON business_flows(project_id);
CREATE INDEX IF NOT EXISTS idx_business_flow_current_stage ON business_flows(current_stage);

ALTER TABLE projects
  ADD COLUMN IF NOT EXISTS selected_quote_submission_id BIGINT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS inspiration_case_draft_id BIGINT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS construction_quote_snapshot TEXT NOT NULL DEFAULT '';

ALTER TABLE milestones
  ADD COLUMN IF NOT EXISTS rejection_reason TEXT NOT NULL DEFAULT '';

CREATE INDEX IF NOT EXISTS idx_projects_selected_quote_submission_id ON projects(selected_quote_submission_id);
CREATE INDEX IF NOT EXISTS idx_projects_inspiration_case_draft_id ON projects(inspiration_case_draft_id);
