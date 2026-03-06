# ==================== 快速生成本地环境配置 (PowerShell) ====================
# 用途：一键生成统一环境契约下的 env/local.env
# 使用：.\generate_local_env.ps1

$targetFile = "env\local.env"
New-Item -ItemType Directory -Force -Path "env" | Out-Null

Write-Host "🔐 生成本地测试环境配置文件..." -ForegroundColor Cyan
Write-Host ""

if (Test-Path $targetFile) {
    Write-Host "⚠️  警告: $targetFile 文件已存在" -ForegroundColor Yellow
    $response = Read-Host "是否覆盖? (y/N)"
    if ($response -ne 'y' -and $response -ne 'Y') {
        Write-Host "❌ 操作取消" -ForegroundColor Red
        exit 1
    }
}

function Get-RandomBase64 {
    param([int]$Length)
    $bytes = New-Object byte[] $Length
    [System.Security.Cryptography.RNGCryptoServiceProvider]::Create().GetBytes($bytes)
    return [Convert]::ToBase64String($bytes)
}

Write-Host "🔑 生成随机密钥..." -ForegroundColor Cyan
$JWT_SECRET = Get-RandomBase64 -Length 64
$ENCRYPTION_KEY = Get-RandomBase64 -Length 32
$DB_PASSWORD = Get-RandomBase64 -Length 24
$REDIS_PASSWORD = Get-RandomBase64 -Length 24

Write-Host "✅ 密钥生成完成" -ForegroundColor Green
Write-Host ""

$envContent = @"
# ==================== 本地统一环境配置 ====================
# ⚠️ 此文件仅用于本地测试，不要提交到 Git！
# 生成日期: $(Get-Date -Format "yyyy-MM-dd HH:mm:ss")

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
"@

$envContent | Out-File -FilePath $targetFile -Encoding UTF8 -NoNewline

Write-Host "✅ $targetFile 文件创建成功！" -ForegroundColor Green
Write-Host ""
Write-Host "📋 生成的配置信息：" -ForegroundColor Cyan
Write-Host "   JWT_SECRET 长度: $($JWT_SECRET.Length) 字符"
Write-Host "   ENCRYPTION_KEY 长度: $($ENCRYPTION_KEY.Length) 字符"
Write-Host "   DATABASE_PASSWORD: $DB_PASSWORD"
Write-Host "   REDIS_PASSWORD: $REDIS_PASSWORD"
Write-Host ""
Write-Host "🚀 下一步：" -ForegroundColor Cyan
Write-Host "   1. 检查并调整 $targetFile"
Write-Host "   2. 查看解析结果: npm run env:print:local"
Write-Host "   3. 启动后端: npm run dev:server"
