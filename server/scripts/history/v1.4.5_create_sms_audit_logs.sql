-- LEGACY NOTICE: 历史版本化 schema 脚本，保留用于追溯，不再作为正式发布唯一依据。
-- sms_audit_logs 缺失时，当前正式补洞入口：server/migrations/v1.6.4_reconcile_auth_and_onboarding_schema.sql

-- Create SMS audit log table for send-code traceability and anti-fraud forensics.
CREATE TABLE IF NOT EXISTS sms_audit_logs (
    id BIGSERIAL PRIMARY KEY,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    request_id VARCHAR(64) NOT NULL,
    purpose VARCHAR(32) NOT NULL,
    phone_hash VARCHAR(64) NOT NULL,
    client_ip VARCHAR(64),
    provider VARCHAR(32),
    message_id VARCHAR(128),
    provider_request_id VARCHAR(128),
    status VARCHAR(32) NOT NULL,
    error_code VARCHAR(64),
    error_message VARCHAR(500)
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_sms_audit_logs_request_id ON sms_audit_logs(request_id);
CREATE INDEX IF NOT EXISTS idx_sms_audit_logs_created_at ON sms_audit_logs(created_at);
CREATE INDEX IF NOT EXISTS idx_sms_audit_logs_purpose ON sms_audit_logs(purpose);
CREATE INDEX IF NOT EXISTS idx_sms_audit_logs_status ON sms_audit_logs(status);
CREATE INDEX IF NOT EXISTS idx_sms_audit_logs_phone_hash ON sms_audit_logs(phone_hash);

COMMENT ON TABLE sms_audit_logs IS '短信发送审计日志（不落明文手机号）';
COMMENT ON COLUMN sms_audit_logs.request_id IS '请求唯一标识，用于接口追踪';
COMMENT ON COLUMN sms_audit_logs.purpose IS '验证码场景';
COMMENT ON COLUMN sms_audit_logs.phone_hash IS '手机号哈希（不可逆）';
COMMENT ON COLUMN sms_audit_logs.status IS '发送状态 sent/send_failed/store_failed/risk_blocked/captcha_failed';
