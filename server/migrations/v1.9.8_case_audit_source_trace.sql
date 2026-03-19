ALTER TABLE case_audits
    ADD COLUMN IF NOT EXISTS source_type VARCHAR(30) DEFAULT '',
    ADD COLUMN IF NOT EXISTS source_project_id BIGINT NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS source_proposal_id BIGINT NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_case_audits_source_type ON case_audits(source_type);
CREATE INDEX IF NOT EXISTS idx_case_audits_source_project_id ON case_audits(source_project_id);
CREATE INDEX IF NOT EXISTS idx_case_audits_source_proposal_id ON case_audits(source_proposal_id);
