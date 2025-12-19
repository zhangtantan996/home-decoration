---
description: 每日开发环境启动指南
---

为了保证开发环境正常运行，建议每天按以下顺序执行命令。

### 1. 启动 Docker 基础服务 (必须)
只需启动数据库和缓存，不需要启动整个容器群（这样本地调试更快）。

// turbo
```powershell
cd "G:\AI engineering\home_decoration"
docker compose up -d db redis
```

### 2. 准备手机连接 (真机调试必做)
确保手机 USB 连接且已开启开发者模式。

// turbo
```powershell
adb reverse tcp:8081 tcp:8081  # 转发 Metro 端口
adb reverse tcp:8080 tcp:8080  # 转发后端 API 端口
```

### 3. 启动后端 API (Server)
// turbo
```powershell
cd "G:\AI engineering\home_decoration\server"
go run main.go
```

### 4. 启动移动端开发服务器 (Mobile)
// turbo
```powershell
cd "G:\AI engineering\home_decoration\mobile"
npm start -- --reset-cache
```

---
**提示**：
- 如果 Docker 报错，请先确保 **Docker Desktop** 客户端已打开。
- 如果真机无法访问接口，请检查 `mobile/src/config.ts` 中的 IP 地址是否与电脑当前 IP 一致。
- 如果想一次性启动**所有**服务（包括前端镜像），可使用 `docker compose up -d`。
