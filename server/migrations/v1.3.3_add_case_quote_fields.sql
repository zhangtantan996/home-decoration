-- 为 provider_cases / case_audits 添加报价字段（总价分 + 明细 JSONB）
-- 注意：本需求为“登录可查看，不提供下载”，报价明细通过 API 返回并在 App 内渲染

ALTER TABLE provider_cases
  ADD COLUMN IF NOT EXISTS quote_total_cent BIGINT DEFAULT 0,
  ADD COLUMN IF NOT EXISTS quote_currency VARCHAR(10) DEFAULT 'CNY',
  ADD COLUMN IF NOT EXISTS quote_items JSONB DEFAULT '[]'::jsonb;

ALTER TABLE case_audits
  ADD COLUMN IF NOT EXISTS quote_total_cent BIGINT DEFAULT 0,
  ADD COLUMN IF NOT EXISTS quote_currency VARCHAR(10) DEFAULT 'CNY',
  ADD COLUMN IF NOT EXISTS quote_items JSONB DEFAULT '[]'::jsonb;

COMMENT ON COLUMN provider_cases.quote_total_cent IS '报价总计（分）';
COMMENT ON COLUMN provider_cases.quote_currency IS '币种（默认 CNY）';
COMMENT ON COLUMN provider_cases.quote_items IS '报价明细（JSONB 数组）';

COMMENT ON COLUMN case_audits.quote_total_cent IS '报价总计（分，审核快照）';
COMMENT ON COLUMN case_audits.quote_currency IS '币种（默认 CNY，审核快照）';
COMMENT ON COLUMN case_audits.quote_items IS '报价明细（JSONB 数组，审核快照）';

