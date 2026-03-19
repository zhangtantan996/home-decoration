-- P0 booking survey/budget flow and project completion materials

CREATE TABLE IF NOT EXISTS site_surveys (
  id BIGSERIAL PRIMARY KEY,
  booking_id BIGINT NOT NULL UNIQUE REFERENCES bookings(id) ON DELETE CASCADE,
  provider_id BIGINT NOT NULL REFERENCES providers(id) ON DELETE CASCADE,
  photos JSONB NOT NULL DEFAULT '[]'::jsonb,
  dimensions JSONB NOT NULL DEFAULT '{}'::jsonb,
  notes TEXT,
  status VARCHAR(32) NOT NULL DEFAULT 'submitted',
  submitted_at TIMESTAMP,
  confirmed_at TIMESTAMP,
  revision_requested_at TIMESTAMP,
  revision_request_reason TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_site_surveys_provider_id ON site_surveys(provider_id);
CREATE INDEX IF NOT EXISTS idx_site_surveys_status ON site_surveys(status);

CREATE TABLE IF NOT EXISTS budget_confirmations (
  id BIGSERIAL PRIMARY KEY,
  booking_id BIGINT NOT NULL UNIQUE REFERENCES bookings(id) ON DELETE CASCADE,
  provider_id BIGINT NOT NULL REFERENCES providers(id) ON DELETE CASCADE,
  budget_min NUMERIC(10,2) NOT NULL DEFAULT 0,
  budget_max NUMERIC(10,2) NOT NULL DEFAULT 0,
  includes JSONB NOT NULL DEFAULT '{}'::jsonb,
  notes TEXT,
  design_intent TEXT,
  status VARCHAR(32) NOT NULL DEFAULT 'submitted',
  submitted_at TIMESTAMP,
  accepted_at TIMESTAMP,
  rejected_at TIMESTAMP,
  rejection_reason TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_budget_confirmations_provider_id ON budget_confirmations(provider_id);
CREATE INDEX IF NOT EXISTS idx_budget_confirmations_status ON budget_confirmations(status);

ALTER TABLE projects ADD COLUMN IF NOT EXISTS completed_photos JSONB NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS completion_notes TEXT;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS completion_submitted_at TIMESTAMP;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS completion_rejection_reason TEXT;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS completion_rejected_at TIMESTAMP;
