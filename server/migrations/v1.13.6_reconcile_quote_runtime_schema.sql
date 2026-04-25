-- v1.13.6: 补齐施工报价准备 / 工长报价复核在历史库上的 quote runtime schema 缺口
-- 目标：
-- 1) 修复 quote_lists 缺少 quantity_base_id 等字段导致施工报价准备创建失败
-- 2) 补齐 quantity_bases / quantity_base_items 与模板化报价所需 quote_* 表
-- 3) 补齐工长草稿生成 / 复核 / 修订所需字段，避免后续链路继续因缺列报错

-- ============================================
-- 1. 设计师施工基线
-- ============================================
CREATE TABLE IF NOT EXISTS quantity_bases (
    id BIGSERIAL PRIMARY KEY,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    proposal_id BIGINT NOT NULL DEFAULT 0,
    proposal_version INTEGER NOT NULL DEFAULT 1,
    owner_user_id BIGINT NOT NULL DEFAULT 0,
    designer_provider_id BIGINT NOT NULL DEFAULT 0,
    source_type VARCHAR(40) NOT NULL DEFAULT 'proposal',
    source_id BIGINT NOT NULL DEFAULT 0,
    status VARCHAR(20) NOT NULL DEFAULT 'draft',
    version INTEGER NOT NULL DEFAULT 1,
    title VARCHAR(200) NOT NULL DEFAULT '',
    snapshot_json TEXT NOT NULL DEFAULT '',
    activated_at TIMESTAMPTZ NULL
);

CREATE INDEX IF NOT EXISTS idx_quantity_bases_proposal_id ON quantity_bases(proposal_id);
CREATE INDEX IF NOT EXISTS idx_quantity_bases_designer_provider_id ON quantity_bases(designer_provider_id);
CREATE INDEX IF NOT EXISTS idx_quantity_bases_source_type ON quantity_bases(source_type);
CREATE INDEX IF NOT EXISTS idx_quantity_bases_source_id ON quantity_bases(source_id);
CREATE INDEX IF NOT EXISTS idx_quantity_bases_status ON quantity_bases(status);

CREATE TABLE IF NOT EXISTS quantity_base_items (
    id BIGSERIAL PRIMARY KEY,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    quantity_base_id BIGINT NOT NULL DEFAULT 0,
    standard_item_id BIGINT NOT NULL DEFAULT 0,
    source_line_no INTEGER NOT NULL DEFAULT 0,
    source_item_code VARCHAR(100) NOT NULL DEFAULT '',
    source_item_name VARCHAR(255) NOT NULL DEFAULT '',
    unit VARCHAR(20) NOT NULL DEFAULT '项',
    quantity DOUBLE PRECISION NOT NULL DEFAULT 0,
    baseline_note TEXT NOT NULL DEFAULT '',
    category_l1 VARCHAR(50) NOT NULL DEFAULT '',
    category_l2 VARCHAR(50) NOT NULL DEFAULT '',
    sort_order INTEGER NOT NULL DEFAULT 0,
    extensions_json TEXT NOT NULL DEFAULT ''
);

CREATE INDEX IF NOT EXISTS idx_quantity_base_items_quantity_base_id ON quantity_base_items(quantity_base_id);
CREATE INDEX IF NOT EXISTS idx_quantity_base_items_standard_item_id ON quantity_base_items(standard_item_id);
CREATE INDEX IF NOT EXISTS idx_quantity_base_items_source_item_code ON quantity_base_items(source_item_code);
CREATE INDEX IF NOT EXISTS idx_quantity_base_items_category_l1 ON quantity_base_items(category_l1);
CREATE INDEX IF NOT EXISTS idx_quantity_base_items_category_l2 ON quantity_base_items(category_l2);

-- ============================================
-- 2. 报价标准项 / 分类 / 模板
-- ============================================
CREATE TABLE IF NOT EXISTS quote_categories (
    id BIGSERIAL PRIMARY KEY,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    code VARCHAR(64) NOT NULL DEFAULT '',
    name VARCHAR(100) NOT NULL DEFAULT '',
    parent_id BIGINT NOT NULL DEFAULT 0,
    sort_order INTEGER NOT NULL DEFAULT 0,
    status SMALLINT NOT NULL DEFAULT 1
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_quote_categories_code ON quote_categories(code);
CREATE INDEX IF NOT EXISTS idx_quote_categories_parent_id ON quote_categories(parent_id);
CREATE INDEX IF NOT EXISTS idx_quote_categories_status ON quote_categories(status);

CREATE TABLE IF NOT EXISTS quote_library_items (
    id BIGSERIAL PRIMARY KEY,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    category_id BIGINT NOT NULL DEFAULT 0,
    erp_item_code VARCHAR(100) NOT NULL DEFAULT '',
    standard_code VARCHAR(100) NOT NULL DEFAULT '',
    name VARCHAR(255) NOT NULL DEFAULT '',
    unit VARCHAR(20) NOT NULL DEFAULT '项',
    category_l1 VARCHAR(50) NOT NULL DEFAULT '',
    category_l2 VARCHAR(50) NOT NULL DEFAULT '',
    category_l3 VARCHAR(50) NOT NULL DEFAULT '',
    erp_seq_no VARCHAR(20) NOT NULL DEFAULT '',
    reference_price_cent BIGINT NOT NULL DEFAULT 0,
    pricing_note TEXT NOT NULL DEFAULT '',
    has_tiers BOOLEAN NOT NULL DEFAULT FALSE,
    quantity_formula_json TEXT NOT NULL DEFAULT '{}',
    status SMALLINT NOT NULL DEFAULT 1,
    keywords_json TEXT NOT NULL DEFAULT '[]',
    erp_mapping_json TEXT NOT NULL DEFAULT '{}',
    source_meta_json TEXT NOT NULL DEFAULT '{}',
    source_fingerprint VARCHAR(64) NOT NULL DEFAULT '',
    extensions_json TEXT NOT NULL DEFAULT ''
);

ALTER TABLE quote_library_items
    ADD COLUMN IF NOT EXISTS category_id BIGINT NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS standard_code VARCHAR(100) NOT NULL DEFAULT '',
    ADD COLUMN IF NOT EXISTS category_l3 VARCHAR(50) NOT NULL DEFAULT '',
    ADD COLUMN IF NOT EXISTS erp_seq_no VARCHAR(20) NOT NULL DEFAULT '',
    ADD COLUMN IF NOT EXISTS has_tiers BOOLEAN NOT NULL DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS quantity_formula_json TEXT NOT NULL DEFAULT '{}',
    ADD COLUMN IF NOT EXISTS keywords_json TEXT NOT NULL DEFAULT '[]',
    ADD COLUMN IF NOT EXISTS erp_mapping_json TEXT NOT NULL DEFAULT '{}',
    ADD COLUMN IF NOT EXISTS source_meta_json TEXT NOT NULL DEFAULT '{}';

CREATE UNIQUE INDEX IF NOT EXISTS idx_quote_library_items_erp_item_code ON quote_library_items(erp_item_code);
CREATE INDEX IF NOT EXISTS idx_quote_library_items_category_id ON quote_library_items(category_id);
CREATE INDEX IF NOT EXISTS idx_quote_library_items_standard_code ON quote_library_items(standard_code);
CREATE INDEX IF NOT EXISTS idx_quote_library_items_category_l1 ON quote_library_items(category_l1);
CREATE INDEX IF NOT EXISTS idx_quote_library_items_category_l2 ON quote_library_items(category_l2);
CREATE INDEX IF NOT EXISTS idx_quote_library_items_category_l3 ON quote_library_items(category_l3);

CREATE TABLE IF NOT EXISTS quote_price_books (
    id BIGSERIAL PRIMARY KEY,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    provider_id BIGINT NOT NULL DEFAULT 0,
    status VARCHAR(20) NOT NULL DEFAULT 'draft',
    version INTEGER NOT NULL DEFAULT 1,
    effective_from TIMESTAMPTZ NULL,
    effective_to TIMESTAMPTZ NULL,
    remark TEXT NOT NULL DEFAULT ''
);

CREATE INDEX IF NOT EXISTS idx_quote_price_books_provider_id ON quote_price_books(provider_id);
CREATE INDEX IF NOT EXISTS idx_quote_price_books_status ON quote_price_books(status);

CREATE TABLE IF NOT EXISTS quote_price_tiers (
    id BIGSERIAL PRIMARY KEY,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    library_item_id BIGINT NOT NULL DEFAULT 0,
    tier_key VARCHAR(100) NOT NULL DEFAULT '',
    tier_label VARCHAR(200) NOT NULL DEFAULT '',
    condition_json TEXT NOT NULL DEFAULT '',
    sort_order INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_quote_price_tiers_library_item ON quote_price_tiers(library_item_id);
CREATE INDEX IF NOT EXISTS idx_quote_price_tiers_tier_key ON quote_price_tiers(tier_key);

CREATE TABLE IF NOT EXISTS quote_price_book_items (
    id BIGSERIAL PRIMARY KEY,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    price_book_id BIGINT NOT NULL DEFAULT 0,
    standard_item_id BIGINT NOT NULL DEFAULT 0,
    price_tier_id BIGINT NOT NULL DEFAULT 0,
    unit VARCHAR(20) NOT NULL DEFAULT '项',
    unit_price_cent BIGINT NOT NULL DEFAULT 0,
    min_charge_cent BIGINT NOT NULL DEFAULT 0,
    remark TEXT NOT NULL DEFAULT '',
    status SMALLINT NOT NULL DEFAULT 1
);

ALTER TABLE quote_price_book_items
    ADD COLUMN IF NOT EXISTS price_tier_id BIGINT NOT NULL DEFAULT 0;

CREATE UNIQUE INDEX IF NOT EXISTS idx_quote_price_book_item ON quote_price_book_items(price_book_id, standard_item_id);
CREATE INDEX IF NOT EXISTS idx_quote_price_book_items_price_book_id ON quote_price_book_items(price_book_id);
CREATE INDEX IF NOT EXISTS idx_quote_price_book_items_tier ON quote_price_book_items(price_tier_id);

CREATE TABLE IF NOT EXISTS quote_category_rules (
    id BIGSERIAL PRIMARY KEY,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    category_id BIGINT NOT NULL DEFAULT 0,
    keywords TEXT NOT NULL DEFAULT '',
    priority INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_quote_category_rules_category ON quote_category_rules(category_id);
CREATE INDEX IF NOT EXISTS idx_quote_category_rules_priority ON quote_category_rules(priority);

CREATE TABLE IF NOT EXISTS quote_templates (
    id BIGSERIAL PRIMARY KEY,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    name VARCHAR(200) NOT NULL DEFAULT '',
    room_type VARCHAR(50) NOT NULL DEFAULT '',
    renovation_type VARCHAR(50) NOT NULL DEFAULT '',
    description TEXT NOT NULL DEFAULT '',
    status SMALLINT NOT NULL DEFAULT 1
);

CREATE INDEX IF NOT EXISTS idx_quote_templates_name ON quote_templates(name);
CREATE INDEX IF NOT EXISTS idx_quote_templates_room_type ON quote_templates(room_type);
CREATE INDEX IF NOT EXISTS idx_quote_templates_status ON quote_templates(status);

CREATE TABLE IF NOT EXISTS quote_template_items (
    id BIGSERIAL PRIMARY KEY,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    template_id BIGINT NOT NULL DEFAULT 0,
    library_item_id BIGINT NOT NULL DEFAULT 0,
    default_quantity DOUBLE PRECISION NOT NULL DEFAULT 0,
    sort_order INTEGER NOT NULL DEFAULT 0,
    required BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE INDEX IF NOT EXISTS idx_quote_template_items_template ON quote_template_items(template_id);
CREATE INDEX IF NOT EXISTS idx_quote_template_items_library ON quote_template_items(library_item_id);

-- ============================================
-- 3. 报价任务 / 工长草稿 / 修订
-- ============================================
CREATE TABLE IF NOT EXISTS quote_lists (
    id BIGSERIAL PRIMARY KEY,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    project_id BIGINT NOT NULL DEFAULT 0,
    proposal_id BIGINT NOT NULL DEFAULT 0,
    proposal_version INTEGER NOT NULL DEFAULT 1,
    quantity_base_id BIGINT NOT NULL DEFAULT 0,
    quantity_base_version INTEGER NOT NULL DEFAULT 0,
    source_type VARCHAR(40) NOT NULL DEFAULT 'proposal',
    source_id BIGINT NOT NULL DEFAULT 0,
    designer_provider_id BIGINT NOT NULL DEFAULT 0,
    customer_id BIGINT NOT NULL DEFAULT 0,
    house_id BIGINT NOT NULL DEFAULT 0,
    owner_user_id BIGINT NOT NULL DEFAULT 0,
    scenario_type VARCHAR(50) NOT NULL DEFAULT '',
    title VARCHAR(200) NOT NULL DEFAULT '',
    status VARCHAR(20) NOT NULL DEFAULT 'draft',
    currency VARCHAR(10) NOT NULL DEFAULT 'CNY',
    pricing_mode VARCHAR(30) NOT NULL DEFAULT 'half_package',
    material_included BOOLEAN NOT NULL DEFAULT FALSE,
    payment_plan_generated_flag BOOLEAN NOT NULL DEFAULT FALSE,
    deadline_at TIMESTAMPTZ NULL,
    prerequisite_snapshot_json TEXT NOT NULL DEFAULT '{}',
    prerequisite_status VARCHAR(20) NOT NULL DEFAULT 'draft',
    user_confirmation_status VARCHAR(20) NOT NULL DEFAULT 'pending',
    active_submission_id BIGINT NOT NULL DEFAULT 0,
    awarded_provider_id BIGINT NOT NULL DEFAULT 0,
    awarded_quote_submission_id BIGINT NOT NULL DEFAULT 0,
    submitted_to_user_at TIMESTAMPTZ NULL,
    user_confirmed_at TIMESTAMPTZ NULL,
    rejected_at TIMESTAMPTZ NULL,
    extensions_json TEXT NOT NULL DEFAULT ''
);

ALTER TABLE quote_lists
    ADD COLUMN IF NOT EXISTS proposal_id BIGINT NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS proposal_version INTEGER NOT NULL DEFAULT 1,
    ADD COLUMN IF NOT EXISTS quantity_base_id BIGINT NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS quantity_base_version INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS source_type VARCHAR(40) NOT NULL DEFAULT 'proposal',
    ADD COLUMN IF NOT EXISTS source_id BIGINT NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS designer_provider_id BIGINT NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS pricing_mode VARCHAR(30) NOT NULL DEFAULT 'half_package',
    ADD COLUMN IF NOT EXISTS material_included BOOLEAN NOT NULL DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS payment_plan_generated_flag BOOLEAN NOT NULL DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS prerequisite_snapshot_json TEXT NOT NULL DEFAULT '{}',
    ADD COLUMN IF NOT EXISTS prerequisite_status VARCHAR(20) NOT NULL DEFAULT 'draft',
    ADD COLUMN IF NOT EXISTS user_confirmation_status VARCHAR(20) NOT NULL DEFAULT 'pending',
    ADD COLUMN IF NOT EXISTS active_submission_id BIGINT NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS submitted_to_user_at TIMESTAMPTZ NULL,
    ADD COLUMN IF NOT EXISTS user_confirmed_at TIMESTAMPTZ NULL,
    ADD COLUMN IF NOT EXISTS rejected_at TIMESTAMPTZ NULL;

CREATE INDEX IF NOT EXISTS idx_quote_lists_project_id ON quote_lists(project_id);
CREATE INDEX IF NOT EXISTS idx_quote_lists_proposal_id ON quote_lists(proposal_id);
CREATE INDEX IF NOT EXISTS idx_quote_lists_quantity_base_id ON quote_lists(quantity_base_id);
CREATE INDEX IF NOT EXISTS idx_quote_lists_status ON quote_lists(status);
CREATE INDEX IF NOT EXISTS idx_quote_lists_prerequisite_status ON quote_lists(prerequisite_status);
CREATE INDEX IF NOT EXISTS idx_quote_lists_user_confirmation_status ON quote_lists(user_confirmation_status);
CREATE INDEX IF NOT EXISTS idx_quote_lists_active_submission_id ON quote_lists(active_submission_id);

CREATE TABLE IF NOT EXISTS quote_list_items (
    id BIGSERIAL PRIMARY KEY,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    quote_list_id BIGINT NOT NULL DEFAULT 0,
    standard_item_id BIGINT NOT NULL DEFAULT 0,
    matched_standard_item_id BIGINT NOT NULL DEFAULT 0,
    quantity_base_item_id BIGINT NOT NULL DEFAULT 0,
    selected_tier_id BIGINT NOT NULL DEFAULT 0,
    line_no INTEGER NOT NULL DEFAULT 0,
    source_type VARCHAR(20) NOT NULL DEFAULT 'standard',
    source_stage VARCHAR(40) NOT NULL DEFAULT '',
    name VARCHAR(255) NOT NULL DEFAULT '',
    unit VARCHAR(20) NOT NULL DEFAULT '项',
    quantity DOUBLE PRECISION NOT NULL DEFAULT 0,
    quantity_adjustable_flag BOOLEAN NOT NULL DEFAULT TRUE,
    pricing_note TEXT NOT NULL DEFAULT '',
    category_l1 VARCHAR(50) NOT NULL DEFAULT '',
    category_l2 VARCHAR(50) NOT NULL DEFAULT '',
    sort_order INTEGER NOT NULL DEFAULT 0,
    missing_mapping_flag BOOLEAN NOT NULL DEFAULT FALSE,
    extensions_json TEXT NOT NULL DEFAULT ''
);

ALTER TABLE quote_list_items
    ADD COLUMN IF NOT EXISTS matched_standard_item_id BIGINT NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS quantity_base_item_id BIGINT NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS selected_tier_id BIGINT NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS source_type VARCHAR(20) NOT NULL DEFAULT 'standard',
    ADD COLUMN IF NOT EXISTS source_stage VARCHAR(40) NOT NULL DEFAULT '',
    ADD COLUMN IF NOT EXISTS quantity_adjustable_flag BOOLEAN NOT NULL DEFAULT TRUE,
    ADD COLUMN IF NOT EXISTS missing_mapping_flag BOOLEAN NOT NULL DEFAULT FALSE;

CREATE INDEX IF NOT EXISTS idx_quote_list_items_quote_list_id ON quote_list_items(quote_list_id);
CREATE INDEX IF NOT EXISTS idx_quote_list_items_standard_item_id ON quote_list_items(standard_item_id);
CREATE INDEX IF NOT EXISTS idx_quote_list_items_matched_standard_item_id ON quote_list_items(matched_standard_item_id);
CREATE INDEX IF NOT EXISTS idx_quote_list_items_quantity_base_item_id ON quote_list_items(quantity_base_item_id);
CREATE INDEX IF NOT EXISTS idx_quote_list_items_tier ON quote_list_items(selected_tier_id);

CREATE TABLE IF NOT EXISTS quote_invitations (
    id BIGSERIAL PRIMARY KEY,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    quote_list_id BIGINT NOT NULL DEFAULT 0,
    provider_id BIGINT NOT NULL DEFAULT 0,
    status VARCHAR(20) NOT NULL DEFAULT 'invited',
    invited_by_user_id BIGINT NOT NULL DEFAULT 0,
    invited_at TIMESTAMPTZ NULL,
    responded_at TIMESTAMPTZ NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_quote_invitation_list_provider ON quote_invitations(quote_list_id, provider_id);
CREATE INDEX IF NOT EXISTS idx_quote_invitations_provider_id ON quote_invitations(provider_id);

CREATE TABLE IF NOT EXISTS quote_submissions (
    id BIGSERIAL PRIMARY KEY,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    quote_list_id BIGINT NOT NULL DEFAULT 0,
    provider_id BIGINT NOT NULL DEFAULT 0,
    provider_type SMALLINT NOT NULL DEFAULT 0,
    provider_sub_type VARCHAR(20) NOT NULL DEFAULT '',
    status VARCHAR(20) NOT NULL DEFAULT 'draft',
    task_status VARCHAR(20) NOT NULL DEFAULT 'draft',
    generation_status VARCHAR(30) NOT NULL DEFAULT 'pending',
    currency VARCHAR(10) NOT NULL DEFAULT 'CNY',
    generated_from_price_book_id BIGINT NOT NULL DEFAULT 0,
    total_cent BIGINT NOT NULL DEFAULT 0,
    estimated_days INTEGER NOT NULL DEFAULT 0,
    remark TEXT NOT NULL DEFAULT '',
    attachments_json TEXT NOT NULL DEFAULT '',
    team_size INTEGER NOT NULL DEFAULT 0,
    work_types TEXT NOT NULL DEFAULT '',
    construction_method_note TEXT NOT NULL DEFAULT '',
    site_visit_required BOOLEAN NOT NULL DEFAULT FALSE,
    submitted_to_user BOOLEAN NOT NULL DEFAULT FALSE,
    review_status VARCHAR(20) NOT NULL DEFAULT 'not_required',
    reviewed_by BIGINT NOT NULL DEFAULT 0,
    reviewed_at TIMESTAMPTZ NULL,
    review_reason TEXT NOT NULL DEFAULT '',
    locked_at TIMESTAMPTZ NULL,
    user_confirmed_at TIMESTAMPTZ NULL,
    superseded_by BIGINT NOT NULL DEFAULT 0
);

ALTER TABLE quote_submissions
    ADD COLUMN IF NOT EXISTS task_status VARCHAR(20) NOT NULL DEFAULT 'draft',
    ADD COLUMN IF NOT EXISTS generation_status VARCHAR(30) NOT NULL DEFAULT 'pending',
    ADD COLUMN IF NOT EXISTS generated_from_price_book_id BIGINT NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS submitted_to_user BOOLEAN NOT NULL DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS review_status VARCHAR(20) NOT NULL DEFAULT 'not_required',
    ADD COLUMN IF NOT EXISTS reviewed_by BIGINT NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS reviewed_at TIMESTAMPTZ NULL,
    ADD COLUMN IF NOT EXISTS review_reason TEXT NOT NULL DEFAULT '',
    ADD COLUMN IF NOT EXISTS locked_at TIMESTAMPTZ NULL,
    ADD COLUMN IF NOT EXISTS user_confirmed_at TIMESTAMPTZ NULL,
    ADD COLUMN IF NOT EXISTS superseded_by BIGINT NOT NULL DEFAULT 0;

CREATE UNIQUE INDEX IF NOT EXISTS idx_quote_submission_list_provider ON quote_submissions(quote_list_id, provider_id);
CREATE INDEX IF NOT EXISTS idx_quote_submissions_quote_list_id ON quote_submissions(quote_list_id);
CREATE INDEX IF NOT EXISTS idx_quote_submissions_provider_id ON quote_submissions(provider_id);
CREATE INDEX IF NOT EXISTS idx_quote_submissions_task_status ON quote_submissions(task_status);
CREATE INDEX IF NOT EXISTS idx_quote_submissions_generation_status ON quote_submissions(generation_status);
CREATE INDEX IF NOT EXISTS idx_quote_submissions_generated_from_price_book_id ON quote_submissions(generated_from_price_book_id);
CREATE INDEX IF NOT EXISTS idx_quote_submissions_superseded_by ON quote_submissions(superseded_by);

CREATE TABLE IF NOT EXISTS quote_submission_items (
    id BIGSERIAL PRIMARY KEY,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    quote_submission_id BIGINT NOT NULL DEFAULT 0,
    quote_list_item_id BIGINT NOT NULL DEFAULT 0,
    price_tier_id BIGINT NOT NULL DEFAULT 0,
    generated_unit_price_cent BIGINT NOT NULL DEFAULT 0,
    unit_price_cent BIGINT NOT NULL DEFAULT 0,
    quoted_quantity DOUBLE PRECISION NOT NULL DEFAULT 0,
    amount_cent BIGINT NOT NULL DEFAULT 0,
    adjusted_flag BOOLEAN NOT NULL DEFAULT FALSE,
    missing_price_flag BOOLEAN NOT NULL DEFAULT FALSE,
    missing_mapping_flag BOOLEAN NOT NULL DEFAULT FALSE,
    min_charge_applied_flag BOOLEAN NOT NULL DEFAULT FALSE,
    quantity_change_reason TEXT NOT NULL DEFAULT '',
    deviation_flag BOOLEAN NOT NULL DEFAULT FALSE,
    requires_user_confirmation BOOLEAN NOT NULL DEFAULT FALSE,
    platform_review_flag BOOLEAN NOT NULL DEFAULT FALSE,
    remark TEXT NOT NULL DEFAULT ''
);

ALTER TABLE quote_submission_items
    ADD COLUMN IF NOT EXISTS price_tier_id BIGINT NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS generated_unit_price_cent BIGINT NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS quoted_quantity DOUBLE PRECISION NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS adjusted_flag BOOLEAN NOT NULL DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS missing_price_flag BOOLEAN NOT NULL DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS missing_mapping_flag BOOLEAN NOT NULL DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS min_charge_applied_flag BOOLEAN NOT NULL DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS quantity_change_reason TEXT NOT NULL DEFAULT '',
    ADD COLUMN IF NOT EXISTS deviation_flag BOOLEAN NOT NULL DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS requires_user_confirmation BOOLEAN NOT NULL DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS platform_review_flag BOOLEAN NOT NULL DEFAULT FALSE;

CREATE UNIQUE INDEX IF NOT EXISTS idx_quote_submission_item ON quote_submission_items(quote_submission_id, quote_list_item_id);
CREATE INDEX IF NOT EXISTS idx_quote_submission_items_tier ON quote_submission_items(price_tier_id);

CREATE TABLE IF NOT EXISTS quote_submission_revisions (
    id BIGSERIAL PRIMARY KEY,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    quote_submission_id BIGINT NOT NULL DEFAULT 0,
    quote_list_id BIGINT NOT NULL DEFAULT 0,
    provider_id BIGINT NOT NULL DEFAULT 0,
    revision_no INTEGER NOT NULL DEFAULT 0,
    action VARCHAR(30) NOT NULL DEFAULT '',
    previous_status VARCHAR(30) NOT NULL DEFAULT '',
    next_status VARCHAR(30) NOT NULL DEFAULT '',
    previous_total_cent BIGINT NOT NULL DEFAULT 0,
    next_total_cent BIGINT NOT NULL DEFAULT 0,
    previous_items_json TEXT NOT NULL DEFAULT '[]',
    next_items_json TEXT NOT NULL DEFAULT '[]',
    change_reason TEXT NOT NULL DEFAULT ''
);

CREATE INDEX IF NOT EXISTS idx_quote_submission_revisions_submission_id ON quote_submission_revisions(quote_submission_id);
CREATE INDEX IF NOT EXISTS idx_quote_submission_revisions_quote_list_id ON quote_submission_revisions(quote_list_id);
CREATE INDEX IF NOT EXISTS idx_quote_submission_revisions_provider_id ON quote_submission_revisions(provider_id);
CREATE INDEX IF NOT EXISTS idx_quote_submission_revisions_revision_no ON quote_submission_revisions(quote_submission_id, revision_no);
