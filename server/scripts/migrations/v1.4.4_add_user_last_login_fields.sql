-- Add user login audit fields if missing.
ALTER TABLE users
    ADD COLUMN IF NOT EXISTS last_login_at TIMESTAMP;

ALTER TABLE users
    ADD COLUMN IF NOT EXISTS last_login_ip VARCHAR(50);

COMMENT ON COLUMN users.last_login_at IS '最后登录时间';
COMMENT ON COLUMN users.last_login_ip IS '最后登录IP';
