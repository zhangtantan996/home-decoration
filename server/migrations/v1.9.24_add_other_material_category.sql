INSERT INTO system_dictionaries (
  category_code,
  value,
  label,
  sort_order,
  enabled,
  created_at,
  updated_at
)
SELECT
  'material_category',
  '其他',
  '其他',
  11,
  true,
  NOW(),
  NOW()
WHERE NOT EXISTS (
  SELECT 1
  FROM system_dictionaries
  WHERE category_code = 'material_category'
    AND value = '其他'
);
