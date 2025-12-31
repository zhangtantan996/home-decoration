-- 为 provider_cases 表添加 price 和 layout 字段
ALTER TABLE provider_cases ADD COLUMN IF NOT EXISTS price DECIMAL(10, 2) DEFAULT 0; -- 总价(万)
ALTER TABLE provider_cases ADD COLUMN IF NOT EXISTS layout VARCHAR(50); -- 户型

-- 为 case_audits 表添加 price 和 layout 字段
ALTER TABLE case_audits ADD COLUMN IF NOT EXISTS price DECIMAL(10, 2) DEFAULT 0;
ALTER TABLE case_audits ADD COLUMN IF NOT EXISTS layout VARCHAR(50);
