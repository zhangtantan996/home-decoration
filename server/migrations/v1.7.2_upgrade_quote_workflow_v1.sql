CREATE TABLE IF NOT EXISTS quote_categories (
  id BIGSERIAL PRIMARY KEY,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  code VARCHAR(64) NOT NULL UNIQUE,
  name VARCHAR(100) NOT NULL,
  parent_id BIGINT NOT NULL DEFAULT 0,
  sort_order INTEGER NOT NULL DEFAULT 0,
  status SMALLINT NOT NULL DEFAULT 1
);

ALTER TABLE quote_library_items
  ADD COLUMN IF NOT EXISTS category_id BIGINT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS standard_code VARCHAR(100) NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS keywords_json TEXT NOT NULL DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS erp_mapping_json TEXT NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS source_meta_json TEXT NOT NULL DEFAULT '{}';

CREATE INDEX IF NOT EXISTS idx_quote_library_items_category_id ON quote_library_items(category_id);
CREATE INDEX IF NOT EXISTS idx_quote_library_items_standard_code ON quote_library_items(standard_code);

CREATE TABLE IF NOT EXISTS quote_price_books (
  id BIGSERIAL PRIMARY KEY,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  provider_id BIGINT NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'draft',
  version INTEGER NOT NULL DEFAULT 1,
  effective_from TIMESTAMPTZ NULL,
  effective_to TIMESTAMPTZ NULL,
  remark TEXT NOT NULL DEFAULT ''
);

CREATE TABLE IF NOT EXISTS quote_price_book_items (
  id BIGSERIAL PRIMARY KEY,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  price_book_id BIGINT NOT NULL,
  standard_item_id BIGINT NOT NULL,
  unit VARCHAR(20) NOT NULL DEFAULT '项',
  unit_price_cent BIGINT NOT NULL DEFAULT 0,
  min_charge_cent BIGINT NOT NULL DEFAULT 0,
  remark TEXT NOT NULL DEFAULT '',
  status SMALLINT NOT NULL DEFAULT 1,
  UNIQUE (price_book_id, standard_item_id)
);

CREATE INDEX IF NOT EXISTS idx_quote_price_books_provider_id ON quote_price_books(provider_id);
CREATE INDEX IF NOT EXISTS idx_quote_price_books_status ON quote_price_books(status);
CREATE INDEX IF NOT EXISTS idx_quote_price_book_items_price_book_id ON quote_price_book_items(price_book_id);

ALTER TABLE quote_lists
  ADD COLUMN IF NOT EXISTS proposal_id BIGINT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS proposal_version INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS designer_provider_id BIGINT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS prerequisite_snapshot_json TEXT NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS prerequisite_status VARCHAR(20) NOT NULL DEFAULT 'draft',
  ADD COLUMN IF NOT EXISTS user_confirmation_status VARCHAR(20) NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS active_submission_id BIGINT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS submitted_to_user_at TIMESTAMPTZ NULL,
  ADD COLUMN IF NOT EXISTS user_confirmed_at TIMESTAMPTZ NULL,
  ADD COLUMN IF NOT EXISTS rejected_at TIMESTAMPTZ NULL;

CREATE INDEX IF NOT EXISTS idx_quote_lists_proposal_id ON quote_lists(proposal_id);
CREATE INDEX IF NOT EXISTS idx_quote_lists_designer_provider_id ON quote_lists(designer_provider_id);
CREATE INDEX IF NOT EXISTS idx_quote_lists_prerequisite_status ON quote_lists(prerequisite_status);
CREATE INDEX IF NOT EXISTS idx_quote_lists_user_confirmation_status ON quote_lists(user_confirmation_status);
CREATE INDEX IF NOT EXISTS idx_quote_lists_active_submission_id ON quote_lists(active_submission_id);

ALTER TABLE quote_list_items
  ADD COLUMN IF NOT EXISTS matched_standard_item_id BIGINT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS source_type VARCHAR(20) NOT NULL DEFAULT 'standard',
  ADD COLUMN IF NOT EXISTS missing_mapping_flag BOOLEAN NOT NULL DEFAULT FALSE;

CREATE INDEX IF NOT EXISTS idx_quote_list_items_matched_standard_item_id ON quote_list_items(matched_standard_item_id);

ALTER TABLE quote_submissions
  ADD COLUMN IF NOT EXISTS task_status VARCHAR(20) NOT NULL DEFAULT 'draft',
  ADD COLUMN IF NOT EXISTS generation_status VARCHAR(30) NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS generated_from_price_book_id BIGINT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS submitted_to_user BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS locked_at TIMESTAMPTZ NULL,
  ADD COLUMN IF NOT EXISTS user_confirmed_at TIMESTAMPTZ NULL,
  ADD COLUMN IF NOT EXISTS superseded_by BIGINT NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_quote_submissions_task_status ON quote_submissions(task_status);
CREATE INDEX IF NOT EXISTS idx_quote_submissions_generation_status ON quote_submissions(generation_status);
CREATE INDEX IF NOT EXISTS idx_quote_submissions_generated_from_price_book_id ON quote_submissions(generated_from_price_book_id);
CREATE INDEX IF NOT EXISTS idx_quote_submissions_superseded_by ON quote_submissions(superseded_by);

ALTER TABLE quote_submission_items
  ADD COLUMN IF NOT EXISTS generated_unit_price_cent BIGINT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS adjusted_flag BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS missing_price_flag BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS missing_mapping_flag BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS min_charge_applied_flag BOOLEAN NOT NULL DEFAULT FALSE;
