BEGIN;

ALTER TABLE payment_orders
  ADD COLUMN IF NOT EXISTS amount_cent BIGINT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS refunded_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS refunded_amount_cent BIGINT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS refund_status VARCHAR(30) NOT NULL DEFAULT 'none';

ALTER TABLE refund_orders
  ADD COLUMN IF NOT EXISTS amount_cent BIGINT NOT NULL DEFAULT 0;

ALTER TABLE payment_plans
  ADD COLUMN IF NOT EXISTS amount_cent BIGINT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS refunded_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS refunded_amount_cent BIGINT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS refund_status VARCHAR(30) NOT NULL DEFAULT 'none';

ALTER TABLE settlement_orders
  ADD COLUMN IF NOT EXISTS gross_amount_cent BIGINT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS platform_fee_cent BIGINT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS merchant_net_amount_cent BIGINT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS recovery_amount_cent BIGINT NOT NULL DEFAULT 0;

ALTER TABLE payout_orders
  ADD COLUMN IF NOT EXISTS amount_cent BIGINT NOT NULL DEFAULT 0;

ALTER TABLE merchant_incomes
  ADD COLUMN IF NOT EXISTS amount_cent BIGINT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS platform_fee_cent BIGINT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS net_amount_cent BIGINT NOT NULL DEFAULT 0;

ALTER TABLE merchant_withdraws
  ADD COLUMN IF NOT EXISTS amount_cent BIGINT NOT NULL DEFAULT 0;

UPDATE payment_orders
SET amount_cent = ROUND(COALESCE(amount, 0) * 100)::BIGINT
WHERE amount_cent = 0 AND COALESCE(amount, 0) <> 0;

UPDATE refund_orders
SET amount_cent = ROUND(COALESCE(amount, 0) * 100)::BIGINT
WHERE amount_cent = 0 AND COALESCE(amount, 0) <> 0;

UPDATE payment_plans
SET amount_cent = ROUND(COALESCE(amount, 0) * 100)::BIGINT
WHERE amount_cent = 0 AND COALESCE(amount, 0) <> 0;

UPDATE settlement_orders
SET
  gross_amount_cent = ROUND(COALESCE(gross_amount, 0) * 100)::BIGINT,
  platform_fee_cent = ROUND(COALESCE(platform_fee, 0) * 100)::BIGINT,
  merchant_net_amount_cent = ROUND(COALESCE(merchant_net_amount, 0) * 100)::BIGINT,
  recovery_amount_cent = ROUND(COALESCE(recovery_amount, 0) * 100)::BIGINT
WHERE gross_amount_cent = 0
   OR platform_fee_cent = 0
   OR merchant_net_amount_cent = 0
   OR recovery_amount_cent = 0;

UPDATE payout_orders
SET amount_cent = ROUND(COALESCE(amount, 0) * 100)::BIGINT
WHERE amount_cent = 0 AND COALESCE(amount, 0) <> 0;

UPDATE merchant_incomes
SET
  amount_cent = ROUND(COALESCE(amount, 0) * 100)::BIGINT,
  platform_fee_cent = ROUND(COALESCE(platform_fee, 0) * 100)::BIGINT,
  net_amount_cent = ROUND(COALESCE(net_amount, 0) * 100)::BIGINT
WHERE amount_cent = 0
   OR platform_fee_cent = 0
   OR net_amount_cent = 0;

UPDATE merchant_withdraws
SET amount_cent = ROUND(COALESCE(amount, 0) * 100)::BIGINT
WHERE amount_cent = 0 AND COALESCE(amount, 0) <> 0;

WITH payment_refunds AS (
  SELECT payment_order_id, COALESCE(SUM(amount), 0) AS refunded_amount
  FROM refund_orders
  WHERE status = 'succeeded'
  GROUP BY payment_order_id
)
UPDATE payment_orders po
SET
  refunded_amount = ROUND(payment_refunds.refunded_amount::NUMERIC, 2),
  refunded_amount_cent = ROUND(payment_refunds.refunded_amount * 100)::BIGINT
FROM payment_refunds
WHERE po.id = payment_refunds.payment_order_id;

UPDATE payment_orders
SET refund_status = CASE
  WHEN refunded_amount_cent <= 0 THEN 'none'
  WHEN refunded_amount_cent >= amount_cent AND amount_cent > 0 THEN 'refunded'
  ELSE 'partial_refunded'
END;

WITH plan_refunds AS (
  SELECT p.biz_id AS payment_plan_id, COALESCE(SUM(r.amount), 0) AS refunded_amount
  FROM refund_orders r
  JOIN payment_orders p ON p.id = r.payment_order_id
  WHERE r.status = 'succeeded'
    AND p.biz_type = 'payment_plan'
  GROUP BY p.biz_id
)
UPDATE payment_plans pp
SET
  refunded_amount = ROUND(plan_refunds.refunded_amount::NUMERIC, 2),
  refunded_amount_cent = ROUND(plan_refunds.refunded_amount * 100)::BIGINT
FROM plan_refunds
WHERE pp.id = plan_refunds.payment_plan_id;

UPDATE payment_plans
SET refund_status = CASE
  WHEN refunded_amount_cent <= 0 THEN 'none'
  WHEN refunded_amount_cent >= amount_cent AND amount_cent > 0 THEN 'refunded'
  ELSE 'partial_refunded'
END;

CREATE INDEX IF NOT EXISTS idx_payment_orders_refund_status
  ON payment_orders(refund_status);

CREATE INDEX IF NOT EXISTS idx_payment_plans_refund_status
  ON payment_plans(refund_status);

COMMIT;
