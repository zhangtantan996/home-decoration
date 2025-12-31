#!/bin/bash
# ============================================================
# 测试环境一键部署脚本 (Staging Environment Deployment Script)
# ============================================================
# 用途: 在服务器上一键启动测试/调试环境
# 端口: 8888 (隐蔽端口，外部用户无法访问)
# 项目名: staging (与正式环境 prod 完全隔离)
# ============================================================

set -e  # 遇到错误立即退出

# ========== 配置区 ==========
STAGING_PORT=8888
PROJECT_NAME="staging"
COMPOSE_FILE="docker-compose.staging.yml"
# ============================

echo "============================================"
echo "🚀 启动测试环境 (Staging Environment)"
echo "============================================"
echo ""

# 1. 检查是否在正确的目录
if [ ! -f "docker-compose.yml" ] && [ ! -f "$COMPOSE_FILE" ]; then
    echo "❌ 错误: 请在项目根目录下运行此脚本"
    echo "   提示: cd /www/home_decoration_staging"
    exit 1
fi

# 2. 如果不存在 staging compose 文件，则从 prod 复制并修改
if [ ! -f "$COMPOSE_FILE" ]; then
    echo "📋 正在创建测试环境配置文件..."
    
    if [ -f "deploy/docker-compose.prod.yml" ]; then
        cp deploy/docker-compose.prod.yml $COMPOSE_FILE
    else
        echo "❌ 错误: 找不到 deploy/docker-compose.prod.yml"
        exit 1
    fi
    
    # 修改端口: 80:80 -> 8888:80
    sed -i 's/"80:80"/"'$STAGING_PORT':80"/g' $COMPOSE_FILE
    # 删除 443 端口映射 (测试环境不需要 HTTPS)
    sed -i '/"443:443"/d' $COMPOSE_FILE
    # 删除所有 container_name 行 (防止与 prod 冲突)
    sed -i '/container_name:/d' $COMPOSE_FILE
    # 修改数据库名
    sed -i 's/home_decoration/home_decoration_staging/g' $COMPOSE_FILE
    # 修改 volume 名称
    sed -i 's/db_data_prod/db_data_staging/g' $COMPOSE_FILE
    sed -i 's/redis_data_prod/redis_data_staging/g' $COMPOSE_FILE
    
    echo "✅ 配置文件创建完成: $COMPOSE_FILE"
fi

# 3. 拉取最新代码 (如果是 Git 仓库)
if [ -d ".git" ]; then
    echo ""
    echo "📥 正在拉取最新代码..."
    git pull origin $(git branch --show-current) || echo "⚠️ Git pull 失败，使用本地代码继续"
fi

# 4. 构建并启动
echo ""
echo "🔨 正在构建并启动测试环境..."
docker-compose -p $PROJECT_NAME -f $COMPOSE_FILE up -d --build

# 5. 显示状态
echo ""
echo "============================================"
echo "✅ 测试环境启动成功!"
echo "============================================"
echo ""
echo "📍 访问地址:"
echo "   - 后台管理: http://服务器IP:$STAGING_PORT/admin/"
echo "   - 移动端Web: http://服务器IP:$STAGING_PORT/mobile/"
echo "   - API接口:   http://服务器IP:$STAGING_PORT/api/"
echo ""
echo "📋 常用命令:"
echo "   查看日志:   docker-compose -p $PROJECT_NAME logs -f"
echo "   停止服务:   docker-compose -p $PROJECT_NAME down"
echo "   重启服务:   docker-compose -p $PROJECT_NAME restart"
echo ""
echo "============================================"
