-- 多工长报价PK系统数据表

-- 报价任务表
CREATE TABLE IF NOT EXISTS quote_tasks (
    id BIGSERIAL PRIMARY KEY,
    booking_id BIGINT NOT NULL,
    user_id BIGINT NOT NULL,
    project_id BIGINT,
    area DECIMAL(10,2),
    style VARCHAR(50),
    region VARCHAR(100),
    budget DECIMAL(12,2),
    description TEXT,
    status VARCHAR(20) DEFAULT 'pending',
    expired_at TIMESTAMP,
    selected_quote_id BIGINT,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_quote_tasks_booking_id ON quote_tasks(booking_id);
CREATE INDEX IF NOT EXISTS idx_quote_tasks_user_id ON quote_tasks(user_id);
CREATE INDEX IF NOT EXISTS idx_quote_tasks_project_id ON quote_tasks(project_id);
CREATE INDEX IF NOT EXISTS idx_quote_tasks_status ON quote_tasks(status);
CREATE INDEX IF NOT EXISTS idx_quote_tasks_expired_at ON quote_tasks(expired_at);
CREATE INDEX IF NOT EXISTS idx_quote_tasks_selected_quote_id ON quote_tasks(selected_quote_id);

-- 报价PK提交表（使用不同的表名避免冲突）
CREATE TABLE IF NOT EXISTS quote_pk_submissions (
    id BIGSERIAL PRIMARY KEY,
    quote_task_id BIGINT NOT NULL,
    provider_id BIGINT NOT NULL,
    total_price DECIMAL(12,2) NOT NULL,
    duration INT NOT NULL,
    materials TEXT,
    description TEXT,
    status VARCHAR(20) DEFAULT 'pending',
    submitted_at TIMESTAMP,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_quote_pk_submissions_quote_task_id ON quote_pk_submissions(quote_task_id);
CREATE INDEX IF NOT EXISTS idx_quote_pk_submissions_provider_id ON quote_pk_submissions(provider_id);

-- 创建唯一索引，防止同一工长重复提交报价
CREATE UNIQUE INDEX IF NOT EXISTS idx_quote_pk_submissions_task_provider ON quote_pk_submissions(quote_task_id, provider_id);

-- 添加注释
COMMENT ON TABLE quote_tasks IS '报价任务表';
COMMENT ON COLUMN quote_tasks.booking_id IS '预约ID';
COMMENT ON COLUMN quote_tasks.user_id IS '用户ID';
COMMENT ON COLUMN quote_tasks.project_id IS '项目ID（可选）';
COMMENT ON COLUMN quote_tasks.area IS '面积';
COMMENT ON COLUMN quote_tasks.style IS '风格';
COMMENT ON COLUMN quote_tasks.region IS '区域';
COMMENT ON COLUMN quote_tasks.budget IS '预算';
COMMENT ON COLUMN quote_tasks.description IS '需求描述';
COMMENT ON COLUMN quote_tasks.status IS '状态：pending-待匹配, in_progress-进行中, completed-已完成, expired-已过期';
COMMENT ON COLUMN quote_tasks.expired_at IS '过期时间（48小时）';
COMMENT ON COLUMN quote_tasks.selected_quote_id IS '选中的报价ID';

COMMENT ON TABLE quote_pk_submissions IS '报价PK提交表';
COMMENT ON COLUMN quote_pk_submissions.quote_task_id IS '报价任务ID';
COMMENT ON COLUMN quote_pk_submissions.provider_id IS '工长ID';
COMMENT ON COLUMN quote_pk_submissions.total_price IS '总价';
COMMENT ON COLUMN quote_pk_submissions.duration IS '工期（天）';
COMMENT ON COLUMN quote_pk_submissions.materials IS '材料清单';
COMMENT ON COLUMN quote_pk_submissions.description IS '报价说明';
COMMENT ON COLUMN quote_pk_submissions.status IS '状态：pending-待选择, selected-已选中, rejected-已拒绝';
COMMENT ON COLUMN quote_pk_submissions.submitted_at IS '提交时间';
