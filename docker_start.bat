@echo off
chcp 65001 >nul
echo ==========================================
echo   Docker 本地开发环境启动工具
echo ==========================================

:: 确保在脚本所在目录
cd /d "%~dp0"

:: 检查 Docker 是否运行
docker info >nul 2>&1
if %ERRORLEVEL% neq 0 (
    echo [错误] 请确保 Docker Desktop 已经启动！
    pause
    exit /b
)

echo [1/2] 正在拉起容器环境 (首次运行会比较慢)...
docker-compose -f docker-compose.local.yml up -d --build

if %ERRORLEVEL% neq 0 (
    echo [错误] 容器启动失败，请检查 Docker 日志。
    pause
    exit /b
)

echo.
echo [2/2] 启动成功！
echo ==========================================
echo   管理后台: http://localhost:5173
echo   移动 Web: http://localhost:5174
echo   API 服务器: http://localhost:8080
echo.
echo   * 后端代码热更新已启用 (使用 air)
echo   * 前端代码热更新已启用 (使用 Vite HMR)
echo ==========================================
echo.
echo 按任意键可以查看实时日志 (Ctrl+C 退出日志查看，不影响容器运行)
pause

docker-compose -f docker-compose.local.yml logs -f
