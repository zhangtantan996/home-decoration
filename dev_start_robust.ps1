# Robust Local Development Startup Script
# 1. Starts DB & Redis in Docker (Background)
# 2. Starts Backend (Go + Air) in a new window
# 3. Starts Admin (Vite) in a new window

Write-Host "Stopping any existing containers..." -ForegroundColor Cyan
docker-compose -f docker-compose.local.yml down
docker-compose -f docker-compose.dev-env.yml down

Write-Host "Starting Infrastructure (DB + Redis)..." -ForegroundColor Cyan
docker-compose -f docker-compose.dev-env.yml up -d

# Wait for DB to be ready (optional check, but good for stability)
# Start-Sleep -Seconds 2

Write-Host "Launching Backend (Air Hot Reload)..." -ForegroundColor Green
# Opens a new PowerShell window, changes to server dir, and runs air
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd server; air"

Write-Host "Launching Admin Frontend..." -ForegroundColor Green
# Opens a new PowerShell window, changes to admin dir, and runs dev
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd admin; npm run dev"

Write-Host "✅ Development Environment Started!" -ForegroundColor Cyan
Write-Host "   - DB: localhost:5432"
Write-Host "   - Redis: localhost:6380"
Write-Host "   - API: http://localhost:8080 (Hot Reload Active)"
Write-Host "   - Admin: http://localhost:5173"
Write-Host ""
Write-Host "To stop infrastructure later, run: docker-compose -f docker-compose.dev-env.yml down"
