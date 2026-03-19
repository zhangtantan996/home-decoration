-- v1.10.0 报价系统优化：三级分类 + 阶梯价 + 模板系统
-- Phase 1: 扩展 QuoteLibraryItem 字段
ALTER TABLE quote_library_items ADD COLUMN IF NOT EXISTS category_l3 VARCHAR(50) DEFAULT '';
ALTER TABLE quote_library_items ADD COLUMN IF NOT EXISTS erp_seq_no VARCHAR(20) DEFAULT '';
ALTER TABLE quote_library_items ADD COLUMN IF NOT EXISTS has_tiers BOOLEAN DEFAULT FALSE;
ALTER TABLE quote_library_items ADD COLUMN IF NOT EXISTS quantity_formula_json TEXT DEFAULT '';

CREATE INDEX IF NOT EXISTS idx_quote_library_items_category_l3 ON quote_library_items(category_l3);

-- Phase 2: QuotePriceTier 阶梯价档位表
CREATE TABLE IF NOT EXISTS quote_price_tiers (
    id BIGSERIAL PRIMARY KEY,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    library_item_id BIGINT NOT NULL DEFAULT 0,
    tier_key VARCHAR(100) NOT NULL DEFAULT '',
    tier_label VARCHAR(200) NOT NULL DEFAULT '',
    condition_json TEXT DEFAULT '',
    sort_order INT DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_quote_price_tiers_library_item ON quote_price_tiers(library_item_id);
CREATE INDEX IF NOT EXISTS idx_quote_price_tiers_tier_key ON quote_price_tiers(tier_key);

-- Phase 2: 扩展现有表增加 tier 关联
ALTER TABLE quote_price_book_items ADD COLUMN IF NOT EXISTS price_tier_id BIGINT DEFAULT 0;
ALTER TABLE quote_list_items ADD COLUMN IF NOT EXISTS selected_tier_id BIGINT DEFAULT 0;
ALTER TABLE quote_submission_items ADD COLUMN IF NOT EXISTS price_tier_id BIGINT DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_quote_price_book_items_tier ON quote_price_book_items(price_tier_id);
CREATE INDEX IF NOT EXISTS idx_quote_list_items_tier ON quote_list_items(selected_tier_id);
CREATE INDEX IF NOT EXISTS idx_quote_submission_items_tier ON quote_submission_items(price_tier_id);
