BEGIN;

-- 智能报价询价记录表
CREATE TABLE IF NOT EXISTS quote_inquiries (
    id BIGSERIAL PRIMARY KEY,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW(),

    -- 用户信息
    user_id BIGINT,
    open_id VARCHAR(128),
    phone VARCHAR(20),
    phone_encrypted TEXT,

    -- 房屋信息
    address VARCHAR(200),
    address_encrypted TEXT,
    city_code VARCHAR(20),
    area DECIMAL(10,2),
    house_layout VARCHAR(50),

    -- 装修需求
    renovation_type VARCHAR(50),
    style VARCHAR(50),
    budget_range VARCHAR(50),
    budget_min DECIMAL(12,2),
    budget_max DECIMAL(12,2),

    -- 报价结果
    quote_result_json TEXT,
    total_min DECIMAL(12,2),
    total_max DECIMAL(12,2),
    design_fee_min DECIMAL(12,2),
    design_fee_max DECIMAL(12,2),
    construction_fee_min DECIMAL(12,2),
    construction_fee_max DECIMAL(12,2),
    material_fee_min DECIMAL(12,2),
    material_fee_max DECIMAL(12,2),
    estimated_duration_days INTEGER,

    -- 转化追踪
    conversion_status VARCHAR(20) DEFAULT 'pending',
    converted_to_booking_id BIGINT,
    converted_at TIMESTAMP,

    -- 来源追踪
    source VARCHAR(50) DEFAULT 'mini_program'
);

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_quote_inquiries_user_id ON quote_inquiries(user_id);
CREATE INDEX IF NOT EXISTS idx_quote_inquiries_open_id ON quote_inquiries(open_id);
CREATE INDEX IF NOT EXISTS idx_quote_inquiries_city_code ON quote_inquiries(city_code);
CREATE INDEX IF NOT EXISTS idx_quote_inquiries_conversion_status ON quote_inquiries(conversion_status);
CREATE INDEX IF NOT EXISTS idx_quote_inquiries_created_at ON quote_inquiries(created_at);

COMMIT;
