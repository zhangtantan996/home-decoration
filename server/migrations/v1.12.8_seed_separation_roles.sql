INSERT INTO sys_roles (name, key, remark, sort, status, created_at, updated_at)
VALUES
    ('系统管理员', 'system_admin', '三员分立保留角色：负责系统配置与账号体系，必须独立分配', 70, 1, NOW(), NOW()),
    ('安全管理员', 'security_admin', '三员分立保留角色：负责安全策略与安全事件处置，必须独立分配', 71, 1, NOW(), NOW()),
    ('安全审计员', 'security_auditor', '三员分立保留角色：默认只读审计角色，必须独立分配', 72, 1, NOW(), NOW())
ON CONFLICT (key) DO UPDATE SET
    name = EXCLUDED.name,
    remark = EXCLUDED.remark,
    sort = EXCLUDED.sort,
    status = EXCLUDED.status,
    updated_at = NOW();
