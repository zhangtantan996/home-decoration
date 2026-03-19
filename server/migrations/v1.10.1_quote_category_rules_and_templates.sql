-- v1.10.1 报价分类规则 + 报价模板系统

-- 分类规则表
CREATE TABLE IF NOT EXISTS quote_category_rules (
    id BIGSERIAL PRIMARY KEY,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    category_id BIGINT NOT NULL DEFAULT 0,
    keywords TEXT DEFAULT '[]',
    priority INT DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_quote_category_rules_category ON quote_category_rules(category_id);
CREATE INDEX IF NOT EXISTS idx_quote_category_rules_priority ON quote_category_rules(priority);

-- 报价模板表
CREATE TABLE IF NOT EXISTS quote_templates (
    id BIGSERIAL PRIMARY KEY,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    name VARCHAR(200) NOT NULL DEFAULT '',
    room_type VARCHAR(50) DEFAULT '',
    renovation_type VARCHAR(50) DEFAULT '',
    description TEXT DEFAULT '',
    status SMALLINT DEFAULT 1
);

CREATE INDEX IF NOT EXISTS idx_quote_templates_name ON quote_templates(name);
CREATE INDEX IF NOT EXISTS idx_quote_templates_room_type ON quote_templates(room_type);
CREATE INDEX IF NOT EXISTS idx_quote_templates_status ON quote_templates(status);

-- 报价模板明细表
CREATE TABLE IF NOT EXISTS quote_template_items (
    id BIGSERIAL PRIMARY KEY,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    template_id BIGINT NOT NULL DEFAULT 0,
    library_item_id BIGINT NOT NULL DEFAULT 0,
    default_quantity DOUBLE PRECISION DEFAULT 0,
    sort_order INT DEFAULT 0,
    required BOOLEAN DEFAULT TRUE
);

CREATE INDEX IF NOT EXISTS idx_quote_template_items_template ON quote_template_items(template_id);
CREATE INDEX IF NOT EXISTS idx_quote_template_items_library ON quote_template_items(library_item_id);
