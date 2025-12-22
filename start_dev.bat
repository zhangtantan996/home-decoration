@echo off
chcp 65001 >nul
echo 正在启动开发环境...

:: 前端页面 (Mobile Web)
start "Mobile Web" cmd /k "cd /d G:\AI engineering\home_decoration\mobile && npm run web"

:: 管理后台 (Admin)
start "Admin" cmd /k "cd /d G:\AI engineering\home_decoration\admin && npm run dev"

:: 后端API (Server)
start "Server API" cmd /k "cd /d G:\AI engineering\home_decoration\server && go run ./cmd/api"

:: Metro安卓调试
start "Metro Android" cmd /k "cd /d G:\AI engineering\home_decoration\mobile && npm start"

:: ========== 在这里添加更多命令 ==========
:: 格式: start "窗口标题" cmd /k "cd /d 目录路径 && 你的命令"
:: 例如:
:: start "Redis" cmd /k "cd /d C:\redis && redis-server"
:: start "数据库迁移" cmd /k "cd /d G:\AI engineering\home_decoration\server && go run ./cmd/migrate"

echo 所有服务已启动！
