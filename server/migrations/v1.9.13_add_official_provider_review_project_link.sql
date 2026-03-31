BEGIN;

ALTER TABLE provider_reviews
  ADD COLUMN IF NOT EXISTS project_id BIGINT NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_provider_reviews_project_id
  ON provider_reviews(project_id);

CREATE UNIQUE INDEX IF NOT EXISTS uq_provider_reviews_official_project_owner_provider
  ON provider_reviews(project_id, user_id, provider_id)
  WHERE project_id > 0;

UPDATE providers
SET rating = 0,
    review_count = 0;

COMMIT;
