-- =============================================================================
-- Database Migration: Add Provider Fields
-- Version: v1.1.0
-- =============================================================================

-- Add new columns to providers table
ALTER TABLE providers ADD COLUMN IF NOT EXISTS years_experience INTEGER DEFAULT 0;
ALTER TABLE providers ADD COLUMN IF NOT EXISTS specialty VARCHAR(200) DEFAULT '';
ALTER TABLE providers ADD COLUMN IF NOT EXISTS work_types VARCHAR(100) DEFAULT '';
ALTER TABLE providers ADD COLUMN IF NOT EXISTS review_count INTEGER DEFAULT 0;
ALTER TABLE providers ADD COLUMN IF NOT EXISTS price_min DECIMAL(10,2) DEFAULT 0;
ALTER TABLE providers ADD COLUMN IF NOT EXISTS price_max DECIMAL(10,2) DEFAULT 0;
ALTER TABLE providers ADD COLUMN IF NOT EXISTS price_unit VARCHAR(20) DEFAULT '';

-- Verify migration
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'providers' 
  AND column_name IN ('years_experience', 'specialty', 'work_types', 'review_count', 'price_min', 'price_max', 'price_unit');
