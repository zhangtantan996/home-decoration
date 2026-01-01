# Docker-Only Development Startup Script
# 1. Stops any existing Hybrid/Robust environment
# 2. Starts ALL services (DB + Redis + API + Admin) in Docker
# 3. Everything has Hot Reload enabled

Write-Host "Stopping any existing local/robust containers..." -ForegroundColor Cyan
docker-compose -f docker-compose.local.yml down
docker-compose -f docker-compose.dev-env.yml down

Write-Host "Starting Pure Docker Environment..." -ForegroundColor Green
Write-Host "Rebuilding API to ensure latest configuration..."
docker-compose -f docker-compose.local.yml build api

Write-Host "Starting Services..."
docker-compose -f docker-compose.local.yml up -d

Write-Host "✅ Docker Environment Started!" -ForegroundColor Cyan
Write-Host "   - DB: localhost:5432"
Write-Host "   - Redis: localhost:6380"
Write-Host "   - API: http://localhost:8080 (Hot Reload Active via Volume Mount)"
Write-Host "   - Admin: http://localhost:5173"
Write-Host ""
Write-Host "👉 Logs: docker-compose -f docker-compose.local.yml logs -f api"
