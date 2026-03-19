INSERT INTO dictionary_categories (code, name, description, sort_order, enabled, icon, created_at, updated_at)
VALUES ('provider_budget_range', '服务商预算区间', '用户侧找服务页预算筛选配置', 110, true, 'wallet', NOW(), NOW())
ON CONFLICT (code) DO UPDATE
SET name = EXCLUDED.name,
    description = EXCLUDED.description,
    sort_order = EXCLUDED.sort_order,
    enabled = EXCLUDED.enabled,
    icon = EXCLUDED.icon,
    updated_at = NOW();

INSERT INTO system_dictionaries (category_code, value, label, description, sort_order, enabled, extra_data, parent_value, created_at, updated_at)
VALUES
  ('provider_budget_range', 'low', '≤ ¥300/㎡', '基础预算区间', 10, true, '{"min":0,"max":300}'::jsonb, '', NOW(), NOW()),
  ('provider_budget_range', 'mid', '¥300-800/㎡', '品质预算区间', 20, true, '{"min":300,"max":800}'::jsonb, '', NOW(), NOW()),
  ('provider_budget_range', 'high', '≥ ¥800/㎡', '高端预算区间', 30, true, '{"min":800,"max":null}'::jsonb, '', NOW(), NOW())
ON CONFLICT DO NOTHING;
