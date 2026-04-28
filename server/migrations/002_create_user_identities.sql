-- 多身份切换系统 - 数据库表创建
-- 创建日期: 2026-01-26
-- 说明: 支持一个用户拥有多个身份（业主、设计师、工长、公司、主材商）

-- 用户身份表
CREATE TABLE IF NOT EXISTS user_identities (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  identity_type VARCHAR(32) NOT NULL,  -- 'owner', 'designer', 'worker', 'company', 'supplier'
  identity_ref_id BIGINT NULL,         -- 关联 providers.id 或 workers.id
  status SMALLINT NOT NULL DEFAULT 0,  -- 0=pending, 1=approved, 2=rejected, 3=suspended
  verified BOOLEAN NOT NULL DEFAULT FALSE,
  verified_at TIMESTAMPTZ NULL,
  verified_by BIGINT NULL REFERENCES sys_admins(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_user_identity_type UNIQUE(user_id, identity_type)
);

CREATE INDEX IF NOT EXISTS idx_user_identities_user_id ON user_identities(user_id);
CREATE INDEX IF NOT EXISTS idx_user_identities_status ON user_identities(status);
CREATE INDEX IF NOT EXISTS idx_user_identities_type ON user_identities(identity_type);

COMMENT ON TABLE user_identities IS '用户身份表 - 支持多身份';
COMMENT ON COLUMN user_identities.identity_type IS '身份类型: owner(业主), designer(设计师), worker(工人), company(公司), supplier(主材商)';
COMMENT ON COLUMN user_identities.identity_ref_id IS '关联ID: provider.id 或 worker.id';
COMMENT ON COLUMN user_identities.status IS '状态: 0=待审核, 1=已批准, 2=已拒绝, 3=已暂停';

-- 身份申请表
CREATE TABLE IF NOT EXISTS identity_applications (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  identity_type VARCHAR(32) NOT NULL,
  application_data JSONB NOT NULL,  -- 申请材料（营业执照、身份证等）
  status SMALLINT NOT NULL DEFAULT 0,  -- 0=pending, 1=approved, 2=rejected
  reject_reason TEXT NULL,
  applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  reviewed_at TIMESTAMPTZ NULL,
  reviewed_by BIGINT NULL REFERENCES sys_admins(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_identity_applications_user_id ON identity_applications(user_id);
CREATE INDEX IF NOT EXISTS idx_identity_applications_status ON identity_applications(status);
CREATE INDEX IF NOT EXISTS idx_identity_applications_applied_at ON identity_applications(applied_at);

COMMENT ON TABLE identity_applications IS '身份申请表 - 记录用户申请新身份的流程';
COMMENT ON COLUMN identity_applications.application_data IS 'JSONB格式存储申请材料';

-- 身份审计日志表
CREATE TABLE IF NOT EXISTS identity_audit_logs (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  action VARCHAR(64) NOT NULL,  -- 'switch', 'apply', 'approve', 'reject', 'suspend'
  from_identity VARCHAR(32) NULL,
  to_identity VARCHAR(32) NULL,
  ip_address VARCHAR(50) NULL,
  user_agent TEXT NULL,
  metadata JSONB NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_identity_audit_logs_user_id ON identity_audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_identity_audit_logs_action ON identity_audit_logs(action);
CREATE INDEX IF NOT EXISTS idx_identity_audit_logs_created_at ON identity_audit_logs(created_at);

COMMENT ON TABLE identity_audit_logs IS '身份审计日志表 - 记录所有身份相关操作';
COMMENT ON COLUMN identity_audit_logs.action IS '操作类型: switch(切换), apply(申请), approve(批准), reject(拒绝), suspend(暂停)';
COMMENT ON COLUMN identity_audit_logs.metadata IS 'JSONB格式存储额外元数据';
