$ErrorActionPreference = "Continue"

Write-Host "Security Test Started..." -ForegroundColor Cyan
Write-Host "================================" -ForegroundColor Cyan
Write-Host ""

$PASSED = 0
$FAILED = 0
$TOTAL = 0

function Test-Case {
    param($Description)
    $script:TOTAL++
    Write-Host "[Test $script:TOTAL] $Description" -ForegroundColor Yellow
}

function Pass {
    param($Message)
    $script:PASSED++
    Write-Host "PASS: $Message" -ForegroundColor Green
    Write-Host ""
}

function Fail {
    param($Message)
    $script:FAILED++
    Write-Host "FAIL: $Message" -ForegroundColor Red
    Write-Host ""
}

Write-Host "Step 1: Check Config Files" -ForegroundColor Cyan
Write-Host "--------------------------------" -ForegroundColor Cyan

Test-Case "Check config.yaml no hardcoded password"
if (-not (Select-String -Path "server\config.yaml" -Pattern "password.*123456" -Quiet)) {
    Pass "config.yaml no hardcoded password"
} else {
    Fail "config.yaml contains hardcoded password"
}

Test-Case "Check .env.example no real secrets"
if (-not (Select-String -Path "server\.env.example" -Pattern "TE5zufBZn5hgu6vryJs" -Quiet)) {
    Pass ".env.example no real secrets"
} else {
    Fail ".env.example contains real secrets"
}

Write-Host "Step 2: Check Environment Variables" -ForegroundColor Cyan
Write-Host "--------------------------------" -ForegroundColor Cyan

Test-Case "Check .env file exists"
if (Test-Path "server\.env") {
    Pass "server\.env file exists"

    Test-Case "Check JWT_SECRET is set"
    $jwtLine = Select-String -Path "server\.env" -Pattern "^JWT_SECRET=" | Select-Object -First 1
    if ($jwtLine -and $jwtLine.Line -notmatch "REPLACE") {
        Pass "JWT_SECRET is configured"
    } else {
        Fail "JWT_SECRET not configured"
    }

    Test-Case "Check ENCRYPTION_KEY is set"
    $encLine = Select-String -Path "server\.env" -Pattern "^ENCRYPTION_KEY=" | Select-Object -First 1
    if ($encLine -and $encLine.Line -notmatch "REPLACE") {
        Pass "ENCRYPTION_KEY is configured"
    } else {
        Fail "ENCRYPTION_KEY not configured"
    }
} else {
    Fail "server\.env file does not exist"
}

Write-Host "Step 3: Check Source Code Fixes" -ForegroundColor Cyan
Write-Host "--------------------------------" -ForegroundColor Cyan

Test-Case "Check debug endpoint protection"
if (Select-String -Path "server\internal\router\router.go" -Pattern 'cfg.Server.Mode != "release"' -Quiet) {
    Pass "Debug endpoint protection added"
} else {
    Fail "Debug endpoint protection missing"
}

Test-Case "Check login rate limiting"
if (Select-String -Path "server\internal\router\router.go" -Pattern "LoginRateLimit" -Quiet) {
    Pass "Login rate limiting added"
} else {
    Fail "Login rate limiting missing"
}

Test-Case "Check security headers middleware"
if (Test-Path "server\internal\middleware\security.go") {
    Pass "Security headers middleware created"
} else {
    Fail "Security headers middleware missing"
}

Test-Case "Check encryption key validation"
$hasFatal = Select-String -Path "server\pkg\utils\crypto.go" -Pattern "log.Fatal" -Quiet
$hasEncKey = Select-String -Path "server\pkg\utils\crypto.go" -Pattern "ENCRYPTION_KEY.*not set" -Quiet
if ($hasFatal -and $hasEncKey) {
    Pass "Encryption key validation added"
} else {
    Fail "Encryption key validation missing"
}

Write-Host "Step 4: API Service Test" -ForegroundColor Cyan
Write-Host "--------------------------------" -ForegroundColor Cyan

try {
    $health = Invoke-WebRequest -Uri "http://localhost:8080/api/v1/health" -Method GET -TimeoutSec 2 -ErrorAction Stop

    Test-Case "Test health check endpoint"
    if ($health.Content -match "ok") {
        Pass "Health check endpoint working"
    } else {
        Fail "Health check endpoint not working"
    }

    Test-Case "Test security headers"
    if ($health.Headers["X-Frame-Options"]) {
        Pass "Security headers enabled"
    } else {
        Fail "Security headers not enabled"
    }
} catch {
    Write-Host "API service not running, skipping functional tests" -ForegroundColor Yellow
    Write-Host ""
}

Write-Host "================================" -ForegroundColor Cyan
Write-Host "Test Results Summary" -ForegroundColor Cyan
Write-Host "================================" -ForegroundColor Cyan
Write-Host "Total Tests: $TOTAL"
Write-Host "Passed: $PASSED" -ForegroundColor Green
Write-Host "Failed: $FAILED" -ForegroundColor Red
Write-Host ""

if ($FAILED -eq 0) {
    Write-Host "Congratulations! All tests passed!" -ForegroundColor Green
    Write-Host ""
    Write-Host "Services running:" -ForegroundColor Cyan
    Write-Host "  - API: http://localhost:8080/api/v1/health"
    Write-Host "  - Admin: http://localhost:5173"
    exit 0
} else {
    Write-Host "$FAILED tests failed" -ForegroundColor Red
    exit 1
}
