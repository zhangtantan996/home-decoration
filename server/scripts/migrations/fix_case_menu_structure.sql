-- 修复作品管理菜单结构
-- 将其从单一菜单项改为"目录-子菜单"结构，以统一UI风格

DO $$
DECLARE
    -- 定义变量
    parent_menu_id BIGINT;
    child_menu_id BIGINT;
    superuser_role_id BIGINT := 1;
    admin_role_id BIGINT := 8;
BEGIN
    ---------- 1. 清理旧数据 (清理之前可能残留的错误数据) ----------
    RAISE NOTICE '正在清理旧数据...';
    
    -- 删除原来的关联权限
    DELETE FROM sys_role_menus 
    WHERE menu_id IN (
        SELECT id FROM sys_menus 
        WHERE path IN ('/cases', '/audits/cases', '/cases/manage') 
           OR title IN ('作品管理', '作品列表')
    );

    -- 删除原来的菜单记录
    DELETE FROM sys_menus 
    WHERE path IN ('/cases', '/audits/cases', '/cases/manage') 
       OR title IN ('作品管理', '作品列表');


    ---------- 2. 创建父级目录 "作品管理" ----------
    RAISE NOTICE '正在创建父级目录...';

    INSERT INTO sys_menus (
        parent_id, title, type, permission, path, component, icon, sort, visible, status, created_at, updated_at
    )
    VALUES (
        0,                      -- 根节点
        '作品管理',              -- 标题
        1,                      -- 类型 1=目录
        'system:case:list',     -- 权限标识
        '/cases',               -- 路径
        'Layout',               -- 组件 (目录通常为 Layout)
        'FileImageOutlined',    -- 图标 (确保前端已映射)
        50,                     -- 排序
        true,                   -- 可见
        1,                      -- 启用
        NOW(), NOW()
    )
    RETURNING id INTO parent_menu_id;


    ---------- 3. 创建子菜单 "作品列表" ----------
    RAISE NOTICE '正在创建子菜单...';

    IF parent_menu_id IS NOT NULL THEN
        INSERT INTO sys_menus (
            parent_id, title, type, permission, path, component, icon, sort, visible, status, created_at, updated_at
        )
        VALUES (
            parent_menu_id,         -- 父ID
            '作品列表',              -- 标题
            2,                      -- 类型 2=菜单
            'system:case:view',     -- 权限标识
            '/cases/manage',        -- 对应前端路由
            '/cases/CaseManagement',-- 组件路径 (仅作记录)
            'UnorderedListOutlined',-- 图标
            1,                      -- 排序
            true,                   -- 可见
            1,                      -- 启用
            NOW(), NOW()
        )
        RETURNING id INTO child_menu_id;
    END IF;


    ---------- 4. 分配权限 ----------
    RAISE NOTICE '正在分配权限...';

    IF child_menu_id IS NOT NULL THEN
        -- 给超级管理员 (ID 1) 分配父子菜单权限
        INSERT INTO sys_role_menus (role_id, menu_id) VALUES (superuser_role_id, parent_menu_id);
        INSERT INTO sys_role_menus (role_id, menu_id) VALUES (superuser_role_id, child_menu_id);

        -- 给普通管理员 (ID 8) 分配父子菜单权限 (如果该角色存在)
        IF EXISTS (SELECT 1 FROM sys_roles WHERE id = admin_role_id) THEN
            INSERT INTO sys_role_menus (role_id, menu_id) VALUES (admin_role_id, parent_menu_id);
            INSERT INTO sys_role_menus (role_id, menu_id) VALUES (admin_role_id, child_menu_id);
        END IF;

        RAISE NOTICE '✅ 菜单重构完成！';
        RAISE NOTICE '父菜单ID: %, 子菜单ID: %', parent_menu_id, child_menu_id;
    ELSE
        RAISE EXCEPTION '❌ 创建菜单失败';
    END IF;

END $$;
