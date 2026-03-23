BEGIN;

CREATE TABLE IF NOT EXISTS payment_orders (
    id BIGSERIAL PRIMARY KEY,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ,
    biz_type VARCHAR(50) NOT NULL,
    biz_id BIGINT NOT NULL,
    payer_user_id BIGINT NOT NULL,
    channel VARCHAR(20) NOT NULL,
    scene VARCHAR(50) NOT NULL,
    terminal_type VARCHAR(20) NOT NULL,
    subject VARCHAR(128) NOT NULL,
    amount NUMERIC(12,2) NOT NULL DEFAULT 0,
    out_trade_no VARCHAR(64) NOT NULL UNIQUE,
    provider_trade_no VARCHAR(64) NOT NULL DEFAULT '',
    status VARCHAR(20) NOT NULL,
    launch_token_hash VARCHAR(64) NOT NULL DEFAULT '',
    launch_token_expired_at TIMESTAMPTZ,
    expired_at TIMESTAMPTZ,
    paid_at TIMESTAMPTZ,
    return_context JSONB NOT NULL DEFAULT '{}'::jsonb,
    raw_response_digest VARCHAR(64) NOT NULL DEFAULT ''
);
CREATE INDEX IF NOT EXISTS idx_payment_orders_deleted_at ON payment_orders(deleted_at);
CREATE INDEX IF NOT EXISTS idx_payment_orders_biz ON payment_orders(biz_type, biz_id);
CREATE INDEX IF NOT EXISTS idx_payment_orders_payer_user_id ON payment_orders(payer_user_id);
CREATE INDEX IF NOT EXISTS idx_payment_orders_channel ON payment_orders(channel);
CREATE INDEX IF NOT EXISTS idx_payment_orders_status ON payment_orders(status);
CREATE INDEX IF NOT EXISTS idx_payment_orders_provider_trade_no ON payment_orders(provider_trade_no);
CREATE INDEX IF NOT EXISTS idx_payment_orders_expired_at ON payment_orders(expired_at);

CREATE TABLE IF NOT EXISTS payment_callbacks (
    id BIGSERIAL PRIMARY KEY,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ,
    payment_order_id BIGINT NOT NULL REFERENCES payment_orders(id),
    notify_id VARCHAR(128) NOT NULL UNIQUE,
    event_type VARCHAR(50) NOT NULL,
    verified BOOLEAN NOT NULL DEFAULT FALSE,
    processed BOOLEAN NOT NULL DEFAULT FALSE,
    payload_json JSONB NOT NULL DEFAULT '{}'::jsonb,
    received_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    processed_at TIMESTAMPTZ,
    error_message VARCHAR(500) NOT NULL DEFAULT ''
);
CREATE INDEX IF NOT EXISTS idx_payment_callbacks_deleted_at ON payment_callbacks(deleted_at);
CREATE INDEX IF NOT EXISTS idx_payment_callbacks_payment_order_id ON payment_callbacks(payment_order_id);

CREATE TABLE IF NOT EXISTS refund_orders (
    id BIGSERIAL PRIMARY KEY,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ,
    payment_order_id BIGINT NOT NULL REFERENCES payment_orders(id),
    biz_type VARCHAR(50) NOT NULL,
    biz_id BIGINT NOT NULL,
    refund_application_id BIGINT NOT NULL REFERENCES refund_applications(id),
    out_refund_no VARCHAR(64) NOT NULL UNIQUE,
    amount NUMERIC(12,2) NOT NULL DEFAULT 0,
    reason VARCHAR(200) NOT NULL DEFAULT '',
    status VARCHAR(20) NOT NULL,
    provider_response_json JSONB NOT NULL DEFAULT '{}'::jsonb,
    failure_reason VARCHAR(500) NOT NULL DEFAULT '',
    succeeded_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_refund_orders_deleted_at ON refund_orders(deleted_at);
CREATE INDEX IF NOT EXISTS idx_refund_orders_payment_order_id ON refund_orders(payment_order_id);
CREATE INDEX IF NOT EXISTS idx_refund_orders_biz ON refund_orders(biz_type, biz_id);
CREATE INDEX IF NOT EXISTS idx_refund_orders_application_id ON refund_orders(refund_application_id);
CREATE INDEX IF NOT EXISTS idx_refund_orders_status ON refund_orders(status);

ALTER TABLE merchant_withdraws
    ADD COLUMN IF NOT EXISTS approved_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS transferred_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS transfer_voucher VARCHAR(500) NOT NULL DEFAULT '';

UPDATE merchant_withdraws SET status = 2 WHERE status = 1;
UPDATE merchant_withdraws SET status = 3 WHERE status = 2;

COMMIT;
