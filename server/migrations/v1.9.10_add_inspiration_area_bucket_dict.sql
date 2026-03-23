INSERT INTO dictionary_categories (code, name, description, sort_order, enabled, icon, created_at, updated_at)
VALUES ('inspiration_area_bucket', '灵感面积区间', '用户侧灵感案例页面积筛选配置', 120, true, 'appstore', NOW(), NOW())
ON CONFLICT (code) DO UPDATE
SET name = EXCLUDED.name,
    description = EXCLUDED.description,
    sort_order = EXCLUDED.sort_order,
    enabled = EXCLUDED.enabled,
    icon = EXCLUDED.icon,
    updated_at = NOW();

INSERT INTO system_dictionaries (category_code, value, label, description, sort_order, enabled, extra_data, parent_value, created_at, updated_at)
VALUES
  ('inspiration_area_bucket', 'small', '90㎡以下', '小户型面积段', 10, true, '{"min":0,"max":90}'::jsonb, '', NOW(), NOW()),
  ('inspiration_area_bucket', 'medium', '90-140㎡', '中等面积段', 20, true, '{"min":90,"max":140}'::jsonb, '', NOW(), NOW()),
  ('inspiration_area_bucket', 'large', '140㎡以上', '大户型面积段', 30, true, '{"min":140,"max":null}'::jsonb, '', NOW(), NOW())
ON CONFLICT DO NOTHING;
