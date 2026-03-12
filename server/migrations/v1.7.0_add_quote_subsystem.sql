CREATE TABLE IF NOT EXISTS quote_library_items (
  id BIGSERIAL PRIMARY KEY,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  erp_item_code VARCHAR(100) NOT NULL UNIQUE,
  name VARCHAR(255) NOT NULL,
  unit VARCHAR(20) NOT NULL DEFAULT '项',
  category_l1 VARCHAR(50) NOT NULL DEFAULT '',
  category_l2 VARCHAR(50) NOT NULL DEFAULT '',
  reference_price_cent BIGINT NOT NULL DEFAULT 0,
  pricing_note TEXT NOT NULL DEFAULT '',
  status SMALLINT NOT NULL DEFAULT 1,
  source_fingerprint VARCHAR(64) NOT NULL DEFAULT '',
  extensions_json TEXT NOT NULL DEFAULT ''
);

CREATE TABLE IF NOT EXISTS quote_lists (
  id BIGSERIAL PRIMARY KEY,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  project_id BIGINT NOT NULL DEFAULT 0,
  customer_id BIGINT NOT NULL DEFAULT 0,
  house_id BIGINT NOT NULL DEFAULT 0,
  owner_user_id BIGINT NOT NULL DEFAULT 0,
  scenario_type VARCHAR(50) NOT NULL DEFAULT '',
  title VARCHAR(200) NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'draft',
  currency VARCHAR(10) NOT NULL DEFAULT 'CNY',
  deadline_at TIMESTAMPTZ NULL,
  awarded_provider_id BIGINT NOT NULL DEFAULT 0,
  awarded_quote_submission_id BIGINT NOT NULL DEFAULT 0,
  extensions_json TEXT NOT NULL DEFAULT ''
);

CREATE TABLE IF NOT EXISTS quote_list_items (
  id BIGSERIAL PRIMARY KEY,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  quote_list_id BIGINT NOT NULL,
  standard_item_id BIGINT NOT NULL DEFAULT 0,
  line_no INTEGER NOT NULL DEFAULT 0,
  name VARCHAR(255) NOT NULL,
  unit VARCHAR(20) NOT NULL DEFAULT '项',
  quantity DOUBLE PRECISION NOT NULL DEFAULT 0,
  pricing_note TEXT NOT NULL DEFAULT '',
  category_l1 VARCHAR(50) NOT NULL DEFAULT '',
  category_l2 VARCHAR(50) NOT NULL DEFAULT '',
  sort_order INTEGER NOT NULL DEFAULT 0,
  extensions_json TEXT NOT NULL DEFAULT ''
);

CREATE TABLE IF NOT EXISTS quote_invitations (
  id BIGSERIAL PRIMARY KEY,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  quote_list_id BIGINT NOT NULL,
  provider_id BIGINT NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'invited',
  invited_by_user_id BIGINT NOT NULL DEFAULT 0,
  invited_at TIMESTAMPTZ NULL,
  responded_at TIMESTAMPTZ NULL,
  UNIQUE (quote_list_id, provider_id)
);

CREATE TABLE IF NOT EXISTS quote_submissions (
  id BIGSERIAL PRIMARY KEY,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  quote_list_id BIGINT NOT NULL,
  provider_id BIGINT NOT NULL,
  provider_type SMALLINT NOT NULL DEFAULT 0,
  provider_sub_type VARCHAR(20) NOT NULL DEFAULT '',
  status VARCHAR(20) NOT NULL DEFAULT 'draft',
  currency VARCHAR(10) NOT NULL DEFAULT 'CNY',
  total_cent BIGINT NOT NULL DEFAULT 0,
  estimated_days INTEGER NOT NULL DEFAULT 0,
  remark TEXT NOT NULL DEFAULT '',
  attachments_json TEXT NOT NULL DEFAULT '',
  team_size INTEGER NOT NULL DEFAULT 0,
  work_types TEXT NOT NULL DEFAULT '',
  construction_method_note TEXT NOT NULL DEFAULT '',
  site_visit_required BOOLEAN NOT NULL DEFAULT FALSE,
  UNIQUE (quote_list_id, provider_id)
);

CREATE TABLE IF NOT EXISTS quote_submission_items (
  id BIGSERIAL PRIMARY KEY,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  quote_submission_id BIGINT NOT NULL,
  quote_list_item_id BIGINT NOT NULL,
  unit_price_cent BIGINT NOT NULL DEFAULT 0,
  amount_cent BIGINT NOT NULL DEFAULT 0,
  remark TEXT NOT NULL DEFAULT '',
  UNIQUE (quote_submission_id, quote_list_item_id)
);

CREATE INDEX IF NOT EXISTS idx_quote_library_items_category_l1 ON quote_library_items(category_l1);
CREATE INDEX IF NOT EXISTS idx_quote_lists_project_id ON quote_lists(project_id);
CREATE INDEX IF NOT EXISTS idx_quote_lists_status ON quote_lists(status);
CREATE INDEX IF NOT EXISTS idx_quote_list_items_quote_list_id ON quote_list_items(quote_list_id);
CREATE INDEX IF NOT EXISTS idx_quote_invitations_provider_id ON quote_invitations(provider_id);
CREATE INDEX IF NOT EXISTS idx_quote_submissions_quote_list_id ON quote_submissions(quote_list_id);
CREATE INDEX IF NOT EXISTS idx_quote_submissions_provider_id ON quote_submissions(provider_id);
