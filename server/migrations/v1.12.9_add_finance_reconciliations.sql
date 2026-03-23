CREATE TABLE IF NOT EXISTS finance_reconciliations (
    id BIGSERIAL PRIMARY KEY,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    reconcile_date DATE NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'success',
    finding_count INTEGER NOT NULL DEFAULT 0,
    summary_json JSONB NOT NULL DEFAULT '{}'::jsonb,
    findings_json JSONB NOT NULL DEFAULT '[]'::jsonb,
    owner_admin_id BIGINT NOT NULL DEFAULT 0,
    owner_note TEXT NOT NULL DEFAULT '',
    resolved_by_admin_id BIGINT NOT NULL DEFAULT 0,
    resolution_note TEXT NOT NULL DEFAULT '',
    resolved_at TIMESTAMPTZ,
    last_run_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_finance_reconciliations_reconcile_date
    ON finance_reconciliations (reconcile_date);

CREATE INDEX IF NOT EXISTS idx_finance_reconciliations_status
    ON finance_reconciliations (status);

CREATE INDEX IF NOT EXISTS idx_finance_reconciliations_owner_admin_id
    ON finance_reconciliations (owner_admin_id);
