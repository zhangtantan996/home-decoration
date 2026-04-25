-- 对账差异处理字段迁移脚本
-- 添加差异处理状态和相关字段

-- 添加 handle_status 字段（处理状态）
ALTER TABLE reconciliation_differences
ADD COLUMN IF NOT EXISTS handle_status VARCHAR(20) DEFAULT 'pending';

-- 添加索引
CREATE INDEX IF NOT EXISTS idx_reconciliation_differences_handle_status
ON reconciliation_differences(handle_status);

-- 添加 ignore_reason 字段（忽略原因）
ALTER TABLE reconciliation_differences
ADD COLUMN IF NOT EXISTS ignore_reason VARCHAR(500);

-- 添加 solution 字段（解决方案）
ALTER TABLE reconciliation_differences
ADD COLUMN IF NOT EXISTS solution VARCHAR(500);

-- 更新现有记录的 handle_status
-- 已解决的记录标记为 resolved
UPDATE reconciliation_differences
SET handle_status = 'resolved'
WHERE resolved = true AND handle_status = 'pending';

-- 未解决的记录保持 pending
UPDATE reconciliation_differences
SET handle_status = 'pending'
WHERE resolved = false AND handle_status IS NULL;

-- 添加注释
COMMENT ON COLUMN reconciliation_differences.handle_status IS '处理状态: pending/investigating/resolved/ignored';
COMMENT ON COLUMN reconciliation_differences.ignore_reason IS '忽略原因';
COMMENT ON COLUMN reconciliation_differences.solution IS '解决方案';
