-- 轻预约试运营线索跟进字段
-- 说明：不新增线索主表，预约线索继续落 bookings，智能报价线索继续落 quote_inquiries。

DO $$
DECLARE
  bookings_had_follow_status BOOLEAN;
  quote_inquiries_had_follow_status BOOLEAN;
BEGIN
  SELECT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'bookings'
      AND column_name = 'follow_status'
  ) INTO bookings_had_follow_status;

  ALTER TABLE bookings
    ADD COLUMN IF NOT EXISTS follow_status VARCHAR(32) NOT NULL DEFAULT 'pending_contact',
    ADD COLUMN IF NOT EXISTS lead_quality VARCHAR(32) NOT NULL DEFAULT 'unknown',
    ADD COLUMN IF NOT EXISTS assigned_admin_id BIGINT NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS next_follow_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS invalid_reason VARCHAR(300) NOT NULL DEFAULT '',
    ADD COLUMN IF NOT EXISTS converted_project_id BIGINT NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS source_type VARCHAR(32) NOT NULL DEFAULT 'mini_booking',
    ADD COLUMN IF NOT EXISTS source_id BIGINT NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS last_followed_at TIMESTAMPTZ;

  IF NOT bookings_had_follow_status THEN
    UPDATE bookings
    SET follow_status = CASE
      WHEN status = 2 THEN 'contacted'
      WHEN status = 3 THEN 'closed'
      WHEN status = 4 THEN 'closed'
      ELSE 'pending_contact'
    END;
  END IF;

  SELECT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'quote_inquiries'
      AND column_name = 'follow_status'
  ) INTO quote_inquiries_had_follow_status;

  ALTER TABLE quote_inquiries
    ADD COLUMN IF NOT EXISTS follow_status VARCHAR(32) NOT NULL DEFAULT 'pending_booking',
    ADD COLUMN IF NOT EXISTS assigned_admin_id BIGINT NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS next_follow_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS invalid_reason VARCHAR(300) NOT NULL DEFAULT '',
    ADD COLUMN IF NOT EXISTS last_followed_at TIMESTAMPTZ;

  IF NOT quote_inquiries_had_follow_status THEN
    UPDATE quote_inquiries
    SET follow_status = CASE
      WHEN conversion_status = 'converted' THEN 'converted_booking'
      WHEN conversion_status = 'closed' THEN 'closed'
      ELSE 'pending_booking'
    END;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_bookings_follow_status ON bookings(follow_status);
CREATE INDEX IF NOT EXISTS idx_bookings_lead_quality ON bookings(lead_quality);
CREATE INDEX IF NOT EXISTS idx_bookings_assigned_admin_id ON bookings(assigned_admin_id);
CREATE INDEX IF NOT EXISTS idx_bookings_next_follow_at ON bookings(next_follow_at);
CREATE INDEX IF NOT EXISTS idx_bookings_converted_project_id ON bookings(converted_project_id);
CREATE INDEX IF NOT EXISTS idx_bookings_source_type_source_id ON bookings(source_type, source_id);

CREATE INDEX IF NOT EXISTS idx_quote_inquiries_follow_status ON quote_inquiries(follow_status);
CREATE INDEX IF NOT EXISTS idx_quote_inquiries_assigned_admin_id ON quote_inquiries(assigned_admin_id);
CREATE INDEX IF NOT EXISTS idx_quote_inquiries_next_follow_at ON quote_inquiries(next_follow_at);
