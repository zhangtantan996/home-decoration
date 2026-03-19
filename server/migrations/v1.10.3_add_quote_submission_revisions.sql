-- v1.10.3 报价提交版本留痕

CREATE TABLE IF NOT EXISTS quote_submission_revisions (
  id BIGSERIAL PRIMARY KEY,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  quote_submission_id BIGINT NOT NULL DEFAULT 0,
  quote_list_id BIGINT NOT NULL DEFAULT 0,
  provider_id BIGINT NOT NULL DEFAULT 0,
  revision_no INTEGER NOT NULL DEFAULT 1,
  action VARCHAR(30) NOT NULL DEFAULT '',
  previous_status VARCHAR(30) NOT NULL DEFAULT '',
  next_status VARCHAR(30) NOT NULL DEFAULT '',
  previous_total_cent BIGINT NOT NULL DEFAULT 0,
  next_total_cent BIGINT NOT NULL DEFAULT 0,
  previous_items_json TEXT NOT NULL DEFAULT '[]',
  next_items_json TEXT NOT NULL DEFAULT '[]',
  change_reason TEXT NOT NULL DEFAULT ''
);

CREATE INDEX IF NOT EXISTS idx_quote_submission_revisions_submission_id
  ON quote_submission_revisions(quote_submission_id);

CREATE INDEX IF NOT EXISTS idx_quote_submission_revisions_quote_list_id
  ON quote_submission_revisions(quote_list_id);

CREATE INDEX IF NOT EXISTS idx_quote_submission_revisions_provider_id
  ON quote_submission_revisions(provider_id);

CREATE INDEX IF NOT EXISTS idx_quote_submission_revisions_revision_no
  ON quote_submission_revisions(quote_submission_id, revision_no);
