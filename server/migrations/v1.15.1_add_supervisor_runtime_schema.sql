-- 监理运行时正式迁移：补监理白名单/申请/账号主链表以及 profile 账号桥接字段

CREATE TABLE IF NOT EXISTS supervisor_phone_whitelists (
    id BIGSERIAL PRIMARY KEY,
    phone VARCHAR(20) NOT NULL,
    status SMALLINT NOT NULL DEFAULT 1,
    expires_at TIMESTAMPTZ,
    note TEXT,
    created_by_admin_id BIGINT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'uq_supervisor_whitelist_phone'
    ) THEN
        ALTER TABLE supervisor_phone_whitelists
            ADD CONSTRAINT uq_supervisor_whitelist_phone UNIQUE (phone);
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_supervisor_whitelist_status_expires
    ON supervisor_phone_whitelists (status, expires_at);

CREATE TABLE IF NOT EXISTS supervisor_accounts (
    id BIGSERIAL PRIMARY KEY,
    phone VARCHAR(20) NOT NULL,
    status SMALLINT NOT NULL DEFAULT 1,
    last_login_at TIMESTAMPTZ,
    last_login_ip VARCHAR(50),
    login_failed_count INT NOT NULL DEFAULT 0,
    locked_until TIMESTAMPTZ,
    password_hash TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'uq_supervisor_account_phone'
    ) THEN
        ALTER TABLE supervisor_accounts
            ADD CONSTRAINT uq_supervisor_account_phone UNIQUE (phone);
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_supervisor_account_status_login
    ON supervisor_accounts (status, last_login_at DESC);

CREATE TABLE IF NOT EXISTS supervisor_applications (
    id BIGSERIAL PRIMARY KEY,
    phone VARCHAR(20) NOT NULL,
    whitelist_id BIGINT NOT NULL,
    status SMALLINT NOT NULL DEFAULT 0,
    form_json JSONB NOT NULL,
    reject_reason TEXT,
    reviewed_by_admin_id BIGINT,
    reviewed_at TIMESTAMPTZ,
    submitted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    supervisor_account_id BIGINT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_supervisor_applications_phone_status
    ON supervisor_applications (phone, status);
CREATE INDEX IF NOT EXISTS idx_supervisor_applications_status_submitted
    ON supervisor_applications (status, submitted_at DESC);

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'fk_supervisor_applications_whitelist_id'
    ) THEN
        ALTER TABLE supervisor_applications
            ADD CONSTRAINT fk_supervisor_applications_whitelist_id
            FOREIGN KEY (whitelist_id) REFERENCES supervisor_phone_whitelists(id)
            ON DELETE RESTRICT;
    END IF;
END $$;

ALTER TABLE supervisor_profiles ADD COLUMN IF NOT EXISTS supervisor_account_id BIGINT;

CREATE UNIQUE INDEX IF NOT EXISTS uq_supervisor_profiles_supervisor_account_id
    ON supervisor_profiles (supervisor_account_id)
    WHERE supervisor_account_id IS NOT NULL;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'fk_supervisor_profiles_supervisor_account_id'
    ) THEN
        ALTER TABLE supervisor_profiles
            ADD CONSTRAINT fk_supervisor_profiles_supervisor_account_id
            FOREIGN KEY (supervisor_account_id) REFERENCES supervisor_accounts(id)
            ON DELETE SET NULL;
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'fk_supervisor_applications_supervisor_account_id'
    ) THEN
        ALTER TABLE supervisor_applications
            ADD CONSTRAINT fk_supervisor_applications_supervisor_account_id
            FOREIGN KEY (supervisor_account_id) REFERENCES supervisor_accounts(id)
            ON DELETE SET NULL;
    END IF;
END $$;

DO $$
DECLARE
    supervisors_root_id BIGINT;
    supervisors_list_id BIGINT;
    supervisors_whitelist_id BIGINT;
    supervisors_applications_id BIGINT;
    supervisors_assignments_id BIGINT;
    supervisors_edit_id BIGINT;
    supervisors_assignment_manage_id BIGINT;
BEGIN
    PERFORM setval(
        pg_get_serial_sequence('sys_menus', 'id'),
        GREATEST(COALESCE((SELECT MAX(id) FROM sys_menus), 0) + 1, 1),
        false
    );

    SELECT id INTO supervisors_root_id
    FROM sys_menus
    WHERE path = '/supervisors'
    ORDER BY id ASC
    LIMIT 1;

    IF supervisors_root_id IS NULL THEN
        INSERT INTO sys_menus (parent_id, title, type, permission, path, component, icon, sort, visible, status, created_at, updated_at)
        VALUES (0, '监理管理', 1, '', '/supervisors', '', 'TeamOutlined', 59, TRUE, 1, NOW(), NOW())
        RETURNING id INTO supervisors_root_id;
    ELSE
        UPDATE sys_menus
        SET parent_id = 0,
            title = '监理管理',
            type = 1,
            permission = '',
            path = '/supervisors',
            component = '',
            icon = 'TeamOutlined',
            sort = 59,
            visible = TRUE,
            status = 1,
            updated_at = NOW()
        WHERE id = supervisors_root_id;
    END IF;

    SELECT id INTO supervisors_list_id
    FROM sys_menus
    WHERE path = '/supervisors/list'
    ORDER BY id ASC
    LIMIT 1;

    IF supervisors_list_id IS NULL THEN
        INSERT INTO sys_menus (parent_id, title, type, permission, path, component, icon, sort, visible, status, created_at, updated_at)
        VALUES (supervisors_root_id, '监理账号', 2, 'supervision:supervisor:list', '/supervisors/list', 'pages/supervisors/SupervisorList', '', 1, TRUE, 1, NOW(), NOW())
        RETURNING id INTO supervisors_list_id;
    ELSE
        UPDATE sys_menus
        SET parent_id = supervisors_root_id,
            title = '监理账号',
            type = 2,
            permission = 'supervision:supervisor:list',
            path = '/supervisors/list',
            component = 'pages/supervisors/SupervisorList',
            icon = '',
            sort = 1,
            visible = TRUE,
            status = 1,
            updated_at = NOW()
        WHERE id = supervisors_list_id;
    END IF;

    SELECT id INTO supervisors_whitelist_id
    FROM sys_menus
    WHERE path = '/supervisors/whitelist'
    ORDER BY id ASC
    LIMIT 1;

    IF supervisors_whitelist_id IS NULL THEN
        INSERT INTO sys_menus (parent_id, title, type, permission, path, component, icon, sort, visible, status, created_at, updated_at)
        VALUES (supervisors_root_id, '白名单邀请', 2, 'supervision:supervisor:list', '/supervisors/whitelist', 'pages/supervisors/WhitelistManager', '', 2, TRUE, 1, NOW(), NOW())
        RETURNING id INTO supervisors_whitelist_id;
    ELSE
        UPDATE sys_menus
        SET parent_id = supervisors_root_id,
            title = '白名单邀请',
            type = 2,
            permission = 'supervision:supervisor:list',
            path = '/supervisors/whitelist',
            component = 'pages/supervisors/WhitelistManager',
            icon = '',
            sort = 2,
            visible = TRUE,
            status = 1,
            updated_at = NOW()
        WHERE id = supervisors_whitelist_id;
    END IF;

    SELECT id INTO supervisors_applications_id
    FROM sys_menus
    WHERE path = '/supervisors/applications'
    ORDER BY id ASC
    LIMIT 1;

    IF supervisors_applications_id IS NULL THEN
        INSERT INTO sys_menus (parent_id, title, type, permission, path, component, icon, sort, visible, status, created_at, updated_at)
        VALUES (supervisors_root_id, '申请审核', 2, 'supervision:supervisor:list', '/supervisors/applications', 'pages/supervisors/ApplicationReview', '', 3, TRUE, 1, NOW(), NOW())
        RETURNING id INTO supervisors_applications_id;
    ELSE
        UPDATE sys_menus
        SET parent_id = supervisors_root_id,
            title = '申请审核',
            type = 2,
            permission = 'supervision:supervisor:list',
            path = '/supervisors/applications',
            component = 'pages/supervisors/ApplicationReview',
            icon = '',
            sort = 3,
            visible = TRUE,
            status = 1,
            updated_at = NOW()
        WHERE id = supervisors_applications_id;
    END IF;

    SELECT id INTO supervisors_assignments_id
    FROM sys_menus
    WHERE path = '/supervisors/assignments'
    ORDER BY id ASC
    LIMIT 1;

    IF supervisors_assignments_id IS NULL THEN
        INSERT INTO sys_menus (parent_id, title, type, permission, path, component, icon, sort, visible, status, created_at, updated_at)
        VALUES (supervisors_root_id, '项目分配', 2, 'supervision:assignment:manage', '/supervisors/assignments', 'pages/supervisors/SupervisorAssignment', '', 4, TRUE, 1, NOW(), NOW())
        RETURNING id INTO supervisors_assignments_id;
    ELSE
        UPDATE sys_menus
        SET parent_id = supervisors_root_id,
            title = '项目分配',
            type = 2,
            permission = 'supervision:assignment:manage',
            path = '/supervisors/assignments',
            component = 'pages/supervisors/SupervisorAssignment',
            icon = '',
            sort = 4,
            visible = TRUE,
            status = 1,
            updated_at = NOW()
        WHERE id = supervisors_assignments_id;
    END IF;

    SELECT id INTO supervisors_edit_id
    FROM sys_menus
    WHERE permission = 'supervision:supervisor:edit'
      AND type = 3
    ORDER BY id ASC
    LIMIT 1;

    IF supervisors_edit_id IS NULL THEN
        INSERT INTO sys_menus (parent_id, title, type, permission, path, component, icon, sort, visible, status, created_at, updated_at)
        VALUES (supervisors_root_id, '监理账号治理', 3, 'supervision:supervisor:edit', '', '', '', 5, FALSE, 1, NOW(), NOW())
        RETURNING id INTO supervisors_edit_id;
    ELSE
        UPDATE sys_menus
        SET parent_id = supervisors_root_id,
            title = '监理账号治理',
            type = 3,
            permission = 'supervision:supervisor:edit',
            path = '',
            component = '',
            icon = '',
            sort = 5,
            visible = FALSE,
            status = 1,
            updated_at = NOW()
        WHERE id = supervisors_edit_id;
    END IF;

    SELECT id INTO supervisors_assignment_manage_id
    FROM sys_menus
    WHERE permission = 'supervision:assignment:manage'
      AND type = 3
    ORDER BY id ASC
    LIMIT 1;

    IF supervisors_assignment_manage_id IS NULL THEN
        INSERT INTO sys_menus (parent_id, title, type, permission, path, component, icon, sort, visible, status, created_at, updated_at)
        VALUES (supervisors_root_id, '监理项目分配', 3, 'supervision:assignment:manage', '', '', '', 6, FALSE, 1, NOW(), NOW())
        RETURNING id INTO supervisors_assignment_manage_id;
    ELSE
        UPDATE sys_menus
        SET parent_id = supervisors_root_id,
            title = '监理项目分配',
            type = 3,
            permission = 'supervision:assignment:manage',
            path = '',
            component = '',
            icon = '',
            sort = 6,
            visible = FALSE,
            status = 1,
            updated_at = NOW()
        WHERE id = supervisors_assignment_manage_id;
    END IF;

    INSERT INTO sys_role_menus (role_id, menu_id)
    SELECT r.id, m.id
    FROM sys_roles r
    CROSS JOIN (
        SELECT supervisors_root_id AS id
        UNION ALL SELECT supervisors_list_id
        UNION ALL SELECT supervisors_whitelist_id
        UNION ALL SELECT supervisors_applications_id
        UNION ALL SELECT supervisors_assignments_id
        UNION ALL SELECT supervisors_edit_id
        UNION ALL SELECT supervisors_assignment_manage_id
    ) m
    WHERE r.key IN ('super_admin', 'operations')
      AND m.id IS NOT NULL
    ON CONFLICT DO NOTHING;
END $$;
