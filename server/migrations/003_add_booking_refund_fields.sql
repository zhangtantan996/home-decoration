-- Migration: Add refund tracking fields to bookings table
-- Purpose: Track intent fee refunds for timeout and rejection scenarios

ALTER TABLE bookings
    ADD COLUMN intent_fee_refunded BOOLEAN DEFAULT FALSE,
    ADD COLUMN intent_fee_refund_reason VARCHAR(200),
    ADD COLUMN intent_fee_refunded_at TIMESTAMP,
    ADD COLUMN merchant_response_deadline TIMESTAMP;

-- Add index for cron job queries
CREATE INDEX IF NOT EXISTS idx_bookings_merchant_deadline ON bookings(merchant_response_deadline)
WHERE status = 1 AND intent_fee_paid = TRUE AND intent_fee_refunded = FALSE;

CREATE INDEX IF NOT EXISTS idx_bookings_refund_status ON bookings(intent_fee_refunded)
WHERE intent_fee_paid = TRUE;

-- Update existing data: Set 48-hour deadline for pending bookings
UPDATE bookings
SET merchant_response_deadline = created_at + INTERVAL '48 hours'
WHERE intent_fee_paid = TRUE
  AND merchant_response_deadline IS NULL
  AND status = 1;

-- Add comments for documentation
COMMENT ON COLUMN bookings.intent_fee_refunded IS 'Whether intent fee has been refunded to user';
COMMENT ON COLUMN bookings.intent_fee_refund_reason IS 'Reason for refund (timeout, rejection, etc.)';
COMMENT ON COLUMN bookings.intent_fee_refunded_at IS 'Timestamp when refund was processed';
COMMENT ON COLUMN bookings.merchant_response_deadline IS '48-hour deadline for merchant to respond';
