CREATE TABLE IF NOT EXISTS demands (
  id BIGSERIAL PRIMARY KEY,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  user_id BIGINT NOT NULL,
  demand_type VARCHAR(30) NOT NULL DEFAULT 'renovation',
  title VARCHAR(200) NOT NULL DEFAULT '',
  city VARCHAR(50) NOT NULL DEFAULT '',
  district VARCHAR(50) NOT NULL DEFAULT '',
  address VARCHAR(300) NOT NULL DEFAULT '',
  area DECIMAL(10,2) NOT NULL DEFAULT 0,
  budget_min DECIMAL(12,2) NOT NULL DEFAULT 0,
  budget_max DECIMAL(12,2) NOT NULL DEFAULT 0,
  timeline VARCHAR(30) NOT NULL DEFAULT '',
  style_pref VARCHAR(255) NOT NULL DEFAULT '',
  description TEXT NOT NULL DEFAULT '',
  attachments JSONB NOT NULL DEFAULT '[]'::jsonb,
  status VARCHAR(20) NOT NULL DEFAULT 'draft',
  reviewer_id BIGINT NOT NULL DEFAULT 0,
  review_note TEXT NOT NULL DEFAULT '',
  reviewed_at TIMESTAMPTZ NULL,
  matched_count INTEGER NOT NULL DEFAULT 0,
  max_match INTEGER NOT NULL DEFAULT 3,
  closed_reason VARCHAR(50) NOT NULL DEFAULT ''
);

CREATE INDEX IF NOT EXISTS idx_demands_user_id ON demands(user_id);
CREATE INDEX IF NOT EXISTS idx_demands_status ON demands(status);
CREATE INDEX IF NOT EXISTS idx_demands_city_district ON demands(city, district);

CREATE TABLE IF NOT EXISTS demand_matches (
  id BIGSERIAL PRIMARY KEY,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  demand_id BIGINT NOT NULL,
  provider_id BIGINT NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'pending',
  assigned_by BIGINT NOT NULL DEFAULT 0,
  assigned_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  response_deadline TIMESTAMPTZ NULL,
  responded_at TIMESTAMPTZ NULL,
  decline_reason VARCHAR(300) NOT NULL DEFAULT '',
  proposal_id BIGINT NOT NULL DEFAULT 0,
  UNIQUE (demand_id, provider_id)
);

CREATE INDEX IF NOT EXISTS idx_demand_matches_demand_id ON demand_matches(demand_id);
CREATE INDEX IF NOT EXISTS idx_demand_matches_provider_id ON demand_matches(provider_id);
CREATE INDEX IF NOT EXISTS idx_demand_matches_status ON demand_matches(status);

CREATE TABLE IF NOT EXISTS contracts (
  id BIGSERIAL PRIMARY KEY,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  project_id BIGINT NOT NULL DEFAULT 0,
  demand_id BIGINT NOT NULL DEFAULT 0,
  provider_id BIGINT NOT NULL DEFAULT 0,
  user_id BIGINT NOT NULL DEFAULT 0,
  contract_no VARCHAR(50) NOT NULL DEFAULT '',
  title VARCHAR(200) NOT NULL DEFAULT '',
  total_amount DECIMAL(12,2) NOT NULL DEFAULT 0,
  payment_plan JSONB NOT NULL DEFAULT '[]'::jsonb,
  attachment_urls JSONB NOT NULL DEFAULT '[]'::jsonb,
  terms_snapshot JSONB NOT NULL DEFAULT '{}'::jsonb,
  status VARCHAR(20) NOT NULL DEFAULT 'draft',
  confirmed_at TIMESTAMPTZ NULL,
  activated_at TIMESTAMPTZ NULL,
  completed_at TIMESTAMPTZ NULL,
  terminated_at TIMESTAMPTZ NULL,
  terminate_reason VARCHAR(300) NOT NULL DEFAULT ''
);

CREATE INDEX IF NOT EXISTS idx_contracts_project_id ON contracts(project_id);
CREATE INDEX IF NOT EXISTS idx_contracts_demand_id ON contracts(demand_id);
CREATE INDEX IF NOT EXISTS idx_contracts_provider_id ON contracts(provider_id);
CREATE INDEX IF NOT EXISTS idx_contracts_user_id ON contracts(user_id);

ALTER TABLE proposals
  ADD COLUMN IF NOT EXISTS source_type VARCHAR(20) NOT NULL DEFAULT 'booking',
  ADD COLUMN IF NOT EXISTS demand_id BIGINT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS demand_match_id BIGINT NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_proposals_source_type ON proposals(source_type);
CREATE INDEX IF NOT EXISTS idx_proposals_demand_id ON proposals(demand_id);
CREATE INDEX IF NOT EXISTS idx_proposals_demand_match_id ON proposals(demand_match_id);
