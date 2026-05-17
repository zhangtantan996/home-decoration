ALTER TABLE project_phases
  ADD COLUMN IF NOT EXISTS enabled BOOLEAN NOT NULL DEFAULT TRUE;

UPDATE project_phases
SET enabled = TRUE
WHERE enabled IS NULL;
