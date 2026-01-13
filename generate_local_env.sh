#!/bin/bash

# ==================== 快速生成本地 .env 文件 ====================
# 用途：一键生成包含随机密钥的 .env 文件用于本地测试
# 使用：bash generate_local_env.sh

echo "🔐 生成本地测试环境配置文件..."
echo ""

# 检查是否已存在 .env 文件
if [ -f "server/.env" ]; then
    echo "⚠️  警告: server/.env 文件已存在"
    read -p "是否覆盖? (y/N): " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        echo "❌ 操作取消"
        exit 1
    fi
fi

# 生成随机密钥
echo "🔑 生成随机密钥..."
JWT_SECRET=$(openssl rand -base64 64 | tr -d '\n')
ENCRYPTION_KEY=$(openssl rand -base64 32 | tr -d '\n')
DB_PASSWORD=$(openssl rand -base64 24 | tr -d '\n')
REDIS_PASSWORD=$(openssl rand -base64 24 | tr -d '\n')

echo "✅ 密钥生成完成"
echo ""

# 创建 .env 文件
cat > server/.env << EOF
# ==================== 本地测试环境配置 ====================
# ⚠️ 此文件仅用于本地测试，不要提交到 Git！
# 生成日期: $(date)

# 应用环境
APP_ENV=local
SERVER_MODE=debug
SERVER_HOST=0.0.0.0
SERVER_PORT=8080

# 安全密钥（已自动生成）
JWT_SECRET=$JWT_SECRET
ENCRYPTION_KEY=$ENCRYPTION_KEY

# 数据库配置（本地）
DATABASE_HOST=localhost
DATABASE_PORT=5432
DATABASE_USER=postgres
DATABASE_PASSWORD=$DB_PASSWORD
DATABASE_NAME=home_decoration

# Redis 配置（本地）
REDIS_HOST=localhost
REDIS_PORT=6380
REDIS_PASSWORD=$REDIS_PASSWORD

# CORS 白名单（本地开发）
CORS_ALLOWED_ORIGINS=http://localhost:5173,http://localhost:3000

# 日志配置
LOG_LEVEL=debug
LOG_FILE=logs/backend.log
EOF

# 设置文件权限
chmod 600 server/.env

echo "✅ server/.env 文件创建成功！"
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
echo "   1. 修改 DATABASE_PASSWORD 为你的本地数据库密码"
echo "   2. 启动服务: cd server && go run ./cmd/api"
echo "   3. 运行测试: bash test_security.sh"
