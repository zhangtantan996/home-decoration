-- ==================== 创建通知表 ====================
-- Migration: M001
-- Purpose: 站内信通知系统 - 创建notifications表
-- Author: Development Plan P0-1
-- Date: 2025-12-30

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
