#!/bin/bash

# ==================== 本地安全测试自动化脚本 ====================
# 用途：自动验证所有安全修复功能
# 使用：bash test_security.sh
# 环境：Linux/macOS/Git Bash

set -e  # 遇到错误立即退出

echo "🔒 开始本地安全测试..."
echo "================================"
echo ""

# 颜色定义
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# 测试结果统计
PASSED=0
FAILED=0
TOTAL=0

# 测试函数
test_case() {
    TOTAL=$((TOTAL + 1))
    echo -e "${YELLOW}[测试 $TOTAL]${NC} $1"
}

pass() {
    PASSED=$((PASSED + 1))
    echo -e "${GREEN}✅ 通过${NC}: $1"
    echo ""
}

fail() {
    FAILED=$((FAILED + 1))
    echo -e "${RED}❌ 失败${NC}: $1"
    echo ""
}

# ==================== 1. 检查配置文件 ====================
echo "📋 步骤 1: 检查配置文件安全性"
echo "--------------------------------"

test_case "检查 config.yaml 无硬编码密码"
if ! grep -q "password.*123456" server/config.yaml 2>/dev/null; then
    pass "config.yaml 无硬编码密码 123456"
else
    fail "config.yaml 仍包含硬编码密码"
fi

test_case "检查 config.yaml 使用环境变量"
if grep -q '\${DATABASE_PASSWORD}' server/config.yaml 2>/dev/null; then
    pass "config.yaml 使用 \${DATABASE_PASSWORD}"
else
    fail "config.yaml 未使用环境变量"
fi

test_case "检查 .env.example 无真实密钥"
if ! grep -q "TE5zufBZn5hgu6vryJs" server/.env.example 2>/dev/null; then
    pass ".env.example 无真实 JWT 密钥"
else
    fail ".env.example 仍包含真实密钥"
fi

# ==================== 2. 检查 .env 文件 ====================
echo "📋 步骤 2: 检查环境变量配置"
echo "--------------------------------"

test_case "检查 .env 文件是否存在"
if [ -f "server/.env" ]; then
    pass "server/.env 文件存在"

    test_case "检查 JWT_SECRET 是否设置"
    if grep -q "JWT_SECRET=" server/.env && ! grep -q "JWT_SECRET=REPLACE" server/.env; then
        pass "JWT_SECRET 已设置"
    else
        fail "JWT_SECRET 未正确设置"
    fi

    test_case "检查 ENCRYPTION_KEY 是否设置"
    if grep -q "ENCRYPTION_KEY=" server/.env && ! grep -q "ENCRYPTION_KEY=REPLACE" server/.env; then
        pass "ENCRYPTION_KEY 已设置"
    else
        fail "ENCRYPTION_KEY 未正确设置"
    fi
else
    fail "server/.env 文件不存在，请先创建"
    echo "   提示: 复制 .env.example 并填入实际值"
    echo "   cp server/.env.example server/.env"
fi

# ==================== 3. 检查源代码修复 ====================
echo "📋 步骤 3: 检查源代码修复"
echo "--------------------------------"

test_case "检查调试端点保护"
if grep -q 'if cfg.Server.Mode != "release"' server/internal/router/router.go; then
    pass "调试端点已添加 release 模式检查"
else
    fail "调试端点未添加保护"
fi

test_case "检查登录限流"
if grep -q "LoginRateLimit()" server/internal/router/router.go; then
    pass "登录接口已添加限流"
else
    fail "登录接口未添加限流"
fi

test_case "检查安全响应头中间件"
if [ -f "server/internal/middleware/security.go" ]; then
    pass "安全响应头中间件已创建"
else
    fail "安全响应头中间件文件不存在"
fi

test_case "检查安全响应头已启用"
if grep -q "SecurityHeaders()" server/internal/router/router.go; then
    pass "安全响应头中间件已启用"
else
    fail "安全响应头中间件未启用"
fi

test_case "检查加密密钥强制验证"
if grep -q "log.Fatal.*ENCRYPTION_KEY" server/pkg/utils/crypto.go; then
    pass "加密密钥已添加强制验证"
else
    fail "加密密钥未添加强制验证"
fi

# ==================== 4. Docker 配置检查 ====================
echo "📋 步骤 4: 检查 Docker 生产配置"
echo "--------------------------------"

test_case "检查 Docker Compose 强制密码"
if grep -q "DB_PASSWORD:?DB_PASSWORD not set" deploy/docker-compose.prod.yml; then
    pass "Docker Compose 已强制设置 DB_PASSWORD"
else
    fail "Docker Compose 未强制设置密码"
fi

test_case "检查 Docker Compose JWT_SECRET"
if grep -q "JWT_SECRET:?JWT_SECRET not set" deploy/docker-compose.prod.yml; then
    pass "Docker Compose 已强制设置 JWT_SECRET"
else
    fail "Docker Compose 未强制设置 JWT_SECRET"
fi

# ==================== 5. API 服务测试（如果正在运行） ====================
echo "📋 步骤 5: API 服务测试"
echo "--------------------------------"

# 检查服务是否运行
if curl -s http://localhost:8080/api/v1/health > /dev/null 2>&1; then
    echo "检测到 API 服务正在运行，开始功能测试..."

    test_case "测试健康检查接口"
    if curl -s http://localhost:8080/api/v1/health | grep -q "ok"; then
        pass "健康检查接口正常"
    else
        fail "健康检查接口异常"
    fi

    test_case "测试安全响应头"
    HEADERS=$(curl -I -s http://localhost:8080/api/v1/health)
    if echo "$HEADERS" | grep -q "X-Frame-Options"; then
        pass "安全响应头已启用"
    else
        fail "安全响应头未启用"
    fi

    test_case "测试登录限流（连续6次请求）"
    LIMIT_TEST=0
    for i in {1..6}; do
        RESPONSE=$(curl -s -w "%{http_code}" -X POST http://localhost:8080/api/v1/auth/login \
            -H "Content-Type: application/json" \
            -d '{"phone":"13800138000","code":"123456"}' -o /dev/null)
        if [ $i -eq 6 ] && [ "$RESPONSE" -eq 429 ]; then
            LIMIT_TEST=1
        fi
    done
    if [ $LIMIT_TEST -eq 1 ]; then
        pass "登录限流正常（第6次请求返回429）"
    else
        fail "登录限流未生效"
    fi

    # 测试调试端点（需要检查 SERVER_MODE）
    test_case "测试调试端点保护"
    DEBUG_RESPONSE=$(curl -s -w "%{http_code}" http://localhost:8080/api/v1/debug/fix-data -o /dev/null)
    if [ "$DEBUG_RESPONSE" -eq 404 ] || [ "$DEBUG_RESPONSE" -eq 401 ]; then
        pass "调试端点已保护（返回 $DEBUG_RESPONSE）"
    else
        fail "调试端点未保护（返回 $DEBUG_RESPONSE）"
    fi
else
    echo -e "${YELLOW}⚠️  API 服务未运行，跳过功能测试${NC}"
    echo "   提示: 启动服务后重新运行此脚本进行完整测试"
    echo "   cd server && go run ./cmd/api"
    echo ""
fi

# ==================== 测试总结 ====================
echo "================================"
echo "📊 测试结果汇总"
echo "================================"
echo "总测试数: $TOTAL"
echo -e "${GREEN}通过: $PASSED${NC}"
echo -e "${RED}失败: $FAILED${NC}"
echo ""

if [ $FAILED -eq 0 ]; then
    echo -e "${GREEN}🎉 恭喜！所有测试通过！${NC}"
    echo ""
    echo "✅ 下一步："
    echo "   1. 提交代码: git add . && git commit -m 'security: 修复所有高危安全问题'"
    echo "   2. 推送代码: git push origin main"
    echo "   3. 服务器部署: 参考 docs/DEPLOYMENT_CHECKLIST.md"
    exit 0
else
    echo -e "${RED}❌ 有 $FAILED 个测试失败，请修复后重新测试${NC}"
    echo ""
    echo "💡 修复建议："
    echo "   1. 检查是否已拉取最新代码: git pull"
    echo "   2. 检查 .env 文件配置是否正确"
    echo "   3. 重新启动服务测试功能"
    echo "   4. 查看详细文档: docs/LOCAL_TESTING_GUIDE.md"
    exit 1
fi
