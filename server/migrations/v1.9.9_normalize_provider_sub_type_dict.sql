-- v1.9.9 统一“商家类型”字典口径
-- 目标：
-- 1. 将 provider_sub_type 字典从主体/申请人维度（personal/studio/company）
--    统一为商家角色维度（designer/foreman/company/material_shop）
-- 2. 保持字典管理页与商家管理口径一致

BEGIN;

UPDATE dictionary_categories
SET
  name = '商家角色',
  description = '设计师、工长、装修公司、主材商等商家角色类型',
  updated_at = NOW()
WHERE code = 'provider_sub_type';

-- 设计师
UPDATE system_dictionaries
SET
  value = 'designer',
  label = '设计师',
  description = '设计服务商',
  sort_order = 1,
  enabled = true,
  updated_at = NOW()
WHERE category_code = 'provider_sub_type' AND id = 36;

-- 工长
UPDATE system_dictionaries
SET
  value = 'foreman',
  label = '工长',
  description = '独立施工负责人',
  sort_order = 2,
  enabled = true,
  updated_at = NOW()
WHERE category_code = 'provider_sub_type' AND id = 37;

-- 装修公司
UPDATE system_dictionaries
SET
  value = 'company',
  label = '装修公司',
  description = '正规装修公司',
  sort_order = 3,
  enabled = true,
  updated_at = NOW()
WHERE category_code = 'provider_sub_type' AND id = 38;

-- 主材商
INSERT INTO system_dictionaries (
  category_code,
  value,
  label,
  description,
  sort_order,
  enabled,
  created_at,
  updated_at
)
SELECT
  'provider_sub_type',
  'material_shop',
  '主材商',
  '主材经营商家',
  4,
  true,
  NOW(),
  NOW()
WHERE NOT EXISTS (
  SELECT 1
  FROM system_dictionaries
  WHERE category_code = 'provider_sub_type'
    AND value = 'material_shop'
);

COMMIT;
