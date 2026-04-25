BEGIN;

ALTER TABLE bookings
  ADD COLUMN IF NOT EXISTS survey_deposit_status VARCHAR(30);

UPDATE bookings
SET survey_deposit_status = CASE
  WHEN survey_deposit_refunded IS TRUE THEN 'refunded'
  WHEN survey_deposit_paid IS TRUE THEN 'paid'
  WHEN status = 4 THEN 'cancelled'
  ELSE 'pending'
END
WHERE survey_deposit_status IS NULL
   OR survey_deposit_status = '';

ALTER TABLE bookings
  ALTER COLUMN survey_deposit_status SET DEFAULT 'pending',
  ALTER COLUMN survey_deposit_status SET NOT NULL;

CREATE INDEX IF NOT EXISTS idx_bookings_survey_deposit_status
  ON bookings(survey_deposit_status);

COMMIT;
