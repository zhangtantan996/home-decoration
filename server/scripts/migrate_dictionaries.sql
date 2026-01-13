-- ============================================================
-- 数据字典系统 - 数据库迁移脚本
-- 项目：装修设计一体化平台
-- 版本：v1.0
-- 创建日期：2026-01-05
-- ============================================================

-- ============ Step 1: 创建表 ============

-- 1.1 字典分类表
CREATE TABLE IF NOT EXISTS dictionary_categories (
    id BIGSERIAL PRIMARY KEY,
    code VARCHAR(50) UNIQUE NOT NULL,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    sort_order INT DEFAULT 0,
    enabled BOOLEAN DEFAULT true,
    icon VARCHAR(50),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 1.2 字典值表
CREATE TABLE IF NOT EXISTS system_dictionaries (
    id BIGSERIAL PRIMARY KEY,
    category_code VARCHAR(50) NOT NULL,
    value VARCHAR(100) NOT NULL,
    label VARCHAR(100) NOT NULL,
    description TEXT,
    sort_order INT DEFAULT 0,
    enabled BOOLEAN DEFAULT true,
    extra_data JSONB,
    parent_value VARCHAR(100),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    -- 联合唯一约束
    CONSTRAINT uk_dict_category_value UNIQUE(category_code, value)
);

-- ============ Step 2: 创建索引 ============

-- 分类表索引
CREATE INDEX IF NOT EXISTS idx_dict_cat_enabled ON dictionary_categories(enabled);
CREATE INDEX IF NOT EXISTS idx_dict_cat_sort ON dictionary_categories(sort_order);

-- 字典值表索引
CREATE INDEX IF NOT EXISTS idx_dict_category ON system_dictionaries(category_code);
CREATE INDEX IF NOT EXISTS idx_dict_enabled ON system_dictionaries(enabled);
CREATE INDEX IF NOT EXISTS idx_dict_parent ON system_dictionaries(parent_value);
CREATE INDEX IF NOT EXISTS idx_dict_sort ON system_dictionaries(category_code, sort_order);

-- ============ Step 3: 创建外键约束 ============

ALTER TABLE system_dictionaries
DROP CONSTRAINT IF EXISTS fk_dict_category;

ALTER TABLE system_dictionaries
ADD CONSTRAINT fk_dict_category
FOREIGN KEY (category_code)
REFERENCES dictionary_categories(code)
ON DELETE CASCADE
ON UPDATE CASCADE;

-- ============ Step 4: 添加数据约束 ============

-- value 不能为空
ALTER TABLE system_dictionaries
DROP CONSTRAINT IF EXISTS chk_dict_value_not_empty;

ALTER TABLE system_dictionaries
ADD CONSTRAINT chk_dict_value_not_empty
CHECK (LENGTH(TRIM(value)) > 0);

-- label 不能为空
ALTER TABLE system_dictionaries
DROP CONSTRAINT IF EXISTS chk_dict_label_not_empty;

ALTER TABLE system_dictionaries
ADD CONSTRAINT chk_dict_label_not_empty
CHECK (LENGTH(TRIM(label)) > 0);

-- sort_order 必须为非负数
ALTER TABLE system_dictionaries
DROP CONSTRAINT IF EXISTS chk_dict_sort_order;

ALTER TABLE system_dictionaries
ADD CONSTRAINT chk_dict_sort_order
CHECK (sort_order >= 0);

ALTER TABLE dictionary_categories
DROP CONSTRAINT IF EXISTS chk_dict_cat_sort_order;

ALTER TABLE dictionary_categories
ADD CONSTRAINT chk_dict_cat_sort_order
CHECK (sort_order >= 0);

-- ============ Step 5: 添加注释 ============

COMMENT ON TABLE dictionary_categories IS '数据字典分类表';
COMMENT ON COLUMN dictionary_categories.code IS '分类唯一标识，用于API查询';
COMMENT ON COLUMN dictionary_categories.name IS '分类显示名称';
COMMENT ON COLUMN dictionary_categories.enabled IS '软删除标记，false时不返回给前端';

COMMENT ON TABLE system_dictionaries IS '数据字典值表';
COMMENT ON COLUMN system_dictionaries.category_code IS '所属分类代码';
COMMENT ON COLUMN system_dictionaries.value IS '实际存储值，保持向后兼容';
COMMENT ON COLUMN system_dictionaries.label IS '前端显示文本';
COMMENT ON COLUMN system_dictionaries.extra_data IS '扩展字段，存储额外属性（JSONB格式）';
COMMENT ON COLUMN system_dictionaries.parent_value IS '父级值，支持多级字典';

-- ============ 完成 ============

\echo '✅ 数据字典表结构创建成功！'
