ALTER TABLE projects
    ADD COLUMN IF NOT EXISTS paused_at TIMESTAMPTZ NULL,
    ADD COLUMN IF NOT EXISTS resumed_at TIMESTAMPTZ NULL,
    ADD COLUMN IF NOT EXISTS pause_reason TEXT NOT NULL DEFAULT '',
    ADD COLUMN IF NOT EXISTS pause_initiator VARCHAR(20) NOT NULL DEFAULT '',
    ADD COLUMN IF NOT EXISTS disputed_at TIMESTAMPTZ NULL,
    ADD COLUMN IF NOT EXISTS dispute_reason TEXT NOT NULL DEFAULT '',
    ADD COLUMN IF NOT EXISTS dispute_evidence JSONB NOT NULL DEFAULT '[]'::jsonb;

CREATE TABLE IF NOT EXISTS refund_applications (
    id BIGSERIAL PRIMARY KEY,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    booking_id BIGINT NOT NULL DEFAULT 0,
    project_id BIGINT NOT NULL DEFAULT 0,
    order_id BIGINT NOT NULL DEFAULT 0,
    user_id BIGINT NOT NULL DEFAULT 0,
    refund_type VARCHAR(30) NOT NULL DEFAULT 'intent_fee',
    requested_amount DECIMAL(12,2) NOT NULL DEFAULT 0,
    approved_amount DECIMAL(12,2) NOT NULL DEFAULT 0,
    reason TEXT NOT NULL DEFAULT '',
    evidence JSONB NOT NULL DEFAULT '[]'::jsonb,
    status VARCHAR(20) NOT NULL DEFAULT 'pending',
    admin_id BIGINT NOT NULL DEFAULT 0,
    admin_notes TEXT NOT NULL DEFAULT '',
    approved_at TIMESTAMPTZ NULL,
    rejected_at TIMESTAMPTZ NULL,
    completed_at TIMESTAMPTZ NULL
);

CREATE INDEX IF NOT EXISTS idx_refund_applications_booking_id ON refund_applications(booking_id);
CREATE INDEX IF NOT EXISTS idx_refund_applications_project_id ON refund_applications(project_id);
CREATE INDEX IF NOT EXISTS idx_refund_applications_order_id ON refund_applications(order_id);
CREATE INDEX IF NOT EXISTS idx_refund_applications_user_id ON refund_applications(user_id);
CREATE INDEX IF NOT EXISTS idx_refund_applications_status ON refund_applications(status);
CREATE INDEX IF NOT EXISTS idx_refund_applications_refund_type ON refund_applications(refund_type);

CREATE TABLE IF NOT EXISTS project_audits (
    id BIGSERIAL PRIMARY KEY,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    project_id BIGINT NOT NULL DEFAULT 0,
    audit_type VARCHAR(20) NOT NULL DEFAULT 'dispute',
    status VARCHAR(20) NOT NULL DEFAULT 'pending',
    complaint_id BIGINT NOT NULL DEFAULT 0,
    refund_application_id BIGINT NOT NULL DEFAULT 0,
    audit_notes TEXT NOT NULL DEFAULT '',
    conclusion VARCHAR(30) NOT NULL DEFAULT '',
    conclusion_reason TEXT NOT NULL DEFAULT '',
    execution_plan JSONB NOT NULL DEFAULT '{}'::jsonb,
    admin_id BIGINT NOT NULL DEFAULT 0,
    completed_at TIMESTAMPTZ NULL
);

CREATE INDEX IF NOT EXISTS idx_project_audits_project_id ON project_audits(project_id);
CREATE INDEX IF NOT EXISTS idx_project_audits_status ON project_audits(status);
CREATE INDEX IF NOT EXISTS idx_project_audits_audit_type ON project_audits(audit_type);
CREATE INDEX IF NOT EXISTS idx_project_audits_complaint_id ON project_audits(complaint_id);
CREATE INDEX IF NOT EXISTS idx_project_audits_refund_application_id ON project_audits(refund_application_id);
