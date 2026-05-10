-- ============================================================================
-- v1.15.0: 统一身份中心改造 — 新增表 + 扩展字段
-- 目标：users 作为唯一账号主体，user_identities 作为唯一身份中心
-- 身份枚举固定：owner, provider, supervisor, admin
-- 明确不做：不做 admin_users / merchant_users / supervisor_users 平行账号表
-- ============================================================================

-- up --------------------------------------------------------------------------

-- 1. 监理资料表 supervisor_profiles
CREATE TABLE IF NOT EXISTS supervisor_profiles (
    id              BIGSERIAL PRIMARY KEY,
    user_id         BIGINT NOT NULL,
    real_name       VARCHAR(50)  NOT NULL DEFAULT '',
    phone           VARCHAR(20)  NOT NULL DEFAULT '',
    city_code       VARCHAR(10)  NOT NULL DEFAULT '',
    service_area    TEXT         NOT NULL DEFAULT '',
    certifications  TEXT         NOT NULL DEFAULT '',
    status          SMALLINT     NOT NULL DEFAULT 1,
    verified        BOOLEAN      NOT NULL DEFAULT FALSE,
    verified_at     TIMESTAMPTZ  NULL,
    created_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE supervisor_profiles IS '监理资料表 — 监理角色专业资料（一个 user 最多一条）';
COMMENT ON COLUMN supervisor_profiles.user_id IS '关联 users.id (唯一)';
COMMENT ON COLUMN supervisor_profiles.service_area IS 'JSON 数组：服务城市代码';
COMMENT ON COLUMN supervisor_profiles.certifications IS 'JSON 数组：资质证书编号/类型';

-- 2. 后台人员资料桥接表 admin_profiles（第一阶段桥接 sys_admins，不删除 sys_admins）
CREATE TABLE IF NOT EXISTS admin_profiles (
    id              BIGSERIAL PRIMARY KEY,
    user_id         BIGINT NOT NULL,
    sys_admin_id    BIGINT NOT NULL,
    admin_type      VARCHAR(20)  NOT NULL DEFAULT '',
    status          SMALLINT     NOT NULL DEFAULT 1,
    created_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE admin_profiles IS '后台人员资料桥接表 — 桥接 users ↔ sys_admins，长期 sys_admins 不再作为唯一账号主体';
COMMENT ON COLUMN admin_profiles.sys_admin_id IS '桥接 sys_admins.id（唯一），第一阶段保留兼容，长期仅做 RBAC 过渡来源';

-- 3. 扩展 user_identities — 移除旧的 CHECK 限制，允许 supervisor + admin
DO $$
BEGIN
    ALTER TABLE user_identities DROP CONSTRAINT IF EXISTS chk_user_identities_identity_type;
EXCEPTION WHEN undefined_object THEN
    -- 约束不存在，忽略
END$$;

ALTER TABLE user_identities ALTER COLUMN identity_type TYPE VARCHAR(32);

-- 4. 新增/替换唯一约束 — UNIQUE(user_id, identity_type, identity_ref_id)
ALTER TABLE user_identities DROP CONSTRAINT IF EXISTS uq_user_identity_type;

CREATE UNIQUE INDEX IF NOT EXISTS uq_user_identity_type_ref ON user_identities (user_id, identity_type, COALESCE(identity_ref_id, 0));

-- 5. supervisor_profiles 唯一约束
CREATE UNIQUE INDEX IF NOT EXISTS uq_supervisor_profiles_user_id ON supervisor_profiles (user_id);

-- 6. admin_profiles 唯一约束
CREATE UNIQUE INDEX IF NOT EXISTS uq_admin_profiles_user_id ON admin_profiles (user_id);
CREATE UNIQUE INDEX IF NOT EXISTS uq_admin_profiles_sys_admin_id ON admin_profiles (sys_admin_id);

-- 7. 外键索引
CREATE INDEX IF NOT EXISTS idx_supervisor_profiles_user_id ON supervisor_profiles (user_id);
CREATE INDEX IF NOT EXISTS idx_admin_profiles_user_id ON admin_profiles (user_id);
CREATE INDEX IF NOT EXISTS idx_admin_profiles_sys_admin_id ON admin_profiles (sys_admin_id);

-- 8. 项目监理分配表 project_supervisor_assignments
CREATE TABLE IF NOT EXISTS project_supervisor_assignments (
    id              BIGSERIAL PRIMARY KEY,
    project_id      BIGINT NOT NULL,
    supervisor_id   BIGINT NOT NULL,
    assigned_by     BIGINT NOT NULL DEFAULT 0,
    status          SMALLINT NOT NULL DEFAULT 1,
    assigned_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE project_supervisor_assignments IS '项目监理分配表 — 记录每个项目的监理分配关系';
COMMENT ON COLUMN project_supervisor_assignments.supervisor_id IS '关联 supervisor_profiles.id';

CREATE INDEX IF NOT EXISTS idx_psa_project_id ON project_supervisor_assignments (project_id);
CREATE INDEX IF NOT EXISTS idx_psa_supervisor_id ON project_supervisor_assignments (supervisor_id);
CREATE UNIQUE INDEX IF NOT EXISTS uq_psa_project_supervisor ON project_supervisor_assignments (project_id, supervisor_id);

-- 9. 监理日志表 supervision_logs（支持离线草稿）
CREATE TABLE IF NOT EXISTS supervision_logs (
    id                  BIGSERIAL PRIMARY KEY,
    project_id          BIGINT       NOT NULL,
    supervisor_id       BIGINT       NOT NULL,
    stage               VARCHAR(50)  NOT NULL DEFAULT '',
    content             TEXT         NOT NULL DEFAULT '',
    photos              TEXT         NOT NULL DEFAULT '',
    offline_created_at  TIMESTAMPTZ  NULL,
    synced_at           TIMESTAMPTZ  NULL,
    created_at          TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE supervision_logs IS '监理日志表 — 监理现场记录，支持离线草稿';
COMMENT ON COLUMN supervision_logs.offline_created_at IS '离线创建时间（NULL=在线创建）';
COMMENT ON COLUMN supervision_logs.synced_at IS '同步到服务器时间（NULL=尚未同步即离线草稿）';

CREATE INDEX IF NOT EXISTS idx_sl_project_id ON supervision_logs (project_id);
CREATE INDEX IF NOT EXISTS idx_sl_supervisor_id ON supervision_logs (supervisor_id);
CREATE INDEX IF NOT EXISTS idx_sl_synced_at ON supervision_logs (synced_at);

-- 10. 监理问题整改表 supervision_issues
CREATE TABLE IF NOT EXISTS supervision_issues (
    id                      BIGSERIAL PRIMARY KEY,
    project_id              BIGINT       NOT NULL,
    supervisor_id           BIGINT       NOT NULL,
    log_id                  BIGINT       NULL,
    issue_type              VARCHAR(50)  NOT NULL DEFAULT '',
    severity                VARCHAR(20)  NOT NULL DEFAULT 'medium',
    assignee_provider_id    BIGINT       NOT NULL DEFAULT 0,
    status                  VARCHAR(20)  NOT NULL DEFAULT 'open',
    deadline_at             TIMESTAMPTZ  NULL,
    closed_at               TIMESTAMPTZ  NULL,
    created_at              TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at              TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE supervision_issues IS '监理问题整改表 — 记录监理发现的问题及整改状态';
COMMENT ON COLUMN supervision_issues.log_id IS '关联 supervision_logs.id（发现问题的日志）';
COMMENT ON COLUMN supervision_issues.assignee_provider_id IS '指派给服务商 providers.id 进行整改';
COMMENT ON COLUMN supervision_issues.status IS 'open=待处理, in_progress=整改中, resolved=已整改, closed=已关闭';

CREATE INDEX IF NOT EXISTS idx_si_project_id ON supervision_issues (project_id);
CREATE INDEX IF NOT EXISTS idx_si_supervisor_id ON supervision_issues (supervisor_id);
CREATE INDEX IF NOT EXISTS idx_si_assignee_provider_id ON supervision_issues (assignee_provider_id);
CREATE INDEX IF NOT EXISTS idx_si_status ON supervision_issues (status);
CREATE INDEX IF NOT EXISTS idx_si_log_id ON supervision_issues (log_id);

-- 11. 给 users 表加默认身份类型字段（反范式冗余，真相在 user_identities）
ALTER TABLE users ADD COLUMN IF NOT EXISTS default_identity_type VARCHAR(32) NOT NULL DEFAULT 'owner';

COMMENT ON COLUMN users.default_identity_type IS '默认身份类型（反范式冗余，真相在 user_identities）。改为 admin 后仍必须校验 RBAC。';

-- down ------------------------------------------------------------------------
-- 回滚（仅用于开发环境，生产环境不执行，按增量原则处理）
/*
ALTER TABLE users DROP COLUMN IF EXISTS default_identity_type;

DROP INDEX IF EXISTS uq_user_identity_type_ref;
ALTER TABLE user_identities ADD CONSTRAINT uq_user_identity_type UNIQUE(user_id, identity_type);

DROP TABLE IF EXISTS supervision_issues CASCADE;
DROP TABLE IF EXISTS supervision_logs CASCADE;
DROP TABLE IF EXISTS project_supervisor_assignments CASCADE;
DROP TABLE IF EXISTS admin_profiles CASCADE;
DROP TABLE IF EXISTS supervisor_profiles CASCADE;
*/
