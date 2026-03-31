BEGIN;

CREATE TABLE IF NOT EXISTS settlement_orders (
  id BIGSERIAL PRIMARY KEY,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ NULL,
  biz_type VARCHAR(50) NOT NULL DEFAULT '',
  biz_id BIGINT NOT NULL DEFAULT 0,
  project_id BIGINT NOT NULL DEFAULT 0,
  provider_id BIGINT NOT NULL DEFAULT 0,
  fund_scene VARCHAR(40) NOT NULL DEFAULT '',
  gross_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  platform_fee NUMERIC(12,2) NOT NULL DEFAULT 0,
  merchant_net_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  accepted_at TIMESTAMPTZ NULL,
  due_at TIMESTAMPTZ NULL,
  payout_order_id BIGINT NOT NULL DEFAULT 0,
  status VARCHAR(30) NOT NULL DEFAULT 'scheduled',
  failure_reason VARCHAR(500) NOT NULL DEFAULT '',
  recovery_status VARCHAR(30) NOT NULL DEFAULT 'none',
  recovery_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  metadata_json JSONB NOT NULL DEFAULT '{}'::jsonb
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_settlement_orders_biz
  ON settlement_orders (biz_type, biz_id);
CREATE INDEX IF NOT EXISTS idx_settlement_orders_provider_status
  ON settlement_orders (provider_id, status);
CREATE INDEX IF NOT EXISTS idx_settlement_orders_due_at
  ON settlement_orders (due_at);

ALTER TABLE merchant_incomes
  ADD COLUMN IF NOT EXISTS settlement_order_id BIGINT NOT NULL DEFAULT 0;
ALTER TABLE merchant_incomes
  ADD COLUMN IF NOT EXISTS settlement_status VARCHAR(30) NOT NULL DEFAULT '';

CREATE INDEX IF NOT EXISTS idx_merchant_incomes_settlement_order_id
  ON merchant_incomes (settlement_order_id);
CREATE INDEX IF NOT EXISTS idx_merchant_incomes_settlement_status
  ON merchant_incomes (settlement_status);

CREATE TABLE IF NOT EXISTS merchant_bond_rules (
  id BIGSERIAL PRIMARY KEY,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ NULL,
  provider_type SMALLINT NOT NULL DEFAULT 0,
  provider_sub_type VARCHAR(30) NOT NULL DEFAULT '',
  enabled BOOLEAN NOT NULL DEFAULT FALSE,
  rule_type VARCHAR(30) NOT NULL DEFAULT 'fixed_amount',
  fixed_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  ratio NUMERIC(10,4) NOT NULL DEFAULT 0,
  floor_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  cap_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  effective_from TIMESTAMPTZ NULL,
  effective_to TIMESTAMPTZ NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_merchant_bond_rules_scope
  ON merchant_bond_rules (provider_type, provider_sub_type);

CREATE TABLE IF NOT EXISTS merchant_bond_accounts (
  id BIGSERIAL PRIMARY KEY,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ NULL,
  provider_id BIGINT NOT NULL DEFAULT 0,
  required_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  paid_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  frozen_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  available_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  status VARCHAR(30) NOT NULL DEFAULT 'disabled',
  last_rule_id BIGINT NOT NULL DEFAULT 0
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_merchant_bond_accounts_provider_id
  ON merchant_bond_accounts (provider_id);
CREATE INDEX IF NOT EXISTS idx_merchant_bond_accounts_status
  ON merchant_bond_accounts (status);

INSERT INTO settlement_orders (
  created_at,
  updated_at,
  biz_type,
  biz_id,
  project_id,
  provider_id,
  fund_scene,
  gross_amount,
  platform_fee,
  merchant_net_amount,
  accepted_at,
  due_at,
  payout_order_id,
  status,
  failure_reason,
  recovery_status,
  recovery_amount,
  metadata_json
)
SELECT
  COALESCE(po.created_at, mi.created_at, NOW()),
  COALESCE(po.updated_at, mi.updated_at, NOW()),
  po.biz_type,
  po.biz_id,
  COALESCE(m.project_id, dd.project_id, o.project_id, 0) AS project_id,
  mi.provider_id,
  COALESCE(po.fund_scene, 'settlement_payout'),
  mi.amount,
  mi.platform_fee,
  mi.net_amount,
  COALESCE(m.accepted_at, dd.accepted_at, po.created_at),
  COALESCE(po.scheduled_at, m.release_scheduled_at, po.created_at),
  po.id,
  CASE
    WHEN po.status = 'paid' THEN 'paid'
    WHEN po.status = 'processing' THEN 'payout_processing'
    WHEN po.status = 'failed' THEN 'payout_failed'
    ELSE 'scheduled'
  END,
  COALESCE(po.failure_reason, ''),
  'none',
  0,
  jsonb_build_object('source', 'backfill_from_payout_orders')
FROM merchant_incomes mi
JOIN payout_orders po ON po.id = mi.payout_order_id
LEFT JOIN milestones m ON po.biz_type = 'milestone_release' AND po.biz_id = m.id
LEFT JOIN design_deliverables dd ON po.biz_type = 'design_deliverable' AND po.biz_id = dd.id
LEFT JOIN orders o ON mi.order_id = o.id
ON CONFLICT (biz_type, biz_id) DO NOTHING;

UPDATE merchant_incomes mi
SET
  settlement_order_id = so.id,
  settlement_status = so.status
FROM settlement_orders so
WHERE mi.payout_order_id = so.payout_order_id
  AND (mi.settlement_order_id = 0 OR mi.settlement_status = '');

COMMIT;
