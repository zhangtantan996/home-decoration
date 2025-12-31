# 本地项目运行指南 (Local Development Guide)

本指南介绍如何通过 Docker 快速启动本地开发环境。

## 1. 环境准备

在开始之前，请确保你的机器已安装：
- **Docker Desktop** (推荐使用 4.0+)
- **Git**
- **Node.js** (可选，如果需要在容器外运行前端)
- **Go 1.23+** (可选，如果需要在容器外调试后端)

## 2. 快速启动 (推荐)

项目根目录提供了一个便捷脚本，可以一键拉起所有服务（数据库、Redis、后端 API、管理后台、移动端 Web）。

### Windows 用户
双击执行根目录下的 `docker_start.bat`。

该脚本会自动完成以下操作：
1. 检查 Docker 是否运行。
2. 调用 `docker-compose -f docker-compose.local.yml up -d --build`。
3. 容器启动完成后，持续输出实时日志。

### Linux / macOS 用户
在根目录下执行：
```bash
docker-compose -f docker-compose.local.yml up -d --build
```

## 3. 服务访问地址

容器启动成功后，可以通过以下地址访问各模块：

| 模块 | 访问地址 | 说明 |
| :--- | :--- | :--- |
| **管理后台 (Admin)** | [http://localhost:5173](http://localhost:5173) | 基于 Vite 的管理端界面 |
| **移动端 Web (Mobile)** | [http://localhost:5174](http://localhost:5174) | H5 版本的移动端界面 |
| **API 服务 (Server)** | [http://localhost:8080](http://localhost:8080) | 后端接口服务 |
| **PostgreSQL** | `localhost:5432` | 账号: `postgres` 密码: `123456` |
| **Redis** | `localhost:6380` | 本地映射到 6380 端口防止冲突 |

## 4. 开发模式说明

### 后端代码 (Go)
- 容器内使用了 `air` 进行热更新。
- 修改 `server/` 目录下的代码，容器会自动重新编译并重启服务。

### 前端代码 (Vite)
- `admin` 和 `mobile` 模块均已配置 Vite HMR（热模块替换）。
- 修改对应的 `src` 代码，浏览器会自动刷新。

## 5. 常用命令

| 动作 | 命令 |
| :--- | :--- |
| **查看日志** | `docker-compose -f docker-compose.local.yml logs -f` |
| **停止环境** | `docker-compose -f docker-compose.local.yml down` |
| **重置数据库** | `docker-compose -f docker-compose.local.yml down -v` (会删除数据卷) |
| **进入 API 容器** | `docker exec -it home_decor_api_local /bin/sh` |

---

> [!TIP]
> 如果你是首次运行，前端容器需要执行 `npm install`，受网络环境影响可能需要配置镜像源（脚本中已默认使用 `npmmirror`）。
