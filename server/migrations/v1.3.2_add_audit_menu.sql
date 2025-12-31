-- 插入作品审核菜单
INSERT INTO sys_menus (parent_id, title, type, path, component, icon, sort, visible, status, created_at, updated_at)
VALUES (20, '作品审核', 2, '/audits/cases', 'audits/CaseAudits', 'FileTextOutlined', 5, true, 1, NOW(), NOW());

-- 赋予超级管理员权限 (Role ID = 1)
INSERT INTO sys_role_menus (role_id, menu_id)
SELECT 1, id FROM sys_menus WHERE path = '/audits/cases';
