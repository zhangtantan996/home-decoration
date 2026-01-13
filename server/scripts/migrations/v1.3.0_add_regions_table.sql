-- 创建行政区划表
CREATE TABLE IF NOT EXISTS regions (
    id BIGSERIAL PRIMARY KEY,
    code VARCHAR(6) UNIQUE NOT NULL,     -- 行政区划代码 (e.g., 610100, 610113)
    name VARCHAR(50) NOT NULL,            -- 名称 (e.g., 西安市, 雁塔区)
    level INT NOT NULL,                   -- 1:省, 2:市, 3:区/县
    parent_code VARCHAR(6),               -- 父级代码
    enabled BOOLEAN DEFAULT true,         -- 是否启用
    sort_order INT DEFAULT 0,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_regions_parent ON regions(parent_code);
CREATE INDEX IF NOT EXISTS idx_regions_level ON regions(level);
CREATE INDEX IF NOT EXISTS idx_regions_enabled ON regions(enabled);

-- 添加注释
COMMENT ON TABLE regions IS '行政区划表';
COMMENT ON COLUMN regions.code IS '国家标准6位行政区划代码';
COMMENT ON COLUMN regions.name IS '行政区划名称';
COMMENT ON COLUMN regions.level IS '1:省/直辖市, 2:市/地级市, 3:区/县';
COMMENT ON COLUMN regions.parent_code IS '父级行政区划代码';
