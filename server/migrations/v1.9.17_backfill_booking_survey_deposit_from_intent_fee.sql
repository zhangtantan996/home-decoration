-- up
UPDATE bookings
SET survey_deposit = intent_fee
WHERE COALESCE(survey_deposit, 0) = 0
  AND COALESCE(intent_fee, 0) > 0;

UPDATE bookings
SET survey_deposit_paid = TRUE
WHERE intent_fee_paid = TRUE
  AND survey_deposit_paid IS DISTINCT FROM TRUE;

WITH paid_orders AS (
    SELECT
        biz_id AS booking_id,
        MAX(paid_at) AS paid_at
    FROM payment_orders
    WHERE biz_type IN ('booking_survey_deposit', 'booking_intent')
      AND status = 'paid'
      AND paid_at IS NOT NULL
    GROUP BY biz_id
)
UPDATE bookings AS b
SET survey_deposit_paid_at = COALESCE(b.survey_deposit_paid_at, paid_orders.paid_at)
FROM paid_orders
WHERE b.id = paid_orders.booking_id
  AND b.survey_deposit_paid = TRUE
  AND b.survey_deposit_paid_at IS NULL;

UPDATE bookings
SET survey_deposit_refunded = TRUE
WHERE intent_fee_refunded = TRUE
  AND survey_deposit_refunded IS DISTINCT FROM TRUE;

UPDATE bookings
SET survey_deposit_refund_at = COALESCE(survey_deposit_refund_at, intent_fee_refunded_at)
WHERE survey_deposit_refund_at IS NULL
  AND intent_fee_refunded_at IS NOT NULL;

UPDATE bookings
SET survey_deposit_refund_amt = survey_deposit
WHERE survey_deposit_refunded = TRUE
  AND COALESCE(survey_deposit_refund_amt, 0) = 0
  AND COALESCE(survey_deposit, 0) > 0;

UPDATE bookings
SET survey_deposit_source = 'legacy_migrated'
WHERE COALESCE(BTRIM(survey_deposit_source), '') = ''
  AND (
      COALESCE(intent_fee, 0) > 0
      OR intent_fee_paid = TRUE
      OR intent_fee_refunded = TRUE
  );

-- down
-- irreversibly backfills survey deposit compatibility fields from legacy intent fee data.
