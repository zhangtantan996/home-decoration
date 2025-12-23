-- Add sub_type column to providers table
ALTER TABLE providers ADD COLUMN sub_type VARCHAR(20) DEFAULT '';
COMMENT ON COLUMN providers.sub_type IS '子类型: personal(个人), studio(工作室), company(公司)';

-- Update existing records randomly or default to personal for now
UPDATE providers SET sub_type = 'personal' WHERE sub_type = '';
