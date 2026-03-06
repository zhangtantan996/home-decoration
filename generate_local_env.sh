#!/bin/bash

# ==================== 快速生成本地环境配置 ====================
# 用途：一键生成统一环境契约下的 env/local.env
# 使用：bash generate_local_env.sh

TARGET_FILE="env/local.env"

mkdir -p env

echo "🔐 生成本地测试环境配置文件..."
echo ""

if [ -f "${TARGET_FILE}" ]; then
    echo "⚠️  警告: ${TARGET_FILE} 文件已存在"
    read -p "是否覆盖? (y/N): " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        echo "❌ 操作取消"
        exit 1
    fi
fi

echo "🔑 生成随机密钥..."
JWT_SECRET=$(openssl rand -base64 64 | tr -d '\n')
ENCRYPTION_KEY=$(openssl rand -base64 32 | tr -d '\n')
DB_PASSWORD=$(openssl rand -base64 24 | tr -d '\n')
REDIS_PASSWORD=$(openssl rand -base64 24 | tr -d '\n')

echo "✅ 密钥生成完成"
echo ""

cat > "${TARGET_FILE}" << EOF2
# ==================== 本地统一环境配置 ====================
# ⚠️ 此文件仅用于本地测试，不要提交到 Git！
# 生成日期: $(date)

APP_ENV=local
API_BASE_URL=http://localhost:8080
ADMIN_BASE_URL=http://localhost:5173
WEB_BASE_URL=http://localhost:5175
TINODE_SERVER_URL=ws://localhost:6060
TINODE_API_KEY=
SERVER_PUBLIC_URL=http://localhost:8080

DATABASE_HOST=localhost
DATABASE_PORT=5432
DATABASE_USER=postgres
DATABASE_PASSWORD=$DB_PASSWORD
DATABASE_DBNAME=home_decoration
DATABASE_SSLMODE=disable

REDIS_HOST=localhost
REDIS_PORT=6380
REDIS_PASSWORD=$REDIS_PASSWORD
REDIS_DB=0

JWT_SECRET=$JWT_SECRET
ENCRYPTION_KEY=$ENCRYPTION_KEY
CORS_ALLOWED_ORIGINS=http://localhost:5173,http://localhost:5175,http://localhost:5176
SMS_PROVIDER=mock
EOF2

chmod 600 "${TARGET_FILE}"

echo "✅ ${TARGET_FILE} 文件创建成功！"
echo ""
echo "📋 生成的配置信息："
echo "   JWT_SECRET 长度: ${#JWT_SECRET} 字符"
echo "   ENCRYPTION_KEY 长度: ${#ENCRYPTION_KEY} 字符"
echo "   DATABASE_PASSWORD: $DB_PASSWORD"
echo "   REDIS_PASSWORD: $REDIS_PASSWORD"
echo ""
echo "⚠️  重要提示："
echo "   1. 此配置仅用于本地测试"
echo "   2. 生产环境请使用更强的密码"
echo "   3. 数据库密码需要与本地 PostgreSQL 密码一致"
echo "   4. Redis 密码需要与本地 Redis 密码一致（或留空）"
echo ""
echo "🚀 下一步："
echo "   1. 检查并调整 ${TARGET_FILE}"
echo "   2. 查看解析结果: npm run env:print:local"
echo "   3. 启动后端: npm run dev:server"
