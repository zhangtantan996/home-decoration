#!/bin/bash
# ============================================================
# 正式环境一键部署脚本 (Production Environment Deployment Script)
# ============================================================
# 用途: 在服务器上一键发布正式环境
# 端口: 80/443 (公开端口)
# 项目名: prod
# ============================================================

set -e  # 遇到错误立即退出

# ========== 配置区 ==========
PROJECT_NAME="prod"
COMPOSE_FILE="deploy/docker-compose.prod.yml"
# ============================

echo "============================================"
echo "🚀 发布正式环境 (Production Environment)"
echo "============================================"
echo ""

# 0. 安全确认
echo "⚠️  警告: 您即将更新正式环境，这会影响线上用户！"
read -p "确认继续? (输入 yes 继续): " confirm
if [ "$confirm" != "yes" ]; then
    echo "❌ 已取消发布"
    exit 0
fi

# 1. 检查是否在正确的目录
if [ ! -f "$COMPOSE_FILE" ]; then
    echo "❌ 错误: 找不到 $COMPOSE_FILE"
    echo "   请确保在项目根目录下运行此脚本"
    exit 1
fi

# 2. 拉取最新代码 (如果是 Git 仓库)
if [ -d ".git" ]; then
    echo ""
    echo "📥 正在拉取最新代码..."
    git pull origin main || git pull origin master || echo "⚠️ Git pull 失败，使用本地代码继续"
fi

# 3. 构建并启动
echo ""
echo "🔨 正在构建并启动正式环境..."
docker-compose -p $PROJECT_NAME -f $COMPOSE_FILE up -d --build

# 4. 健康检查
echo ""
echo "⏳ 等待服务启动 (10秒)..."
sleep 10

# 5. 验证服务状态
echo ""
echo "🔍 检查服务状态..."
docker-compose -p $PROJECT_NAME ps

# 6. 显示结果
echo ""
echo "============================================"
echo "✅ 正式环境发布成功!"
echo "============================================"
echo ""
echo "📍 访问地址:"
echo "   - 后台管理: http://您的域名/admin/"
echo "   - 移动端Web: http://您的域名/mobile/"
echo "   - API接口:   http://您的域名/api/"
echo ""
echo "📋 常用命令:"
echo "   查看日志:   docker-compose -p $PROJECT_NAME -f $COMPOSE_FILE logs -f"
echo "   停止服务:   docker-compose -p $PROJECT_NAME -f $COMPOSE_FILE down"
echo "   重启服务:   docker-compose -p $PROJECT_NAME -f $COMPOSE_FILE restart"
echo ""
echo "============================================"
