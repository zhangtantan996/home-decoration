# 数据库变更清单

> **文档版本**: v1.0
> **创建时间**: 2025-12-30
> **相关文档**: [DEVELOPMENT_PLAN.md](./DEVELOPMENT_PLAN.md)

---

## 📋 变更概览

本文档记录了开发计划中涉及的所有数据库表结构变更。

| 变更编号 | 相关功能 | 影响表 | 变更类型 | 优先级 |
|---------|---------|--------|---------|--------|
| M001 | 站内信通知系统 | notifications | 新增表 | P0 |
| M002 | 方案版本管理 | proposals | 新增字段 | P0 |
| M003 | 意向金退款 | bookings | 新增字段 | P0 |

---

## M001: 新增通知表 (notifications)

### 变更信息
- **功能模块**: P0-1 站内信通知系统
- **优先级**: 🔴 P0
- **执行时机**: 第1天
- **脚本文件**: `server/migrations/001_create_notifications_table.sql`

### SQL脚本

```sql
-- ==================== 创建通知表 ====================

CREATE TABLE IF NOT EXISTS notifications (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL,
    user_type VARCHAR(20) NOT NULL,        -- user, provider, admin
    title VARCHAR(100) NOT NULL,
    content TEXT NOT NULL,
    type VARCHAR(30) NOT NULL,
    related_id BIGINT DEFAULT 0,
    related_type VARCHAR(30),              -- booking, proposal, order, withdraw
    is_read BOOLEAN DEFAULT FALSE,
    read_at TIMESTAMP,
    action_url VARCHAR(200),               -- 跳转路径
    extra TEXT,                            -- JSON扩展字段
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ==================== 创建索引 ====================

CREATE INDEX idx_notifications_user ON notifications(user_id, user_type);
CREATE INDEX idx_notifications_is_read ON notifications(is_read);
CREATE INDEX idx_notifications_type ON notifications(type);
CREATE INDEX idx_notifications_created_at ON notifications(created_at DESC);

-- ==================== 添加注释 ====================

COMMENT ON TABLE notifications IS '站内通知表';
COMMENT ON COLUMN notifications.user_type IS '用户类型: user(普通用户), provider(商家), admin(管理员)';
COMMENT ON COLUMN notifications.type IS '通知类型: booking.intent_paid, proposal.submitted, order.paid等';
COMMENT ON COLUMN notifications.is_read IS '是否已读';
COMMENT ON COLUMN notifications.action_url IS '点击通知后的跳转路径';
COMMENT ON COLUMN notifications.extra IS 'JSON格式的扩展数据';
```

### 回滚脚本

```sql
DROP TABLE IF EXISTS notifications CASCADE;
```

---

## M002: 方案表版本管理字段

### 变更信息
- **功能模块**: P0-2 方案版本管理与拒绝重试
- **优先级**: 🔴 P0
- **执行时机**: 第3天
- **脚本文件**: `server/migrations/002_add_proposal_versioning.sql`

### SQL脚本

```sql
-- ==================== 新增字段 ====================

ALTER TABLE proposals
    ADD COLUMN IF NOT EXISTS version INT DEFAULT 1,
    ADD COLUMN IF NOT EXISTS parent_proposal_id BIGINT,
    ADD COLUMN IF NOT EXISTS rejection_count INT DEFAULT 0,
    ADD COLUMN IF NOT EXISTS rejection_reason TEXT,
    ADD COLUMN IF NOT EXISTS rejected_at TIMESTAMP,
    ADD COLUMN IF NOT EXISTS submitted_at TIMESTAMP,
    ADD COLUMN IF NOT EXISTS user_response_deadline TIMESTAMP;

-- ==================== 创建索引 ====================

CREATE INDEX IF NOT EXISTS idx_proposals_parent ON proposals(parent_proposal_id);
CREATE INDEX IF NOT EXISTS idx_proposals_submitted_at ON proposals(submitted_at);
CREATE INDEX IF NOT EXISTS idx_proposals_deadline ON proposals(user_response_deadline);

-- ==================== 更新现有数据 ====================

-- 将created_at作为submitted_at的初始值
UPDATE proposals
SET submitted_at = created_at
WHERE submitted_at IS NULL;

-- 设置14天确认期限（仅对待确认状态的方案）
UPDATE proposals
SET user_response_deadline = submitted_at + INTERVAL '14 days'
WHERE status = 1 AND user_response_deadline IS NULL;

-- ==================== 添加注释 ====================

COMMENT ON COLUMN proposals.version IS '方案版本号（v1, v2, v3...）';
COMMENT ON COLUMN proposals.parent_proposal_id IS '父方案ID（重新提交时指向原方案）';
COMMENT ON COLUMN proposals.rejection_count IS '累计拒绝次数（该预约下所有版本）';
COMMENT ON COLUMN proposals.rejection_reason IS '用户拒绝原因';
COMMENT ON COLUMN proposals.rejected_at IS '拒绝时间';
COMMENT ON COLUMN proposals.submitted_at IS '商家提交时间';
COMMENT ON COLUMN proposals.user_response_deadline IS '用户确认截止时间（14天）';
```

### 回滚脚本

```sql
ALTER TABLE proposals
    DROP COLUMN IF EXISTS version,
    DROP COLUMN IF EXISTS parent_proposal_id,
    DROP COLUMN IF EXISTS rejection_count,
    DROP COLUMN IF EXISTS rejection_reason,
    DROP COLUMN IF EXISTS rejected_at,
    DROP COLUMN IF EXISTS submitted_at,
    DROP COLUMN IF EXISTS user_response_deadline;

DROP INDEX IF EXISTS idx_proposals_parent;
DROP INDEX IF EXISTS idx_proposals_submitted_at;
DROP INDEX IF EXISTS idx_proposals_deadline;
```

---

## M003: 预约表退款相关字段

### 变更信息
- **功能模块**: P0-3 意向金退款机制
- **优先级**: 🔴 P0
- **执行时机**: 第5天
- **脚本文件**: `server/migrations/003_add_booking_refund_fields.sql`

### SQL脚本

```sql
-- ==================== 新增字段 ====================

ALTER TABLE bookings
    ADD COLUMN IF NOT EXISTS intent_fee_refunded BOOLEAN DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS intent_fee_refund_reason VARCHAR(200),
    ADD COLUMN IF NOT EXISTS intent_fee_refunded_at TIMESTAMP,
    ADD COLUMN IF NOT EXISTS merchant_response_deadline TIMESTAMP;

-- ==================== 创建索引 ====================

CREATE INDEX IF NOT EXISTS idx_bookings_refunded ON bookings(intent_fee_refunded);
CREATE INDEX IF NOT EXISTS idx_bookings_merchant_deadline ON bookings(merchant_response_deadline);

-- ==================== 更新现有数据 ====================

-- 为已支付意向金且状态为待处理的预约设置48小时期限
UPDATE bookings
SET merchant_response_deadline = created_at + INTERVAL '48 hours'
WHERE intent_fee_paid = TRUE
  AND merchant_response_deadline IS NULL
  AND status = 1;

-- ==================== 添加注释 ====================

COMMENT ON COLUMN bookings.intent_fee_refunded IS '意向金是否已退款';
COMMENT ON COLUMN bookings.intent_fee_refund_reason IS '退款原因';
COMMENT ON COLUMN bookings.intent_fee_refunded_at IS '退款时间';
COMMENT ON COLUMN bookings.merchant_response_deadline IS '商家响应截止时间（48小时）';
```

### 回滚脚本

```sql
ALTER TABLE bookings
    DROP COLUMN IF EXISTS intent_fee_refunded,
    DROP COLUMN IF EXISTS intent_fee_refund_reason,
    DROP COLUMN IF EXISTS intent_fee_refunded_at,
    DROP COLUMN IF EXISTS merchant_response_deadline;

DROP INDEX IF EXISTS idx_bookings_refunded;
DROP INDEX IF EXISTS idx_bookings_merchant_deadline;
```

---

## 执行顺序

建议按以下顺序执行数据库变更：

1. **M001** - 创建notifications表（第1天）
2. **M002** - Proposals表版本管理字段（第3天）
3. **M003** - Bookings表退款字段（第5天）

---

## 验证脚本

### 检查表是否存在

```sql
-- 检查notifications表
SELECT EXISTS (
    SELECT FROM information_schema.tables
    WHERE table_schema = 'public'
    AND table_name = 'notifications'
);

-- 检查proposals新字段
SELECT column_name
FROM information_schema.columns
WHERE table_name = 'proposals'
  AND column_name IN ('version', 'parent_proposal_id', 'rejection_count',
                      'rejection_reason', 'submitted_at', 'user_response_deadline');

-- 检查bookings新字段
SELECT column_name
FROM information_schema.columns
WHERE table_name = 'bookings'
  AND column_name IN ('intent_fee_refunded', 'intent_fee_refund_reason',
                      'intent_fee_refunded_at', 'merchant_response_deadline');
```

### 检查索引是否创建

```sql
-- 检查notifications索引
SELECT indexname
FROM pg_indexes
WHERE tablename = 'notifications';

-- 检查proposals索引
SELECT indexname
FROM pg_indexes
WHERE tablename = 'proposals'
  AND indexname LIKE 'idx_proposals_%';

-- 检查bookings索引
SELECT indexname
FROM pg_indexes
WHERE tablename = 'bookings'
  AND indexname LIKE 'idx_bookings_%';
```

---

## 注意事项

### 执行前备份

```bash
# 备份整个数据库
pg_dump -U postgres -d home_decoration > backup_$(date +%Y%m%d_%H%M%S).sql

# 仅备份特定表
pg_dump -U postgres -d home_decoration -t proposals -t bookings > backup_tables_$(date +%Y%m%d).sql
```

### 生产环境执行建议

1. **在维护窗口执行** - 避免业务高峰期
2. **先在测试环境验证** - 确保脚本无误
3. **使用事务包裹** - 出错可回滚
   ```sql
   BEGIN;
   -- 执行变更脚本
   COMMIT;  -- 或 ROLLBACK;
   ```
4. **监控执行时间** - 大表ALTER可能较慢
5. **准备回滚脚本** - 出现问题时快速恢复

---

## 数据迁移注意事项

### proposals表

- 现有方案会自动设置 `version = 1`
- `submitted_at` 会使用 `created_at` 作为初始值
- 待确认状态的方案会自动设置14天期限

### bookings表

- 已支付意向金且状态为待处理的预约会自动设置48小时期限
- 历史数据的 `merchant_response_deadline` 可能已过期，需业务逻辑处理
