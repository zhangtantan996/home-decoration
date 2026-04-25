-- v1.13.7: 为变更单增项支付计划补齐强关联，避免通过标题软匹配串单

ALTER TABLE payment_plans
    ADD COLUMN IF NOT EXISTS change_order_id bigint;

CREATE INDEX IF NOT EXISTS idx_payment_plans_change_order_id
    ON payment_plans(change_order_id);

WITH raw_matches AS (
    SELECT
        payment_plans.id AS payment_plan_id,
        change_orders.id AS change_order_id
    FROM payment_plans
    JOIN orders
        ON orders.id = payment_plans.order_id
       AND orders.order_type = 'construction'
    JOIN change_orders
        ON change_orders.project_id = orders.project_id
       AND change_orders.amount_impact > 0
       AND payment_plans.type = 'change_order'
       AND payment_plans.name = change_orders.title
       AND ABS(payment_plans.amount - change_orders.amount_impact) < 0.0001
    WHERE payment_plans.change_order_id IS NULL
),
unique_plan_matches AS (
    SELECT
        payment_plan_id,
        MAX(change_order_id) AS change_order_id
    FROM raw_matches
    GROUP BY payment_plan_id
    HAVING COUNT(*) = 1
),
unique_change_order_matches AS (
    SELECT
        change_order_id,
        MAX(payment_plan_id) AS payment_plan_id
    FROM raw_matches
    GROUP BY change_order_id
    HAVING COUNT(*) = 1
)
UPDATE payment_plans
SET change_order_id = unique_plan_matches.change_order_id
FROM unique_plan_matches
JOIN unique_change_order_matches
    ON unique_change_order_matches.change_order_id = unique_plan_matches.change_order_id
   AND unique_change_order_matches.payment_plan_id = unique_plan_matches.payment_plan_id
WHERE payment_plans.id = unique_plan_matches.payment_plan_id
  AND payment_plans.change_order_id IS NULL;
