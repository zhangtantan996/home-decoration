-- v1.10.9 设计前链路：量房定金、方案分层交付、设计费支付配置

ALTER TABLE providers
    ADD COLUMN IF NOT EXISTS survey_deposit_price NUMERIC DEFAULT 0;

ALTER TABLE bookings
    ADD COLUMN IF NOT EXISTS survey_deposit_source VARCHAR(50) DEFAULT '',
    ADD COLUMN IF NOT EXISTS survey_refund_notice TEXT DEFAULT '';

ALTER TABLE proposals
    ADD COLUMN IF NOT EXISTS internal_draft_json TEXT DEFAULT '{}',
    ADD COLUMN IF NOT EXISTS preview_package_json TEXT DEFAULT '{}',
    ADD COLUMN IF NOT EXISTS delivery_package_json TEXT DEFAULT '{}';

INSERT INTO system_configs ("key", value, type, description, editable, created_at, updated_at)
SELECT 'booking.survey_deposit_default', '500', 'number', '量房定金默认金额（元）', TRUE, NOW(), NOW()
WHERE NOT EXISTS (SELECT 1 FROM system_configs WHERE "key" = 'booking.survey_deposit_default');

INSERT INTO system_configs ("key", value, type, description, editable, created_at, updated_at)
SELECT 'booking.survey_refund_notice',
       '量房完成后若不继续设计，默认退回 60% 给用户，剩余 40% 冻结待平台判定；若后续确认设计方案，量房定金转为设计费的一部分。',
       'string',
       '量房定金退款说明文案',
       TRUE,
       NOW(),
       NOW()
WHERE NOT EXISTS (SELECT 1 FROM system_configs WHERE "key" = 'booking.survey_refund_notice');

INSERT INTO system_configs ("key", value, type, description, editable, created_at, updated_at)
SELECT 'booking.survey_refund_user_percent', '60', 'number', '量房后终止时退给用户的百分比', TRUE, NOW(), NOW()
WHERE NOT EXISTS (SELECT 1 FROM system_configs WHERE "key" = 'booking.survey_refund_user_percent');

INSERT INTO system_configs ("key", value, type, description, editable, created_at, updated_at)
SELECT 'order.design_fee_payment_mode', 'onetime', 'string', '设计费支付模式：onetime / staged', TRUE, NOW(), NOW()
WHERE NOT EXISTS (SELECT 1 FROM system_configs WHERE "key" = 'order.design_fee_payment_mode');

INSERT INTO system_configs ("key", value, type, description, editable, created_at, updated_at)
SELECT 'order.design_fee_stages',
       '[{"name":"签约款","percentage":50},{"name":"终稿款","percentage":50}]',
       'json',
       '设计费分阶段付款配置',
       TRUE,
       NOW(),
       NOW()
WHERE NOT EXISTS (SELECT 1 FROM system_configs WHERE "key" = 'order.design_fee_stages');

INSERT INTO system_configs ("key", value, type, description, editable, created_at, updated_at)
SELECT 'order.construction_payment_mode', 'milestone', 'string', '施工费支付模式：milestone / onetime', TRUE, NOW(), NOW()
WHERE NOT EXISTS (SELECT 1 FROM system_configs WHERE "key" = 'order.construction_payment_mode');
