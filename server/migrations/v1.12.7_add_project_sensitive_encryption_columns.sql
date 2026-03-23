ALTER TABLE projects
    ADD COLUMN IF NOT EXISTS address_encrypted TEXT,
    ADD COLUMN IF NOT EXISTS latitude_encrypted TEXT,
    ADD COLUMN IF NOT EXISTS longitude_encrypted TEXT;

ALTER TABLE bookings
    ADD COLUMN IF NOT EXISTS address_encrypted TEXT,
    ADD COLUMN IF NOT EXISTS phone_encrypted TEXT,
    ADD COLUMN IF NOT EXISTS notes_encrypted TEXT;
