BEGIN;

INSERT INTO dictionary_categories (code, name, description, sort_order, enabled, created_at, updated_at)
SELECT 'open_service_provinces', '开放服务省份', '控制哪些省份下的已启用地级市对外开放', 13, true, NOW(), NOW()
WHERE NOT EXISTS (
  SELECT 1 FROM dictionary_categories WHERE code = 'open_service_provinces'
);

INSERT INTO dictionary_categories (code, name, description, sort_order, enabled, created_at, updated_at)
SELECT 'open_service_cities', '开放服务城市', '补充追加开放单个地级市', 14, true, NOW(), NOW()
WHERE NOT EXISTS (
  SELECT 1 FROM dictionary_categories WHERE code = 'open_service_cities'
);

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
  'open_service_provinces',
  '610000',
  '陕西省',
  '试点开放省份',
  1,
  true,
  NOW(),
  NOW()
WHERE NOT EXISTS (
  SELECT 1
  FROM system_dictionaries
  WHERE category_code = 'open_service_provinces'
    AND value = '610000'
);

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
  'open_service_cities',
  '610100',
  '西安市',
  '试点追加开放城市',
  1,
  true,
  NOW(),
  NOW()
WHERE NOT EXISTS (
  SELECT 1
  FROM system_dictionaries
  WHERE category_code = 'open_service_cities'
    AND value = '610100'
);

COMMIT;
