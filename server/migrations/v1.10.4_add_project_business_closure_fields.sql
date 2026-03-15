-- v1.10.4 业务闭环 P0：项目施工确认与开工状态字段

ALTER TABLE projects
  ADD COLUMN IF NOT EXISTS business_status VARCHAR(40) NOT NULL DEFAULT 'draft',
  ADD COLUMN IF NOT EXISTS construction_provider_id BIGINT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS foreman_id BIGINT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS construction_quote DOUBLE PRECISION NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS construction_confirmed_at TIMESTAMPTZ NULL,
  ADD COLUMN IF NOT EXISTS quote_confirmed_at TIMESTAMPTZ NULL,
  ADD COLUMN IF NOT EXISTS started_at TIMESTAMPTZ NULL;

CREATE INDEX IF NOT EXISTS idx_projects_business_status
  ON projects (business_status);

CREATE INDEX IF NOT EXISTS idx_projects_construction_provider_id
  ON projects (construction_provider_id);

CREATE INDEX IF NOT EXISTS idx_projects_foreman_id
  ON projects (foreman_id);
