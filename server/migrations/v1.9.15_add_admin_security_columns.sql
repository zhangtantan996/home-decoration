BEGIN;

ALTER TABLE sys_admins
    ADD COLUMN IF NOT EXISTS must_reset_password BOOLEAN NOT NULL DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS password_changed_at TIMESTAMPTZ NULL,
    ADD COLUMN IF NOT EXISTS two_factor_enabled BOOLEAN NOT NULL DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS two_factor_secret TEXT NULL,
    ADD COLUMN IF NOT EXISTS two_factor_bound_at TIMESTAMPTZ NULL,
    ADD COLUMN IF NOT EXISTS disabled_reason TEXT NOT NULL DEFAULT '';

UPDATE sys_admins
SET disabled_reason = ''
WHERE disabled_reason IS NULL;

UPDATE sys_admins
SET password_changed_at = COALESCE(password_changed_at, last_login_at, updated_at, created_at, NOW())
WHERE password_changed_at IS NULL;

COMMIT;
