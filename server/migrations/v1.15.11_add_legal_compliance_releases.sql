-- v1.15.11: 内容合规协议包发布记录

CREATE TABLE IF NOT EXISTS legal_compliance_releases (
    id BIGSERIAL PRIMARY KEY,
    version VARCHAR(40),
    effective_at TIMESTAMPTZ,
    published_at TIMESTAMPTZ,
    published_by_admin_id BIGINT NOT NULL DEFAULT 0,
    documents_json TEXT NOT NULL DEFAULT '[]',
    content_hash VARCHAR(64) NOT NULL DEFAULT '',
    change_summary TEXT,
    reason TEXT,
    status VARCHAR(20) NOT NULL DEFAULT 'draft',
    legacy_imported BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_legal_releases_status_effective
    ON legal_compliance_releases (status, effective_at DESC, published_at DESC);
CREATE INDEX IF NOT EXISTS idx_legal_releases_content_hash
    ON legal_compliance_releases (content_hash);

CREATE UNIQUE INDEX IF NOT EXISTS uq_legal_releases_draft
    ON legal_compliance_releases (status)
    WHERE status = 'draft';

CREATE UNIQUE INDEX IF NOT EXISTS uq_legal_releases_published_version
    ON legal_compliance_releases (version)
    WHERE status = 'published' AND version IS NOT NULL AND version <> '';

WITH meta AS (
    SELECT
        COALESCE(NULLIF((SELECT value FROM system_configs WHERE key = 'public.legal_version' LIMIT 1), ''), 'v1.0.0-' || TO_CHAR(CURRENT_DATE, 'YYYYMMDD')) AS version,
        CASE
            WHEN COALESCE((SELECT value FROM system_configs WHERE key = 'public.legal_effective_date' LIMIT 1), '') ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$'
                THEN ((SELECT value FROM system_configs WHERE key = 'public.legal_effective_date' LIMIT 1)::DATE)::TIMESTAMPTZ
            ELSE CURRENT_DATE::TIMESTAMPTZ
        END AS effective_at
),
docs AS (
    SELECT jsonb_build_array(
        jsonb_build_object('slug', 'user-agreement', 'title', '禾泽云用户服务协议', 'category', '公开侧', 'content', COALESCE((SELECT value FROM system_configs WHERE key = 'public.user_agreement' LIMIT 1), '')),
        jsonb_build_object('slug', 'privacy-policy', 'title', '禾泽云隐私政策', 'category', '公开侧', 'content', COALESCE((SELECT value FROM system_configs WHERE key = 'public.privacy_policy' LIMIT 1), '')),
        jsonb_build_object('slug', 'personal-info-collection-list', 'title', '个人信息收集清单', 'category', '公开侧', 'content', COALESCE((SELECT value FROM system_configs WHERE key = 'public.personal_info_collection_list' LIMIT 1), '')),
        jsonb_build_object('slug', 'transaction-rules', 'title', '轻预约服务规则', 'category', '公开侧', 'content', COALESCE((SELECT value FROM system_configs WHERE key = 'public.transaction_rules' LIMIT 1), '')),
        jsonb_build_object('slug', 'refund-rules', 'title', '预约反馈与服务说明', 'category', '公开侧', 'content', COALESCE((SELECT value FROM system_configs WHERE key = 'public.refund_rules' LIMIT 1), '')),
        jsonb_build_object('slug', 'merchant-rules', 'title', '服务商展示规则', 'category', '公开侧', 'content', COALESCE((SELECT value FROM system_configs WHERE key = 'public.merchant_onboarding' LIMIT 1), '')),
        jsonb_build_object('slug', 'merchant-onboarding-agreement', 'title', '服务商资料授权与展示协议', 'category', '服务商侧', 'content', COALESCE((SELECT value FROM system_configs WHERE key = 'public.merchant_onboarding_agreement' LIMIT 1), '')),
        jsonb_build_object('slug', 'platform-rules', 'title', '服务商展示平台规则', 'category', '服务商侧', 'content', COALESCE((SELECT value FROM system_configs WHERE key = 'public.platform_rules' LIMIT 1), '')),
        jsonb_build_object('slug', 'privacy-data-processing', 'title', '服务商资料与数据处理条款', 'category', '服务商侧', 'content', COALESCE((SELECT value FROM system_configs WHERE key = 'public.privacy_data_processing' LIMIT 1), '')),
        jsonb_build_object('slug', 'third-party-sharing', 'title', '第三方信息共享清单', 'category', '公开侧', 'content', COALESCE((SELECT value FROM system_configs WHERE key = 'public.third_party_sharing' LIMIT 1), ''))
    ) AS documents_json
)
INSERT INTO legal_compliance_releases (
    version,
    effective_at,
    published_at,
    documents_json,
    content_hash,
    change_summary,
    reason,
    status,
    legacy_imported,
    created_at,
    updated_at
)
SELECT
    meta.version,
    meta.effective_at,
    meta.effective_at,
    docs.documents_json::TEXT,
    md5(docs.documents_json::TEXT),
    '从历史系统配置回填',
    'legacy import',
    'published',
    TRUE,
    NOW(),
    NOW()
FROM meta, docs
WHERE (
    SELECT COUNT(*)
    FROM system_configs
    WHERE key IN (
        'public.user_agreement',
        'public.privacy_policy',
        'public.personal_info_collection_list',
        'public.transaction_rules',
        'public.refund_rules',
        'public.merchant_onboarding',
        'public.merchant_onboarding_agreement',
        'public.platform_rules',
        'public.privacy_data_processing',
        'public.third_party_sharing'
    )
) = 10
  AND NOT EXISTS (SELECT 1 FROM legal_compliance_releases WHERE legacy_imported = TRUE);
