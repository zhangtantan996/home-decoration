BEGIN;

ALTER TABLE payment_orders
  ADD COLUMN IF NOT EXISTS fund_scene VARCHAR(40) NOT NULL DEFAULT '';

CREATE INDEX IF NOT EXISTS idx_payment_orders_fund_scene
  ON payment_orders(fund_scene);

ALTER TABLE refund_orders
  ADD COLUMN IF NOT EXISTS fund_scene VARCHAR(40) NOT NULL DEFAULT '';

CREATE INDEX IF NOT EXISTS idx_refund_orders_fund_scene
  ON refund_orders(fund_scene);

CREATE TABLE IF NOT EXISTS payout_orders (
  id BIGSERIAL PRIMARY KEY,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  biz_type VARCHAR(50) NOT NULL,
  biz_id BIGINT NOT NULL DEFAULT 0,
  provider_id BIGINT NOT NULL DEFAULT 0,
  amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  channel VARCHAR(20) NOT NULL DEFAULT 'custody',
  fund_scene VARCHAR(40) NOT NULL DEFAULT 'settlement_payout',
  out_payout_no VARCHAR(64) NOT NULL,
  provider_payout_no VARCHAR(64) NOT NULL DEFAULT '',
  status VARCHAR(20) NOT NULL DEFAULT 'created',
  scheduled_at TIMESTAMPTZ NULL,
  processing_at TIMESTAMPTZ NULL,
  paid_at TIMESTAMPTZ NULL,
  failure_reason VARCHAR(500) NOT NULL DEFAULT '',
  raw_response_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  retry_count INTEGER NOT NULL DEFAULT 0
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_payout_orders_out_payout_no
  ON payout_orders(out_payout_no);

CREATE INDEX IF NOT EXISTS idx_payout_orders_biz
  ON payout_orders(biz_type, biz_id);

CREATE INDEX IF NOT EXISTS idx_payout_orders_provider_status
  ON payout_orders(provider_id, status);

CREATE INDEX IF NOT EXISTS idx_payout_orders_scheduled_at
  ON payout_orders(scheduled_at);

CREATE TABLE IF NOT EXISTS ledger_accounts (
  id BIGSERIAL PRIMARY KEY,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  account_type VARCHAR(50) NOT NULL,
  provider_id BIGINT NOT NULL DEFAULT 0,
  project_id BIGINT NOT NULL DEFAULT 0,
  balance NUMERIC(14,2) NOT NULL DEFAULT 0,
  currency VARCHAR(10) NOT NULL DEFAULT 'CNY',
  last_entry_at TIMESTAMPTZ NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_ledger_accounts_scope
  ON ledger_accounts(account_type, provider_id, project_id);

CREATE TABLE IF NOT EXISTS ledger_entries (
  id BIGSERIAL PRIMARY KEY,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  fund_scene VARCHAR(40) NOT NULL,
  debit_account_id BIGINT NOT NULL DEFAULT 0,
  credit_account_id BIGINT NOT NULL DEFAULT 0,
  amount NUMERIC(14,2) NOT NULL DEFAULT 0,
  biz_type VARCHAR(50) NOT NULL DEFAULT '',
  biz_id BIGINT NOT NULL DEFAULT 0,
  runtime_type VARCHAR(50) NOT NULL DEFAULT '',
  runtime_id BIGINT NOT NULL DEFAULT 0,
  remark TEXT NOT NULL DEFAULT '',
  metadata_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ledger_entries_fund_scene
  ON ledger_entries(fund_scene);

CREATE INDEX IF NOT EXISTS idx_ledger_entries_runtime
  ON ledger_entries(runtime_type, runtime_id);

CREATE INDEX IF NOT EXISTS idx_ledger_entries_biz
  ON ledger_entries(biz_type, biz_id);

CREATE TABLE IF NOT EXISTS finance_reconciliation_items (
  id BIGSERIAL PRIMARY KEY,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  reconciliation_id BIGINT NOT NULL,
  item_type VARCHAR(40) NOT NULL DEFAULT '',
  code VARCHAR(80) NOT NULL DEFAULT '',
  level VARCHAR(20) NOT NULL DEFAULT 'warning',
  reference_type VARCHAR(40) NOT NULL DEFAULT '',
  reference_id BIGINT NOT NULL DEFAULT 0,
  message VARCHAR(500) NOT NULL DEFAULT '',
  expected_count BIGINT NOT NULL DEFAULT 0,
  actual_count BIGINT NOT NULL DEFAULT 0,
  expected_amount NUMERIC(14,2) NOT NULL DEFAULT 0,
  actual_amount NUMERIC(14,2) NOT NULL DEFAULT 0,
  detail_json JSONB NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_finance_reconciliation_items_reconciliation_id
  ON finance_reconciliation_items(reconciliation_id);

CREATE INDEX IF NOT EXISTS idx_finance_reconciliation_items_code
  ON finance_reconciliation_items(code);

ALTER TABLE merchant_incomes
  ADD COLUMN IF NOT EXISTS payout_order_id BIGINT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS payout_status VARCHAR(20) NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS payout_failed_reason VARCHAR(500) NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS payouted_at TIMESTAMPTZ NULL;

CREATE INDEX IF NOT EXISTS idx_merchant_incomes_payout_order_id
  ON merchant_incomes(payout_order_id);

CREATE INDEX IF NOT EXISTS idx_merchant_incomes_payout_status
  ON merchant_incomes(payout_status);

INSERT INTO system_configs (key, value, type, description, editable, created_at, updated_at)
VALUES
  ('payment.merchant_deposit_rules', '{"designer":{"enabled":false,"amount":0},"company":{"enabled":false,"amount":0},"foreman":{"enabled":false,"amount":0}}', 'json', '商家保证金规则(JSON)', true, NOW(), NOW()),
  ('payment.release_delay_days', '3', 'number', '支付中台统一T+N出款延迟天数', true, NOW(), NOW()),
  ('payment.payout_auto_enabled', 'true', 'boolean', '是否启用自动出款', true, NOW(), NOW())
ON CONFLICT (key) DO NOTHING;

COMMIT;
