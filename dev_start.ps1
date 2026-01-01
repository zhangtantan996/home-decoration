# ==========================================
#   Home Decoration 一键启动脚本 (Local Dev)
# ==========================================

Write-Host "==========================================" -ForegroundColor Cyan
Write-Host "   正在启动本地集成开发环境..." -ForegroundColor Cyan
Write-Host "==========================================" -ForegroundColor Cyan

# 1. 检查 Docker 是否运行
Write-Host "[1/3] 检查基础设施 (Docker)..." -ForegroundColor Yellow
docker info >$null 2>&1
if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ 错误: 请确保 Docker Desktop 已经启动！" -ForegroundColor Red
    Read-Host "按回车键退出..."
    exit
}

# 启动 DB 和 Redis
docker compose up -d db redis
if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ 错误: 基础设施容器启动失败！" -ForegroundColor Red
    exit
}
Write-Host "✅ 基础设施已就绪 (DB:5432, Redis:6380)" -ForegroundColor Green

# 2. 检查依赖
Write-Host "[2/3] 检查依赖状态..." -ForegroundColor Yellow
if (!(Test-Path "node_modules")) {
    Write-Host "📦 正在安装根目录依赖..."
    npm install
}

# 3. 并行启动应用服务
Write-Host "[3/3] 启动应用服务 (API + Admin + Mobile)..." -ForegroundColor Yellow
Write-Host "💡 提示: 所有服务将共用此终端输出，API(品红), Admin(蓝色), Mobile(绿色)" -ForegroundColor Gray
Write-Host "💡 提示: 按 Ctrl+C 可以一次性停止所有服务" -ForegroundColor Gray
Write-Host "------------------------------------------"

npm run dev
