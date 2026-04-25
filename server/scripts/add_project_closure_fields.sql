-- 添加项目关闭相关字段
-- 执行时间: 2026-04-20

ALTER TABLE projects ADD COLUMN IF NOT EXISTS closed_reason VARCHAR(500);
ALTER TABLE projects ADD COLUMN IF NOT EXISTS closed_at TIMESTAMP;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS closure_type VARCHAR(20);

-- 添加索引以提升查询性能
CREATE INDEX IF NOT EXISTS idx_projects_closure_type ON projects(closure_type);
CREATE INDEX IF NOT EXISTS idx_projects_closed_at ON projects(closed_at);

-- 添加注释
COMMENT ON COLUMN projects.closed_reason IS '项目关闭原因';
COMMENT ON COLUMN projects.closed_at IS '项目关闭时间';
COMMENT ON COLUMN projects.closure_type IS '关闭类型: normal(正常关闭), abnormal(异常关闭)';
