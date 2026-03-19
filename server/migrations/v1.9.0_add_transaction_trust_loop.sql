CREATE TABLE IF NOT EXISTS change_orders (
  id BIGSERIAL PRIMARY KEY,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  project_id BIGINT NOT NULL DEFAULT 0,
  contract_id BIGINT NOT NULL DEFAULT 0,
  initiator_type VARCHAR(20) NOT NULL DEFAULT '',
  initiator_id BIGINT NOT NULL DEFAULT 0,
  title VARCHAR(200) NOT NULL DEFAULT '',
  reason TEXT NOT NULL DEFAULT '',
  items JSONB NOT NULL DEFAULT '[]'::jsonb,
  amount_impact DECIMAL(12,2) NOT NULL DEFAULT 0,
  timeline_impact INTEGER NOT NULL DEFAULT 0,
  evidence_urls JSONB NOT NULL DEFAULT '[]'::jsonb,
  status VARCHAR(30) NOT NULL DEFAULT 'pending',
  resolved_by BIGINT NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_change_orders_project_id ON change_orders(project_id);
CREATE INDEX IF NOT EXISTS idx_change_orders_contract_id ON change_orders(contract_id);
CREATE INDEX IF NOT EXISTS idx_change_orders_status ON change_orders(status);

CREATE TABLE IF NOT EXISTS complaints (
  id BIGSERIAL PRIMARY KEY,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  project_id BIGINT NOT NULL DEFAULT 0,
  user_id BIGINT NOT NULL DEFAULT 0,
  provider_id BIGINT NOT NULL DEFAULT 0,
  category VARCHAR(50) NOT NULL DEFAULT '',
  title VARCHAR(200) NOT NULL DEFAULT '',
  description TEXT NOT NULL DEFAULT '',
  evidence_urls JSONB NOT NULL DEFAULT '[]'::jsonb,
  status VARCHAR(20) NOT NULL DEFAULT 'submitted',
  resolution TEXT NOT NULL DEFAULT '',
  admin_id BIGINT NOT NULL DEFAULT 0,
  freeze_payment BOOLEAN NOT NULL DEFAULT FALSE,
  merchant_response TEXT NOT NULL DEFAULT ''
);

CREATE INDEX IF NOT EXISTS idx_complaints_project_id ON complaints(project_id);
CREATE INDEX IF NOT EXISTS idx_complaints_user_id ON complaints(user_id);
CREATE INDEX IF NOT EXISTS idx_complaints_provider_id ON complaints(provider_id);
CREATE INDEX IF NOT EXISTS idx_complaints_status ON complaints(status);

CREATE TABLE IF NOT EXISTS evaluations (
  id BIGSERIAL PRIMARY KEY,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  project_id BIGINT NOT NULL,
  user_id BIGINT NOT NULL,
  provider_id BIGINT NOT NULL DEFAULT 0,
  overall_score DECIMAL(2,1) NOT NULL DEFAULT 0,
  dimension_scores JSONB NOT NULL DEFAULT '{}'::jsonb,
  content TEXT NOT NULL DEFAULT '',
  image_urls JSONB NOT NULL DEFAULT '[]'::jsonb,
  is_anonymous BOOLEAN NOT NULL DEFAULT FALSE,
  CONSTRAINT idx_evaluations_project_user UNIQUE(project_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_evaluations_provider_id ON evaluations(provider_id);
