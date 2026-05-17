ALTER TABLE risk_warnings
  ADD COLUMN IF NOT EXISTS phase_id BIGINT NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_risk_warnings_phase_id
  ON risk_warnings (phase_id);
