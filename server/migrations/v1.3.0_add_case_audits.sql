-- 创建作品审核/草稿表
CREATE TABLE IF NOT EXISTS case_audits (
    id BIGSERIAL PRIMARY KEY,
    case_id BIGINT DEFAULT NULL, -- 关联的主表ID，新增时为空
    provider_id BIGINT NOT NULL,
    action_type VARCHAR(20) NOT NULL, -- create, update, delete
    
    -- 作品数据快照 (与 provider_cases 结构一致)
    title VARCHAR(100),
    cover_image VARCHAR(500),
    style VARCHAR(50),
    area VARCHAR(20),
    year VARCHAR(10),
    description TEXT,
    images TEXT, -- JSON array
    sort_order INT DEFAULT 0,
    
    -- 审核状态
    status INT DEFAULT 0, -- 0:pending, 1:approved, 2:rejected
    reject_reason VARCHAR(500),
    audited_by BIGINT,
    audited_at TIMESTAMP WITH TIME ZONE,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_case_audits_provider ON case_audits(provider_id);
CREATE INDEX idx_case_audits_status ON case_audits(status);
CREATE INDEX idx_case_audits_case_id ON case_audits(case_id);
