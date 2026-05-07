-- ============================================================================
-- v1.15.0: 统一身份中心改造 — 数据回填迁移
-- 说明：增量迁移，不删除旧表。补全现有数据到新身份中心模型。
-- 执行顺序：
--   1. 补齐所有现有 users 的 owner 身份
--   2. 补齐所有 providers.user_id 的 provider 身份
--   3. 给所有 sys_admins 创建/绑定 users，再创建 admin_profiles 和 admin 身份
--   4. （可选）监理身份由 Admin 后续手动创建
-- ============================================================================

-- up --------------------------------------------------------------------------

-- Step 1: 补齐所有现有 users 的 owner 身份（如果缺失）
INSERT INTO user_identities (user_id, identity_type, identity_ref_id, status, verified, created_at, updated_at)
SELECT u.id, 'owner', NULL, 1, true, NOW(), NOW()
FROM users u
WHERE NOT EXISTS (
    SELECT 1 FROM user_identities ui
    WHERE ui.user_id = u.id AND ui.identity_type = 'owner'
)
AND u.status = 1;

-- 同时更新 users.default_identity_type 为 owner（如果为默认值且不存在其他身份）
UPDATE users SET default_identity_type = 'owner'
WHERE default_identity_type = 'owner'
  AND NOT EXISTS (
    SELECT 1 FROM user_identities ui
    WHERE ui.user_id = users.id AND ui.identity_type != 'owner' AND ui.status = 1
  );

-- Step 2: 补齐所有 providers.user_id 的 provider 身份（如果缺失）
--   注意：有些 provider 可能没有 user_id（历史数据），跳过
--   先修复历史 provider 身份缺失 identity_ref_id 的记录，避免默认身份选角拿不到 providerId
UPDATE user_identities ui
SET identity_ref_id = p.id,
    status = 1,
    verified = p.verified,
    updated_at = NOW()
FROM (
    SELECT DISTINCT ON (user_id) id, user_id, verified
    FROM providers
    WHERE user_id > 0
    ORDER BY user_id, id ASC
) p
WHERE ui.user_id = p.user_id
  AND ui.identity_type = 'provider'
  AND ui.identity_ref_id IS NULL;

INSERT INTO user_identities (user_id, identity_type, identity_ref_id, status, verified, created_at, updated_at)
SELECT p.user_id, 'provider', p.id, 1, p.verified, NOW(), NOW()
FROM providers p
WHERE p.user_id > 0
  AND NOT EXISTS (
    SELECT 1 FROM user_identities ui
    WHERE ui.user_id = p.user_id
      AND ui.identity_type = 'provider'
      AND ui.identity_ref_id = p.id
  );

-- Step 3: 给所有 sys_admins 绑定 users + admin_profiles + admin 身份
--   3a. 为没有绑定 users 的 sys_admin 创建 users 记录（使用 username + phone/email 匹配）
--       先尝试通过 phone 匹配已有 users
DO $$
DECLARE
    admin_record RECORD;
    existing_user_id BIGINT;
    new_user_id BIGINT;
    new_admin_profile_id BIGINT;
    reserved_by_other_admin BOOLEAN;
    generated_admin_phone TEXT;
BEGIN
    FOR admin_record IN
        SELECT sa.id AS sys_admin_id, sa.username, sa.nickname, sa.phone, sa.email,
               sa.status AS admin_status, sa.is_super_admin
        FROM sys_admins sa
        WHERE sa.status = 1
          AND NOT EXISTS (
            SELECT 1 FROM admin_profiles ap WHERE ap.sys_admin_id = sa.id
          )
    LOOP
        existing_user_id := NULL;

        -- 尝试通过 phone 匹配已有 users
        IF admin_record.phone IS NOT NULL AND admin_record.phone != '' THEN
            SELECT id INTO existing_user_id FROM users
            WHERE phone = admin_record.phone AND status = 1
            ORDER BY id ASC LIMIT 1;
        END IF;

        -- 同手机号若已被其他管理员桥接占用，则降级为独立 admin_<id> 账号，避免 uq_admin_profiles_user_id 冲突
        IF existing_user_id IS NOT NULL THEN
            SELECT EXISTS (
                SELECT 1 FROM admin_profiles ap
                WHERE ap.user_id = existing_user_id
                  AND ap.sys_admin_id <> admin_record.sys_admin_id
            ) INTO reserved_by_other_admin;
            IF reserved_by_other_admin THEN
                RAISE NOTICE 'Admin migration: sys_admin_id=% phone=% already bound to another admin profile, fallback to dedicated admin user',
                    admin_record.sys_admin_id, admin_record.phone;
                existing_user_id := NULL;
            END IF;
        END IF;

        -- 如果没有匹配，创建新的 users 记录
        IF existing_user_id IS NULL THEN
            generated_admin_phone := 'admin_' || admin_record.sys_admin_id::text;
            -- 回填可重入：优先复用已存在的 admin_<id> 账号，避免重跑时撞 users.phone 唯一约束
            SELECT id INTO existing_user_id FROM users
            WHERE phone = generated_admin_phone
            ORDER BY id ASC LIMIT 1;

            IF existing_user_id IS NOT NULL THEN
                -- 防御性校验：若 admin_<id> 被错误桥接到其他 sys_admin，放弃复用，后续走插入路径
                SELECT EXISTS (
                    SELECT 1 FROM admin_profiles ap
                    WHERE ap.user_id = existing_user_id
                      AND ap.sys_admin_id <> admin_record.sys_admin_id
                ) INTO reserved_by_other_admin;
                IF reserved_by_other_admin THEN
                    RAISE NOTICE 'Admin migration: generated phone account occupied by another admin profile, fallback to insert path (sys_admin_id=%)',
                        admin_record.sys_admin_id;
                    existing_user_id := NULL;
                END IF;
            END IF;

            IF existing_user_id IS NOT NULL THEN
                UPDATE users
                SET nickname = COALESCE(NULLIF(nickname, ''), COALESCE(NULLIF(admin_record.nickname, ''), admin_record.username)),
                    user_type = 4,
                    status = 1,
                    default_identity_type = 'admin',
                    updated_at = NOW()
                WHERE id = existing_user_id;

                new_user_id := existing_user_id;
            ELSE
                INSERT INTO users (phone, nickname, user_type, status, default_identity_type, created_at, updated_at)
                VALUES (
                    CASE
                        WHEN admin_record.phone IS NULL OR admin_record.phone = '' THEN generated_admin_phone
                        WHEN EXISTS (SELECT 1 FROM users WHERE phone = admin_record.phone) THEN generated_admin_phone
                        ELSE admin_record.phone
                    END,
                    COALESCE(NULLIF(admin_record.nickname, ''), admin_record.username),
                    4,  -- user_type=4 (admin)
                    1,  -- status=1
                    'admin',
                    NOW(),
                    NOW()
                )
                RETURNING id INTO new_user_id;
            END IF;
        ELSE
            new_user_id := existing_user_id;
            -- 已有手机号用户保留用户端默认身份；Admin 身份由 admin_profiles + user_identities(admin) 承载。
        END IF;

        -- 创建 admin_profiles 记录
        INSERT INTO admin_profiles (user_id, sys_admin_id, admin_type, status, created_at, updated_at)
        VALUES (
            new_user_id,
            admin_record.sys_admin_id,
            CASE WHEN admin_record.is_super_admin THEN 'super_admin' ELSE 'regular' END,
            1,
            NOW(),
            NOW()
        )
        RETURNING id INTO new_admin_profile_id;

        -- 创建或修复 admin 身份
        UPDATE user_identities
        SET identity_ref_id = new_admin_profile_id,
            status = 1,
            verified = true,
            verified_at = COALESCE(verified_at, NOW()),
            updated_at = NOW()
        WHERE user_id = new_user_id
          AND identity_type = 'admin'
          AND (identity_ref_id IS NULL OR identity_ref_id = new_admin_profile_id);

        IF NOT FOUND THEN
            INSERT INTO user_identities (user_id, identity_type, identity_ref_id, status, verified, verified_at, created_at, updated_at)
            VALUES (new_user_id, 'admin', new_admin_profile_id, 1, true, NOW(), NOW(), NOW())
            ON CONFLICT DO NOTHING;
        END IF;

        RAISE NOTICE 'Admin migration: sys_admin_id=% (username=%) -> user_id=%, admin_profile_id=%',
            admin_record.sys_admin_id, admin_record.username, new_user_id, new_admin_profile_id;
    END LOOP;
END $$;

-- Step 4: 用户端默认身份保持 owner
-- 商家端和 Admin 端分别由各自登录 token 或显式切身份决定，不在账号级全局改写默认身份。
UPDATE users
SET default_identity_type = 'owner'
WHERE default_identity_type IS NULL
   OR TRIM(default_identity_type) = ''
   OR EXISTS (
       SELECT 1 FROM user_identities ui
       WHERE ui.user_id = users.id
         AND ui.identity_type = 'owner'
         AND ui.status = 1
   );

-- down ------------------------------------------------------------------------
-- 回滚（仅用于开发环境，生产环境不执行）
/*
-- 1. 删除回填的 admin 身份记录（保留手动创建的 admin 身份）
DELETE FROM user_identities WHERE identity_type = 'admin' AND identity_ref_id IS NOT NULL;

-- 2. 删除 admin_profiles
DELETE FROM admin_profiles;

-- 3. 删除回填创建的 users（admin_* 开头的 phone）
DELETE FROM users WHERE phone LIKE 'admin_%';

-- 4. 重置 default_identity_type
UPDATE users SET default_identity_type = 'owner';
*/
