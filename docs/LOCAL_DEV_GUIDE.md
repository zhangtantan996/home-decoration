# 本地极速开发指南 (Robust Local Dev)

本文档介绍了新的“极速开发模式”，旨在彻底解决频繁重启和环境不一致的问题。

## 1. 核心架构

| 组件 | 运行方式 | 特性 | 端口 |
| :--- | :--- | :--- | :--- |
| **PostgreSQL** | Docker (后台) | **持久化运行**，不随代码重启而重启 | 5432 |
| **Redis** | Docker (后台) | **持久化运行**，数据不丢失 | 6380 |
| **Go Backend** | 本地 Shell | **Air 热重载**，修改代码自动秒级编译 | 8080 |
| **Admin Frontend**| 本地 Shell | **Vite HMR**，修改代码页面无刷新更新 | 5173 |

> **设计理念**：数据库和缓存是“基础设施”，应该像水电一样长开不关；代码是“流动”的，应该随时热更新。

---

## 2. 🚀 如何启动 (一键启动)

在项目根目录 PowerShell 中执行：

```powershell
.\dev_start_robust.ps1
```

**脚本会自动执行以下操作：**
1. 清理旧的容器冲突。
2. 启动 `db` 和 `redis` 容器（如果没启动）。
3. 弹出 **后端窗口**：自动运行 `air`，进入热重载模式。
4. 弹出 **前端窗口**：自动运行 `npm run dev`。
5. 控制台输出各服务访问地址。

---

## 3. 常用操作

### Q: 我改了 Go 代码，怎么生效？
**A: 什么都不用做。** 保存文件后，后端窗口检测到变化，会自动重新编译并重启服务（约 1-2 秒）。

### Q: 我改了 数据库/Redis 配置，怎么生效？
**A:** 需要重启基础设施容器：
```powershell
docker-compose -f docker-compose.dev-env.yml down
docker-compose -f docker-compose.dev-env.yml up -d
```

### Q: 下班了怎么彻底关闭？
**A:** 关闭所有弹出的 PowerShell 窗口，然后运行：
```powershell
docker-compose -f docker-compose.dev-env.yml down
```
*(其实建议保留 Docker 容器运行，下次开发启动更快)*

### Q: 端口冲突怎么办？
* Postgres: 占用 5432
* Redis: 占用 **6380** (注意不是 6379，避免与本地其他 Redis 冲突)
* API: 8080
* Admin: 5173

---

## 4. 目录结构说明

* `docker-compose.dev-env.yml`: 仅包含 DB 和 Redis 的精简配置。
* `server/.air.toml`: 后端热重载配置文件。
* `dev_start_robust.ps1`: 启动编排脚本。
