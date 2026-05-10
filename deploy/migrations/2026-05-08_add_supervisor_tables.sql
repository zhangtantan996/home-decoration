-- ============================================================
-- 监理系统 DDL (v2.4.1) — 白名单 → 申请 → 审核 → 账号
-- ============================================================
-- 执行方式: psql -h <host> -U <user> -d home_decoration -f deploy/migrations/2026-05-08_add_supervisor_tables.sql
-- 幂等策略: 所有 CREATE 前做 IF NOT EXISTS 检查；ALTER 做 col/index 缺失补齐
-- 注意: 本脚本不依赖 GORM AutoMigrate，生产必须手动执行后验证
-- ============================================================

BEGIN;

-- ============================================================
-- 1. supervisor_phone_whitelists — 监理白名单手机号
-- ============================================================
CREATE TABLE IF NOT EXISTS supervisor_phone_whitelists (
    id              BIGSERIAL PRIMARY KEY,
    phone           VARCHAR(20)  NOT NULL,
    status          SMALLINT     NOT NULL DEFAULT 1,  -- 1=active 0=disabled
    expires_at      TIMESTAMPTZ,
    note            TEXT,
    created_by_admin_id BIGINT   NOT NULL,
    created_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- 唯一约束：手机号
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'uq_supervisor_whitelist_phone'
    ) THEN
        ALTER TABLE supervisor_phone_whitelists ADD CONSTRAINT uq_supervisor_whitelist_phone UNIQUE (phone);
    END IF;
END $$;

-- 查询索引：按状态 + 过期时间
CREATE INDEX IF NOT EXISTS idx_supervisor_whitelist_status_expires
    ON supervisor_phone_whitelists (status, expires_at);


-- ============================================================
-- 2. supervisor_applications — 监理入驻申请
-- ============================================================
CREATE TABLE IF NOT EXISTS supervisor_applications (
    id                  BIGSERIAL PRIMARY KEY,
    phone               VARCHAR(20)  NOT NULL,
    whitelist_id        BIGINT       NOT NULL,
    status              SMALLINT     NOT NULL DEFAULT 0,  -- 0=pending 1=approved 2=rejected
    form_json           JSONB        NOT NULL,
    reject_reason       TEXT,
    reviewed_by_admin_id BIGINT,
    reviewed_at         TIMESTAMPTZ,
    submitted_at        TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    supervisor_account_id BIGINT,
    created_at          TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- 查询索引：按手机号 + 状态
CREATE INDEX IF NOT EXISTS idx_sa_phone_status
    ON supervisor_applications (phone, status);

-- 查询索引：按状态 + 提交时间（审核列表排序）
CREATE INDEX IF NOT EXISTS idx_sa_status_submitted
    ON supervisor_applications (status, submitted_at DESC);

-- 外键：whitelist_id → supervisor_phone_whitelists.id
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'fk_sa_whitelist_id'
    ) THEN
        ALTER TABLE supervisor_applications
            ADD CONSTRAINT fk_sa_whitelist_id
            FOREIGN KEY (whitelist_id) REFERENCES supervisor_phone_whitelists(id)
            ON DELETE RESTRICT;
    END IF;
END $$;

-- 外键：supervisor_account_id → supervisor_accounts.id（审核通过后回填）
-- 先创建表，外键在 supervisor_accounts 之后补齐


-- ============================================================
-- 3. supervisor_accounts — 监理登录账号（独立于 users 表）
-- ============================================================
CREATE TABLE IF NOT EXISTS supervisor_accounts (
    id                  BIGSERIAL PRIMARY KEY,
    phone               VARCHAR(20)  NOT NULL,
    status              SMALLINT     NOT NULL DEFAULT 1,  -- 1=active 0=disabled
    last_login_at       TIMESTAMPTZ,
    last_login_ip       VARCHAR(50),
    login_failed_count  INT          NOT NULL DEFAULT 0,
    locked_until        TIMESTAMPTZ,
    password_hash       TEXT,
    created_at          TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- 唯一约束：手机号
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'uq_supervisor_account_phone'
    ) THEN
        ALTER TABLE supervisor_accounts ADD CONSTRAINT uq_supervisor_account_phone UNIQUE (phone);
    END IF;
END $$;

-- 查询索引：按状态 + 最近登录
CREATE INDEX IF NOT EXISTS idx_sa_account_status_login
    ON supervisor_accounts (status, last_login_at DESC);


-- ============================================================
-- 4. supervisor_profiles — 监理资料表（新增 supervisor_account_id 列）
-- ============================================================
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'supervisor_profiles' AND column_name = 'supervisor_account_id'
    ) THEN
        ALTER TABLE supervisor_profiles ADD COLUMN supervisor_account_id BIGINT;
    END IF;
END $$;

-- 唯一索引：supervisor_account_id 非 NULL 时唯一（PostgreSQL NULLS DISTINCT 默认行为）
CREATE UNIQUE INDEX IF NOT EXISTS uq_supervisor_profile_account_id
    ON supervisor_profiles (supervisor_account_id)
    WHERE supervisor_account_id IS NOT NULL;

-- 外键：supervisor_profiles.supervisor_account_id → supervisor_accounts.id
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'fk_sp_account_id'
    ) THEN
        ALTER TABLE supervisor_profiles
            ADD CONSTRAINT fk_sp_account_id
            FOREIGN KEY (supervisor_account_id) REFERENCES supervisor_accounts(id)
            ON DELETE SET NULL;
    END IF;
END $$;


-- ============================================================
-- 5. supervisor_applications 补全外键（在 supervisor_accounts 创建之后）
-- ============================================================
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'fk_sa_account_id'
    ) THEN
        ALTER TABLE supervisor_applications
            ADD CONSTRAINT fk_sa_account_id
            FOREIGN KEY (supervisor_account_id) REFERENCES supervisor_accounts(id)
            ON DELETE SET NULL;
    END IF;
END $$;


-- ============================================================
-- 6. 回滚脚本（逆序，需要在 ROLLBACK 块中手动执行）
-- ============================================================
-- 回滚时执行以下语句：
-- ALTER TABLE supervisor_applications DROP CONSTRAINT IF EXISTS fk_sa_account_id;
-- ALTER TABLE supervisor_profiles DROP CONSTRAINT IF EXISTS fk_sp_account_id;
-- DROP INDEX IF EXISTS uq_supervisor_profile_account_id;
-- ALTER TABLE supervisor_profiles DROP COLUMN IF EXISTS supervisor_account_id;
-- ALTER TABLE supervisor_applications DROP CONSTRAINT IF EXISTS fk_sa_whitelist_id;
-- DROP TABLE IF EXISTS supervisor_accounts CASCADE;
-- DROP TABLE IF EXISTS supervisor_applications CASCADE;
-- DROP TABLE IF EXISTS supervisor_phone_whitelists CASCADE;

COMMIT;

-- ============================================================
-- 验证脚本（可选，COMMIT 后单独执行）
-- ============================================================
-- SELECT table_name FROM information_schema.tables WHERE table_name LIKE 'supervisor_%' ORDER BY table_name;
-- SELECT indexname, tablename FROM pg_indexes WHERE indexname LIKE '%supervisor%' ORDER BY tablename;
-- SELECT conname, contype FROM pg_constraint WHERE conname LIKE '%supervisor%' OR conname LIKE '%fk_s%' ORDER BY conname;
