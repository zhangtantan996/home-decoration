-- LEGACY NOTICE: 本脚本与正式发布目录中的 server/migrations/v1.2.0_add_project_phases.sql 重复；当前仅保留用于历史追溯。
-- 正式发布请改用 server/migrations/。

-- =============================================================================
-- Migration: v1.2.0 添加项目阶段表 (PostgreSQL)
-- 用于支持工程进度页功能
-- =============================================================================

-- 项目阶段表
CREATE TABLE IF NOT EXISTS project_phases (
    id BIGSERIAL PRIMARY KEY,
    project_id BIGINT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    phase_type VARCHAR(20) NOT NULL,  -- preparation, demolition, electrical, masonry, painting, installation, inspection
    seq INT NOT NULL DEFAULT 0,        -- 阶段顺序 1-7
    status VARCHAR(20) DEFAULT 'pending',  -- pending, in_progress, completed
    responsible_person VARCHAR(50),
    start_date DATE,
    end_date DATE,
    estimated_days INT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 索引
CREATE INDEX IF NOT EXISTS idx_project_phases_project_id ON project_phases(project_id);
CREATE INDEX IF NOT EXISTS idx_project_phases_phase_type ON project_phases(phase_type);

-- 阶段子任务表
CREATE TABLE IF NOT EXISTS phase_tasks (
    id BIGSERIAL PRIMARY KEY,
    phase_id BIGINT NOT NULL REFERENCES project_phases(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    is_completed BOOLEAN DEFAULT FALSE,
    completed_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 索引
CREATE INDEX IF NOT EXISTS idx_phase_tasks_phase_id ON phase_tasks(phase_id);

-- =============================================================================
-- 完成提示
-- =============================================================================
-- 使用 psql 执行:
-- psql -h localhost -p 5432 -U postgres -d home_decoration -f v1.2.0_add_project_phases.sql
