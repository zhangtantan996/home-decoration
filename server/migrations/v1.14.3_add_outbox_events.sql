-- v1.14.3: durable outbox event table for side-effect processing.

CREATE TABLE IF NOT EXISTS outbox_events (
    id BIGSERIAL PRIMARY KEY,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    event_type VARCHAR(80) NOT NULL,
    aggregate_type VARCHAR(80) NOT NULL,
    aggregate_id BIGINT NOT NULL,
    handler_key VARCHAR(40) NOT NULL,
    event_key VARCHAR(160) NOT NULL,
    payload JSONB NOT NULL DEFAULT '{}'::jsonb,
    status VARCHAR(20) NOT NULL DEFAULT 'pending',
    retry_count INTEGER NOT NULL DEFAULT 0,
    max_retries INTEGER NOT NULL DEFAULT 3,
    next_retry_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    locked_by VARCHAR(80) NOT NULL DEFAULT '',
    locked_until TIMESTAMPTZ NULL,
    processed_at TIMESTAMPTZ NULL,
    last_error TEXT NOT NULL DEFAULT '',
    ignored_by BIGINT NOT NULL DEFAULT 0,
    ignored_reason TEXT NOT NULL DEFAULT '',
    ignored_at TIMESTAMPTZ NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_outbox_events_event_handler
    ON outbox_events (event_key, handler_key);

CREATE INDEX IF NOT EXISTS idx_outbox_events_status_retry
    ON outbox_events (status, next_retry_at, id);

CREATE INDEX IF NOT EXISTS idx_outbox_events_handler
    ON outbox_events (handler_key);

CREATE INDEX IF NOT EXISTS idx_outbox_events_event_type
    ON outbox_events (event_type);

CREATE INDEX IF NOT EXISTS idx_outbox_events_aggregate
    ON outbox_events (aggregate_type, aggregate_id);

CREATE INDEX IF NOT EXISTS idx_outbox_events_locked_until
    ON outbox_events (locked_until);

COMMENT ON TABLE outbox_events IS '稳定事件层任务表，用于通知、短信、审计、统计、治理刷新等副作用处理';
COMMENT ON COLUMN outbox_events.event_key IS '业务幂等键，同一事件同一 handler 只能执行一次';
COMMENT ON COLUMN outbox_events.payload IS '业务快照，worker 不应依赖易变业务状态推导关键展示内容';

INSERT INTO system_configs (key, value, type, description, editable, created_at, updated_at)
SELECT 'outbox.worker.enabled', 'true', 'boolean', '是否启用事件任务 worker', TRUE, NOW(), NOW()
WHERE NOT EXISTS (SELECT 1 FROM system_configs WHERE key = 'outbox.worker.enabled');

INSERT INTO system_configs (key, value, type, description, editable, created_at, updated_at)
SELECT 'outbox.worker.batch_size', '20', 'number', '事件任务 worker 单批处理数量', TRUE, NOW(), NOW()
WHERE NOT EXISTS (SELECT 1 FROM system_configs WHERE key = 'outbox.worker.batch_size');

INSERT INTO system_configs (key, value, type, description, editable, created_at, updated_at)
SELECT 'outbox.worker.poll_interval_seconds', '5', 'number', '事件任务 worker 轮询间隔秒数', TRUE, NOW(), NOW()
WHERE NOT EXISTS (SELECT 1 FROM system_configs WHERE key = 'outbox.worker.poll_interval_seconds');

INSERT INTO system_configs (key, value, type, description, editable, created_at, updated_at)
SELECT 'outbox.worker.lock_ttl_seconds', '60', 'number', '事件任务 worker 锁定超时秒数', TRUE, NOW(), NOW()
WHERE NOT EXISTS (SELECT 1 FROM system_configs WHERE key = 'outbox.worker.lock_ttl_seconds');

INSERT INTO system_configs (key, value, type, description, editable, created_at, updated_at)
SELECT 'outbox.worker.max_retries', '3', 'number', '事件任务默认最大重试次数', TRUE, NOW(), NOW()
WHERE NOT EXISTS (SELECT 1 FROM system_configs WHERE key = 'outbox.worker.max_retries');

DO $$
DECLARE
    settings_root_id BIGINT;
    outbox_menu_id BIGINT;
BEGIN
    SELECT id INTO settings_root_id
    FROM sys_menus
    WHERE path = '/settings'
    ORDER BY id ASC
    LIMIT 1;

    IF settings_root_id IS NOT NULL THEN
        SELECT id INTO outbox_menu_id
        FROM sys_menus
        WHERE path = '/settings/outbox-events'
        ORDER BY id ASC
        LIMIT 1;

        IF outbox_menu_id IS NULL THEN
            INSERT INTO sys_menus (parent_id, title, type, permission, path, component, icon, sort, visible, status, created_at, updated_at)
            VALUES (settings_root_id, '事件任务', 2, 'system:log:list', '/settings/outbox-events', 'pages/settings/OutboxEventList', 'ClockCircleOutlined', 5, TRUE, 1, NOW(), NOW())
            RETURNING id INTO outbox_menu_id;
        ELSE
            UPDATE sys_menus
            SET parent_id = settings_root_id,
                title = '事件任务',
                type = 2,
                permission = 'system:log:list',
                path = '/settings/outbox-events',
                component = 'pages/settings/OutboxEventList',
                icon = 'ClockCircleOutlined',
                sort = 5,
                visible = TRUE,
                status = 1,
                updated_at = NOW()
            WHERE id = outbox_menu_id;
        END IF;

        INSERT INTO sys_role_menus (role_id, menu_id, created_at, updated_at)
        SELECT DISTINCT rm.role_id, outbox_menu_id, NOW(), NOW()
        FROM sys_role_menus rm
        JOIN sys_menus sm ON sm.id = rm.menu_id
        WHERE outbox_menu_id IS NOT NULL
          AND sm.permission = 'system:log:list'
          AND NOT EXISTS (
              SELECT 1 FROM sys_role_menus existing
              WHERE existing.role_id = rm.role_id AND existing.menu_id = outbox_menu_id
          );
    END IF;
END $$;
