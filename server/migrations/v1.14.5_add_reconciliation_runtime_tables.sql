BEGIN;

CREATE TABLE IF NOT EXISTS reconciliation_records (
    id BIGSERIAL PRIMARY KEY,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    reconcile_date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    reconcile_type VARCHAR(30) NOT NULL DEFAULT '',
    channel VARCHAR(20) NOT NULL DEFAULT '',
    total_count INTEGER NOT NULL DEFAULT 0,
    matched_count INTEGER NOT NULL DEFAULT 0,
    difference_count INTEGER NOT NULL DEFAULT 0,
    total_amount DOUBLE PRECISION NOT NULL DEFAULT 0,
    difference_amount DOUBLE PRECISION NOT NULL DEFAULT 0,
    status VARCHAR(20) NOT NULL DEFAULT '',
    error_message VARCHAR(500) NOT NULL DEFAULT '',
    completed_at TIMESTAMPTZ NULL
);

ALTER TABLE reconciliation_records
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ADD COLUMN IF NOT EXISTS reconcile_date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ADD COLUMN IF NOT EXISTS reconcile_type VARCHAR(30) NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS channel VARCHAR(20) NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS total_count INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS matched_count INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS difference_count INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS total_amount DOUBLE PRECISION NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS difference_amount DOUBLE PRECISION NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS status VARCHAR(20) NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS error_message VARCHAR(500) NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ NULL;

CREATE INDEX IF NOT EXISTS idx_reconciliation_records_reconcile_date
  ON reconciliation_records(reconcile_date);
CREATE INDEX IF NOT EXISTS idx_reconciliation_records_reconcile_type
  ON reconciliation_records(reconcile_type);
CREATE INDEX IF NOT EXISTS idx_reconciliation_records_status
  ON reconciliation_records(status);

CREATE TABLE IF NOT EXISTS reconciliation_differences (
    id BIGSERIAL PRIMARY KEY,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    reconciliation_id BIGINT NOT NULL DEFAULT 0,
    difference_type VARCHAR(30) NOT NULL DEFAULT '',
    out_trade_no VARCHAR(64) NOT NULL DEFAULT '',
    provider_trade_no VARCHAR(64) NOT NULL DEFAULT '',
    platform_amount DOUBLE PRECISION NOT NULL DEFAULT 0,
    channel_amount DOUBLE PRECISION NOT NULL DEFAULT 0,
    platform_status VARCHAR(30) NOT NULL DEFAULT '',
    channel_status VARCHAR(30) NOT NULL DEFAULT '',
    handle_status VARCHAR(20) NOT NULL DEFAULT 'pending',
    resolved BOOLEAN NOT NULL DEFAULT FALSE,
    resolved_at TIMESTAMPTZ NULL,
    resolved_by BIGINT NOT NULL DEFAULT 0,
    resolve_notes VARCHAR(500) NOT NULL DEFAULT '',
    ignore_reason VARCHAR(500) NOT NULL DEFAULT '',
    solution VARCHAR(500) NOT NULL DEFAULT ''
);

ALTER TABLE reconciliation_differences
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ADD COLUMN IF NOT EXISTS reconciliation_id BIGINT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS difference_type VARCHAR(30) NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS out_trade_no VARCHAR(64) NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS provider_trade_no VARCHAR(64) NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS platform_amount DOUBLE PRECISION NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS channel_amount DOUBLE PRECISION NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS platform_status VARCHAR(30) NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS channel_status VARCHAR(30) NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS handle_status VARCHAR(20) NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS resolved BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS resolved_at TIMESTAMPTZ NULL,
  ADD COLUMN IF NOT EXISTS resolved_by BIGINT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS resolve_notes VARCHAR(500) NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS ignore_reason VARCHAR(500) NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS solution VARCHAR(500) NOT NULL DEFAULT '';

UPDATE reconciliation_differences
SET handle_status = 'resolved'
WHERE resolved = TRUE AND (handle_status IS NULL OR handle_status = 'pending');

UPDATE reconciliation_differences
SET handle_status = 'pending'
WHERE resolved = FALSE AND (handle_status IS NULL OR handle_status = '');

CREATE INDEX IF NOT EXISTS idx_reconciliation_differences_reconciliation_id
  ON reconciliation_differences(reconciliation_id);
CREATE INDEX IF NOT EXISTS idx_reconciliation_differences_out_trade_no
  ON reconciliation_differences(out_trade_no);
CREATE INDEX IF NOT EXISTS idx_reconciliation_differences_provider_trade_no
  ON reconciliation_differences(provider_trade_no);
CREATE INDEX IF NOT EXISTS idx_reconciliation_differences_handle_status
  ON reconciliation_differences(handle_status);
CREATE INDEX IF NOT EXISTS idx_reconciliation_differences_resolved
  ON reconciliation_differences(resolved);

COMMIT;
