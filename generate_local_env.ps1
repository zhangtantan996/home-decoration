# ==================== 快速生成本地 .env 文件 (PowerShell) ====================
# 用途：一键生成包含随机密钥的 .env 文件用于本地测试
# 使用：.\generate_local_env.ps1

Write-Host "🔐 生成本地测试环境配置文件..." -ForegroundColor Cyan
Write-Host ""

# 检查是否已存在 .env 文件
if (Test-Path "server\.env") {
    Write-Host "⚠️  警告: server\.env 文件已存在" -ForegroundColor Yellow
    $response = Read-Host "是否覆盖? (y/N)"
    if ($response -ne 'y' -and $response -ne 'Y') {
        Write-Host "❌ 操作取消" -ForegroundColor Red
        exit 1
    }
}

# 生成随机密钥函数
function Get-RandomBase64 {
    param([int]$Length)
    $bytes = New-Object byte[] $Length
    [System.Security.Cryptography.RNGCryptoServiceProvider]::Create().GetBytes($bytes)
    return [Convert]::ToBase64String($bytes)
}

# 生成随机密钥
Write-Host "🔑 生成随机密钥..." -ForegroundColor Cyan
$JWT_SECRET = Get-RandomBase64 -Length 64
$ENCRYPTION_KEY = Get-RandomBase64 -Length 32
$DB_PASSWORD = Get-RandomBase64 -Length 24
$REDIS_PASSWORD = Get-RandomBase64 -Length 24

Write-Host "✅ 密钥生成完成" -ForegroundColor Green
Write-Host ""

# 创建 .env 文件
$envContent = @"
# ==================== 本地测试环境配置 ====================
# ⚠️ 此文件仅用于本地测试，不要提交到 Git！
# 生成日期: $(Get-Date -Format "yyyy-MM-dd HH:mm:ss")

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
"@

$envContent | Out-File -FilePath "server\.env" -Encoding UTF8 -NoNewline

Write-Host "✅ server\.env 文件创建成功！" -ForegroundColor Green
Write-Host ""
Write-Host "📋 生成的配置信息：" -ForegroundColor Cyan
Write-Host "   JWT_SECRET 长度: $($JWT_SECRET.Length) 字符"
Write-Host "   ENCRYPTION_KEY 长度: $($ENCRYPTION_KEY.Length) 字符"
Write-Host "   DATABASE_PASSWORD: $DB_PASSWORD"
Write-Host "   REDIS_PASSWORD: $REDIS_PASSWORD"
Write-Host ""
Write-Host "⚠️  重要提示：" -ForegroundColor Yellow
Write-Host "   1. 此配置仅用于本地测试"
Write-Host "   2. 生产环境请使用更强的密码"
Write-Host "   3. 数据库密码需要与本地 PostgreSQL 密码一致"
Write-Host "   4. Redis 密码需要与本地 Redis 密码一致（或留空）"
Write-Host ""
Write-Host "🚀 下一步：" -ForegroundColor Cyan
Write-Host "   1. 修改 DATABASE_PASSWORD 为你的本地数据库密码"
Write-Host "   2. 启动服务: cd server && go run ./cmd/api"
Write-Host "   3. 运行测试: .\test_security.ps1"
