# 🏠 Home Decoration 完整部署指南
# Complete Deployment Guide

本文档提供从零开始的完整部署流程，包括：
- Git 仓库初始化与推送
- 服务器环境搭建
- 本地开发环境设置
- 测试环境与正式环境的管理
- 一键部署脚本使用

---

## 📋 目录

1. [环境要求](#1-环境要求)
2. [Git 仓库设置](#2-git-仓库设置)
3. [服务器初始化](#3-服务器初始化)
4. [本地开发环境](#4-本地开发环境)
5. [测试环境部署](#5-测试环境部署)
6. [正式环境发布](#6-正式环境发布)
7. [日常维护流程](#7-日常维护流程)
8. [常见问题](#8-常见问题)

---

## 1. 环境要求

### 1.1 服务器要求
| 项目 | 最低配置 | 推荐配置 |
|------|----------|----------|
| CPU | 1 核 | 2 核+ |
| 内存 | 2 GB | 4 GB+ |
| 硬盘 | 20 GB | 50 GB+ |
| 系统 | Ubuntu 20.04 / CentOS 7+ | Ubuntu 22.04 |

### 1.2 需要安装的软件
```bash
# Docker
curl -fsSL https://get.docker.com | sh
sudo systemctl enable docker
sudo systemctl start docker

# Docker Compose
sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
sudo chmod +x /usr/local/bin/docker-compose

# Git
sudo apt update && sudo apt install -y git  # Ubuntu
# 或
sudo yum install -y git  # CentOS
```

### 1.3 本地开发要求
- **Windows**: Git for Windows, Docker Desktop, Node.js 20+, Go 1.21+
- **Mac**: Xcode Command Line Tools, Docker Desktop, Node.js 20+, Go 1.21+

---

## 2. Git 仓库设置

### 2.1 创建远程仓库
1. 登录 GitHub / Gitee / GitLab
2. 点击 "New Repository"
3. 填写仓库名称：`home_decoration`
4. 选择 Private（私有仓库）
5. 点击创建

### 2.2 本地初始化并推送
```powershell
# 1. 进入项目目录
cd "G:\AI engineering\home_decoration"

# 2. 初始化 Git (如果还没有)
git init

# 3. 添加远程仓库 (替换为您的仓库地址)
git remote add origin https://github.com/YOUR_USERNAME/home_decoration.git
# 或使用 SSH
git remote add origin git@github.com:YOUR_USERNAME/home_decoration.git

# 4. 添加所有文件
git add .

# 5. 提交
git commit -m "Initial commit: 完整项目代码"

# 6. 推送到远程仓库
git branch -M main
git push -u origin main
```

### 2.3 设置 SSH 密钥 (推荐)
```powershell
# 1. 生成 SSH 密钥
ssh-keygen -t ed25519 -C "your_email@example.com"

# 2. 查看公钥
cat ~/.ssh/id_ed25519.pub

# 3. 复制公钥内容，添加到 GitHub/Gitee 的 SSH Keys 设置中
```

---

## 3. 服务器初始化

### 3.1 连接服务器
```powershell
# Windows 使用 PowerShell 或 PuTTY
ssh root@您的服务器IP

# 或使用密钥登录
ssh -i ~/.ssh/your_key root@您的服务器IP
```

### 3.2 创建目录结构
```bash
# 创建项目根目录
sudo mkdir -p /www

# 创建正式环境目录
sudo mkdir -p /www/home_decoration_prod

# 创建测试环境目录
sudo mkdir -p /www/home_decoration_staging

# 设置权限 (假设您使用 deploy 用户)
sudo chown -R $USER:$USER /www
```

### 3.3 克隆代码到服务器

#### 正式环境
```bash
cd /www/home_decoration_prod

# 克隆代码 (替换为您的仓库地址)
git clone https://github.com/YOUR_USERNAME/home_decoration.git .

# 或使用 SSH
git clone git@github.com:YOUR_USERNAME/home_decoration.git .
```

#### 测试环境
```bash
cd /www/home_decoration_staging

# 克隆代码
git clone https://github.com/YOUR_USERNAME/home_decoration.git .

# 切换到开发分支 (如果有)
git checkout -b staging
```

### 3.4 配置环境变量
```bash
# 在项目根目录创建 .env 文件
cd /www/home_decoration_prod
cp .env.example .env

# 编辑环境变量
nano .env
```

**`.env` 文件示例:**
```env
# 数据库配置
DB_USER=postgres
DB_PASSWORD=您的数据库密码
DB_NAME=home_decoration

# Redis 配置
REDIS_PASSWORD=您的Redis密码

# JWT 密钥
JWT_SECRET=您的JWT密钥

# 服务器模式
SERVER_MODE=release
```

### 3.5 配置防火墙
```bash
# Ubuntu (ufw)
sudo ufw allow 22    # SSH
sudo ufw allow 80    # HTTP
sudo ufw allow 443   # HTTPS
sudo ufw allow 8888  # 测试端口 (可选，调试完后关闭)
sudo ufw enable

# CentOS (firewalld)
sudo firewall-cmd --permanent --add-port=22/tcp
sudo firewall-cmd --permanent --add-port=80/tcp
sudo firewall-cmd --permanent --add-port=443/tcp
sudo firewall-cmd --permanent --add-port=8888/tcp  # 测试端口
sudo firewall-cmd --reload
```

---

## 4. 本地开发环境

### 4.1 克隆仓库到本地
```powershell
# 选择一个工作目录
cd "G:\AI engineering"

# 克隆仓库
git clone https://github.com/YOUR_USERNAME/home_decoration.git

# 进入项目目录
cd home_decoration
```

### 4.2 安装依赖
```powershell
# 后端 (Go)
cd server
go mod download

# 前端 - Admin
cd ../admin
npm install --legacy-peer-deps

# 前端 - Mobile
cd ../mobile
npm install --legacy-peer-deps
```

### 4.3 启动本地开发服务
```powershell
# 方式一：使用 Docker Compose (推荐)
docker-compose -f docker-compose.local.yml up -d

# 方式二：手动启动各服务
# 终端1 - 启动数据库
docker compose up -d db redis

# 终端2 - 启动后端
cd server
go run ./cmd/api

# 终端3 - 启动 Admin
cd admin
npm run dev

# 终端4 - 启动 Mobile Web
cd mobile
npm run web
```

### 4.4 本地访问地址
| 服务 | 地址 |
|------|------|
| Admin 后台 | http://localhost:5173 |
| Mobile Web | http://localhost:5174 |
| API 接口 | http://localhost:8080 |
| PostgreSQL | localhost:5432 |
| Redis | localhost:6380 |

---

## 5. 测试环境部署

### 5.1 进入测试目录
```bash
ssh root@您的服务器IP
cd /www/home_decoration_staging
```

### 5.2 拉取最新代码
```bash
git pull origin main
# 或拉取指定分支
git pull origin staging
```

### 5.3 一键部署测试环境
```bash
# 添加执行权限 (首次)
chmod +x scripts/deploy_staging.sh

# 执行部署脚本
./scripts/deploy_staging.sh
```

### 5.4 手动部署 (如果不使用脚本)
```bash
# 1. 复制并修改配置文件
cp deploy/docker-compose.prod.yml docker-compose.staging.yml

# 2. 修改端口为 8888
sed -i 's/"80:80"/"8888:80"/g' docker-compose.staging.yml

# 3. 删除 container_name (防止冲突)
sed -i '/container_name:/d' docker-compose.staging.yml

# 4. 启动
docker-compose -p staging -f docker-compose.staging.yml up -d --build
```

### 5.5 验证测试环境
```bash
# 查看容器状态
docker-compose -p staging ps

# 查看日志
docker-compose -p staging logs -f

# 访问测试环境
curl http://localhost:8888/api/health
```

### 5.6 测试环境访问地址
| 服务 | 地址 |
|------|------|
| Admin 后台 | http://服务器IP:8888/admin/ |
| Mobile Web | http://服务器IP:8888/mobile/ |
| API 接口 | http://服务器IP:8888/api/ |

---

## 6. 正式环境发布

### 6.1 进入正式目录
```bash
ssh root@您的服务器IP
cd /www/home_decoration_prod
```

### 6.2 拉取最新代码
```bash
# 确保在 main 分支
git checkout main
git pull origin main
```

### 6.3 一键发布正式环境
```bash
# 添加执行权限 (首次)
chmod +x scripts/deploy_prod.sh

# 执行发布脚本
./scripts/deploy_prod.sh
```

### 6.4 手动发布 (如果不使用脚本)
```bash
# 直接使用 prod 配置启动
docker-compose -p prod -f deploy/docker-compose.prod.yml up -d --build
```

### 6.5 验证正式环境
```bash
# 查看容器状态
docker-compose -p prod -f deploy/docker-compose.prod.yml ps

# 查看日志
docker-compose -p prod -f deploy/docker-compose.prod.yml logs -f

# 健康检查
curl http://localhost/api/health
```

---

## 7. 日常维护流程

### 7.1 开发新功能的完整流程

```
┌─────────────────────────────────────────────────────────────────┐
│                        开发 -> 测试 -> 发布 流程图               │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  [本地开发]                                                     │
│      │                                                          │
│      ▼                                                          │
│  git add . && git commit -m "功能描述"                          │
│      │                                                          │
│      ▼                                                          │
│  git push origin main                                           │
│      │                                                          │
│      ▼                                                          │
│  [服务器 - 测试环境]                                            │
│  cd /www/home_decoration_staging                                │
│  git pull && ./scripts/deploy_staging.sh                        │
│      │                                                          │
│      ▼                                                          │
│  通过 :8888 端口验证功能 ────────────┐                          │
│      │                               │                          │
│      │ ✅ 测试通过                   │ ❌ 有问题                │
│      ▼                               ▼                          │
│  [服务器 - 正式环境]              返回本地修改                  │
│  cd /www/home_decoration_prod                                   │
│  git pull && ./scripts/deploy_prod.sh                           │
│      │                                                          │
│      ▼                                                          │
│  🎉 发布完成，用户可访问                                        │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### 7.2 常用命令速查表

| 场景 | 命令 |
|------|------|
| 查看运行中的容器 | `docker ps` |
| 查看测试环境日志 | `docker-compose -p staging logs -f` |
| 查看正式环境日志 | `docker-compose -p prod -f deploy/docker-compose.prod.yml logs -f` |
| 重启测试环境 | `docker-compose -p staging restart` |
| 重启正式环境 | `docker-compose -p prod -f deploy/docker-compose.prod.yml restart` |
| 停止测试环境 | `docker-compose -p staging down` |
| 停止正式环境 | `docker-compose -p prod -f deploy/docker-compose.prod.yml down` |
| 进入后端容器 | `docker exec -it staging_api_1 sh` |
| 查看数据库 | `docker exec -it staging_db_1 psql -U postgres -d home_decoration_staging` |

### 7.3 数据库备份
```bash
# 备份正式数据库
docker exec prod_db_1 pg_dump -U postgres home_decoration > backup_$(date +%Y%m%d).sql

# 恢复数据库
cat backup_20231231.sql | docker exec -i prod_db_1 psql -U postgres home_decoration
```

---

## 8. 常见问题

### Q1: 端口被占用怎么办？
```bash
# 查看端口占用
sudo lsof -i :80
sudo lsof -i :8888

# 杀死占用进程
sudo kill -9 PID
```

### Q2: Docker 构建失败怎么办？
```bash
# 清理 Docker 缓存
docker system prune -a

# 重新构建 (不使用缓存)
docker-compose -p staging -f docker-compose.staging.yml build --no-cache
```

### Q3: 如何查看服务器资源占用？
```bash
# 查看 CPU 和内存
htop  # 需要安装: apt install htop

# 查看磁盘
df -h

# 查看 Docker 资源占用
docker stats
```

### Q4: 如何回滚到之前的版本？
```bash
# 查看历史提交
git log --oneline -10

# 回滚到指定版本
git checkout 版本号

# 重新部署
./scripts/deploy_prod.sh
```

### Q5: 测试环境和正式环境数据能否同步？
```bash
# 导出正式数据
docker exec prod_db_1 pg_dump -U postgres home_decoration > prod_data.sql

# 导入到测试数据库
cat prod_data.sql | docker exec -i staging_db_1 psql -U postgres home_decoration_staging
```

---

## 🛡️ 安全提醒

> [!CAUTION]
> 1. **切勿将 `.env` 文件提交到 Git 仓库**（已在 `.gitignore` 中忽略）
> 2. **定期更换数据库和 Redis 密码**
> 3. **调试完成后关闭 8888 测试端口**
> 4. **配置 HTTPS 证书**（使用 Let's Encrypt 免费证书）
> 5. **定期备份数据库**

---

## 📞 技术支持

如遇到问题，请检查：
1. Docker 和 Docker Compose 版本是否正确
2. 防火墙端口是否开放
3. `.env` 环境变量是否配置完整
4. 服务器内存是否充足

---

*文档更新时间: 2025-12-31*
