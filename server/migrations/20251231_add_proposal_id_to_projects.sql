-- 迁移脚本: 为 projects 表添加 proposal_id 字段
-- 用于关联项目与设计方案，方便从项目详情页跳转到方案详情

ALTER TABLE projects ADD COLUMN IF NOT EXISTS proposal_id BIGINT DEFAULT 0;

-- 创建索引以提升查询性能
CREATE INDEX IF NOT EXISTS idx_projects_proposal_id ON projects(proposal_id);

-- 更新现有项目的 proposal_id（如果能从 bookings/orders 推断）
-- 注意：此更新仅对通过方案创建的项目有效
-- 手动创建的项目 proposal_id 保持为 0

-- 通过 address 匹配来更新 proposal_id
UPDATE projects p
SET proposal_id = (
    SELECT pr.id FROM proposals pr
    JOIN bookings b ON pr.booking_id = b.id
    WHERE b.address = p.address
    AND b.user_id = p.owner_id
    LIMIT 1
)
WHERE p.proposal_id = 0 OR p.proposal_id IS NULL;
