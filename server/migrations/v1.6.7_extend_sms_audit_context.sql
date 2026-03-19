-- Description: Extend sms_audit_logs with risk tier and template selection context

ALTER TABLE sms_audit_logs
    ADD COLUMN IF NOT EXISTS risk_tier VARCHAR(16) NOT NULL DEFAULT '';

ALTER TABLE sms_audit_logs
    ADD COLUMN IF NOT EXISTS template_key VARCHAR(64) NOT NULL DEFAULT '';

ALTER TABLE sms_audit_logs
    ADD COLUMN IF NOT EXISTS template_code VARCHAR(128) NOT NULL DEFAULT '';

COMMENT ON COLUMN sms_audit_logs.risk_tier IS '短信业务场景对应的风险等级';
COMMENT ON COLUMN sms_audit_logs.template_key IS '实际模板命中来源（purpose/risk/default）';
COMMENT ON COLUMN sms_audit_logs.template_code IS '实际下发模板编码';
