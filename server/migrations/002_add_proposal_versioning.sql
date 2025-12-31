-- Migration: Add proposal version management fields
-- Purpose: Support proposal resubmission with v2/v3 versions after rejection

ALTER TABLE proposals
    ADD COLUMN version INT DEFAULT 1,
    ADD COLUMN parent_proposal_id BIGINT,
    ADD COLUMN rejection_count INT DEFAULT 0,
    ADD COLUMN rejection_reason TEXT,
    ADD COLUMN rejected_at TIMESTAMP,
    ADD COLUMN submitted_at TIMESTAMP,
    ADD COLUMN user_response_deadline TIMESTAMP;

-- Add indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_proposals_parent_proposal_id ON proposals(parent_proposal_id);
CREATE INDEX IF NOT EXISTS idx_proposals_submitted_at ON proposals(submitted_at);
CREATE INDEX IF NOT EXISTS idx_proposals_booking_version ON proposals(booking_id, version);

-- Update existing data with default values
UPDATE proposals SET submitted_at = created_at WHERE submitted_at IS NULL;
UPDATE proposals SET user_response_deadline = created_at + INTERVAL '14 days'
WHERE status = 1 AND user_response_deadline IS NULL;

-- Add comments for documentation
COMMENT ON COLUMN proposals.version IS 'Proposal version number (1, 2, 3, etc.)';
COMMENT ON COLUMN proposals.parent_proposal_id IS 'References the previous version of this proposal';
COMMENT ON COLUMN proposals.rejection_count IS 'Number of times proposals for this booking have been rejected';
COMMENT ON COLUMN proposals.rejection_reason IS 'User-provided reason for rejection';
COMMENT ON COLUMN proposals.rejected_at IS 'Timestamp when proposal was rejected';
COMMENT ON COLUMN proposals.submitted_at IS 'Timestamp when proposal was submitted by merchant';
COMMENT ON COLUMN proposals.user_response_deadline IS '14-day deadline for user to confirm/reject';
