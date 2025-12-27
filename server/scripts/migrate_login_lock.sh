#!/bin/bash

# 数据库迁移脚本 - 添加登录锁定字段
# 使用方式：bash migrate_login_lock.sh

echo "开始执行数据库迁移..."

# 从 docker-compose 中找到 PostgreSQL 容器
DB_CONTAINER=$(docker ps --filter "name=db" --format "{{.Names}}" | head -1)

if [ -z "$DB_CONTAINER" ]; then
    echo "❌ 错误：找不到数据库容器。请确保 Docker 容器正在运行。"
    echo "提示：运行 'docker ps' 查看运行中的容器"
    exit 1
fi

echo "✓ 找到数据库容器: $DB_CONTAINER"

# 在容器中执行 SQL 迁移
echo "正在执行迁移..."

docker exec -i $DB_CONTAINER psql -U postgres -d home_decoration << 'EOF'
-- 添加用户登录锁定相关字段
-- 执行时间: 2025-12-26

-- 检查字段是否已存在，避免重复添加
DO $$
BEGIN
    -- 添加 login_failed_count
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name='users' AND column_name='login_failed_count'
    ) THEN
        ALTER TABLE users ADD COLUMN login_failed_count INT DEFAULT 0;
        RAISE NOTICE 'Column login_failed_count added';
    ELSE
        RAISE NOTICE 'Column login_failed_count already exists';
    END IF;

    -- 添加 locked_until
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name='users' AND column_name='locked_until'
    ) THEN
        ALTER TABLE users ADD COLUMN locked_until TIMESTAMP;
        RAISE NOTICE 'Column locked_until added';
    ELSE
        RAISE NOTICE 'Column locked_until already exists';
    END IF;

    -- 添加 last_failed_login_at
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name='users' AND column_name='last_failed_login_at'
    ) THEN
        ALTER TABLE users ADD COLUMN last_failed_login_at TIMESTAMP;
        RAISE NOTICE 'Column last_failed_login_at added';
    ELSE
        RAISE NOTICE 'Column last_failed_login_at already exists';
    END IF;
END $$;

-- 添加字段注释
COMMENT ON COLUMN users.login_failed_count IS '登录失败次数';
COMMENT ON COLUMN users.locked_until IS '锁定到期时间';
COMMENT ON COLUMN users.last_failed_login_at IS '最后失败登录时间';

-- 验证迁移结果
SELECT
    column_name,
    data_type,
    column_default,
    is_nullable
FROM information_schema.columns
WHERE table_name = 'users'
    AND column_name IN ('login_failed_count', 'locked_until', 'last_failed_login_at')
ORDER BY column_name;

EOF

if [ $? -eq 0 ]; then
    echo ""
    echo "✅ 数据库迁移成功完成！"
    echo ""
    echo "已添加以下字段到 users 表："
    echo "  - login_failed_count (INT, DEFAULT 0) - 登录失败次数"
    echo "  - locked_until (TIMESTAMP) - 锁定到期时间"
    echo "  - last_failed_login_at (TIMESTAMP) - 最后失败登录时间"
else
    echo ""
    echo "❌ 迁移失败，请检查错误信息"
    exit 1
fi
