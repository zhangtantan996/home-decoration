# 云服务器开发指南

> 家装平台云服务器开发完整方案

---

## 📋 目录

- [概述](#概述)
- [架构方案](#架构方案)
- [云服务需求](#云服务需求)
- [本地环境需求](#本地环境需求)
- [配置步骤](#配置步骤)
- [日常工作流](#日常工作流)
- [成本估算](#成本估算)
- [常见问题](#常见问题)

---

## 概述

### 核心方案

**使用 VSCode Remote SSH，所有代码都在云服务器上编辑，本地只是一个"窗口"。**

### 关键优势

✅ **不需要"两次写代码"** - 所有代码都在云服务器上，通过 VSCode Remote SSH 编辑
✅ **团队协作方便** - 所有人连接同一个数据库，环境配置一致
✅ **性能更好** - 云服务器性能强，编译速度快，不占用本地资源
✅ **随时随地开发** - 只需要一台能上网的电脑和 VSCode

---

## 架构方案

### 工作流程示意图

```
┌─────────────────────────────────────────────────────────┐
│                    本地电脑                              │
│  ┌──────────────────────────────────────────────────┐  │
│  │  VSCode (通过 SSH 连接到云服务器)                 │  │
│  │  - 编辑代码（实际文件在云服务器上）                │  │
│  │  - 运行终端命令（在云服务器上执行）                │  │
│  │  - 调试代码（在云服务器上调试）                    │  │
│  └──────────────────────────────────────────────────┘  │
│  ┌──────────────────────────────────────────────────┐  │
│  │  浏览器                                           │  │
│  │  - 访问 http://<云服务器IP>:5173 (Admin)         │  │
│  │  - 访问 http://<云服务器IP>:8080 (API)           │  │
│  └──────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────┘
                          ↓ SSH 连接
┌─────────────────────────────────────────────────────────┐
│                    云服务器                              │
│  /home/ubuntu/home-decoration/                          │
│  ├── server/     (Go 后端 - Docker 运行)                │
│  ├── admin/      (React 管理后台 - npm run dev)         │
│  ├── mobile/     (React Native - 代码在这，编译在本地)  │
│  ├── mini/       (Taro 小程序 - npm run dev:weapp)      │
│  ├── db_data_local/ (PostgreSQL 数据)                   │
│  └── docker-compose.local.yml                           │
└─────────────────────────────────────────────────────────┘
```

### 各组件开发位置

| 组件 | 代码位置 | 编译位置 | 运行位置 | 访问方式 |
|------|---------|---------|---------|---------|
| **后端 API** | 云服务器 | 云服务器 | 云服务器 | 浏览器访问 IP:8080 |
| **Admin 管理后台** | 云服务器 | 云服务器 | 云服务器 | 浏览器访问 IP:5173 |
| **数据库** | - | - | 云服务器 Docker | 内网访问 |
| **小程序** | 云服务器 | 云服务器 | 微信开发者工具 | 本地工具导入 dist |
| **移动端** | 云服务器 | **本地** | **本地** | 物理设备/模拟器 |

---

## 云服务需求

### 1. 云服务器（必需）

**推荐配置：**
- **CPU**: 4 核心（最低 2 核心）
- **内存**: 8GB（最低 4GB）
- **存储**: 100GB SSD
- **带宽**: 5Mbps（最低 3Mbps）
- **操作系统**: Ubuntu 22.04 LTS

**云服务商选择（任选一个）：**
- 阿里云 ECS（推荐，国内访问快）
- 腾讯云 CVM
- 华为云 ECS
- AWS EC2（海外）
- DigitalOcean（海外）

**预估费用：** 约 ¥200-400/月（按量付费）

### 2. 云数据库（可选）

**方案 A：自建数据库（推荐用于开发）**
- 使用 Docker 运行 PostgreSQL
- 数据存储在云服务器本地
- 成本：包含在服务器费用中
- 优点：便宜，灵活

**方案 B：云数据库服务（推荐用于生产）**
- 阿里云 RDS PostgreSQL
- 腾讯云 TencentDB for PostgreSQL
- 成本：约 ¥300-800/月
- 优点：自动备份，高可用

**开发阶段建议：使用方案 A（自建）**

### 3. 对象存储（可选）

**用于存储用户上传的图片：**
- 阿里云 OSS
- 腾讯云 COS
- 七牛云
- 成本：约 ¥10-50/月（按流量计费）

**开发阶段建议：暂时存储在服务器本地**

### 4. 域名（可选）

- 用于生产环境
- 开发阶段可以直接用 IP 地址
- 成本：约 ¥50-100/年

---

## 本地环境需求

### 必需软件

#### 1. VSCode
```bash
# 下载地址
https://code.visualstudio.com/
```

#### 2. VSCode 插件
在 VSCode 中搜索并安装：
- **Remote - SSH** （必需）
- Remote - SSH: Editing Configuration Files

#### 3. SSH 客户端
- macOS/Linux：自带 SSH
- Windows：使用 PowerShell 或安装 Git Bash

#### 4. 浏览器
- Chrome/Edge/Firefox（用于访问 Admin 管理后台）

### 可选软件

#### 5. 微信开发者工具（如果开发小程序）
```bash
# 下载地址
https://developers.weixin.qq.com/miniprogram/dev/devtools/download.html
```

#### 6. Android Studio（如果开发 Android 移动端）
```bash
# 下载地址
https://developer.android.com/studio
```

#### 7. Xcode（如果开发 iOS 移动端，仅 macOS）
```bash
# 从 App Store 安装
```

#### 8. Git（用于版本控制）
```bash
# macOS
brew install git

# Windows
https://git-scm.com/download/win
```

---

## 配置步骤

### 第一步：购买并配置云服务器

#### 1. 购买云服务器
- 选择 Ubuntu 22.04 LTS
- 配置：4核8GB，100GB SSD
- 开放端口：22, 8080, 5173

#### 2. 配置 SSH 密钥登录

```bash
# 本地生成 SSH 密钥（如果没有）
ssh-keygen -t rsa -b 4096 -C "your_email@example.com"

# 复制公钥到云服务器
ssh-copy-id ubuntu@<云服务器IP>

# 测试连接
ssh ubuntu@<云服务器IP>
```

### 第二步：云服务器环境安装

SSH 连接到云服务器后，执行：

```bash
# 1. 更新系统
sudo apt update && sudo apt upgrade -y

# 2. 安装 Docker
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker $USER
newgrp docker

# 3. 安装 Docker Compose
sudo apt install docker-compose -y

# 4. 安装 Git
sudo apt install git -y

# 5. 安装 Node.js（用于 Admin 和 Mini）
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs

# 6. 安装 Go（用于后端开发）
wget https://go.dev/dl/go1.23.0.linux-amd64.tar.gz
sudo tar -C /usr/local -xzf go1.23.0.linux-amd64.tar.gz
echo 'export PATH=$PATH:/usr/local/go/bin' >> ~/.bashrc
source ~/.bashrc

# 7. 克隆项目
git clone <你的仓库地址> ~/home-decoration
cd ~/home-decoration
```

### 第三步：启动项目

```bash
cd ~/home-decoration

# 1. 复制环境变量文件
cp .env.example .env
# 编辑 .env 文件，填入必要的配置
nano .env

# 2. 启动数据库和 Redis
docker-compose -f docker-compose.local.yml up -d db redis

# 3. 等待数据库启动（约 10 秒）
sleep 10

# 4. 启动后端 API
cd server
go mod download
nohup go run ./cmd/api > ../logs/api.log 2>&1 &

# 5. 启动 Admin 开发服务器
cd ../admin
npm install
nohup npm run dev > ../logs/admin.log 2>&1 &

# 6. 查看运行状态
docker-compose -f docker-compose.local.yml ps
ps aux | grep "go run"
ps aux | grep "npm"
```

### 第四步：本地 VSCode 配置

#### 1. 配置 SSH 连接

编辑 `~/.ssh/config`（Windows: `C:\Users\你的用户名\.ssh\config`）：

```
Host home-decoration-dev
    HostName <云服务器公网IP>
    User ubuntu
    Port 22
    IdentityFile ~/.ssh/id_rsa
    ServerAliveInterval 60
    ServerAliveCountMax 3
```

#### 2. 在 VSCode 中连接

1. 按 `Ctrl+Shift+P`（macOS: `Cmd+Shift+P`）
2. 输入 `Remote-SSH: Connect to Host`
3. 选择 `home-decoration-dev`
4. 等待连接成功
5. 打开文件夹：`/home/ubuntu/home-decoration`

#### 3. 在 VSCode 中开发

- 所有文件编辑都在云服务器上
- 终端命令在云服务器上执行
- 代码补全、调试都正常工作

### 第五步：访问开发环境

在本地浏览器中访问：

```
# Admin 管理后台
http://<云服务器IP>:5173

# 后端 API
http://<云服务器IP>:8080/api/v1

# 健康检查
http://<云服务器IP>:8080/health
```

---

## 日常工作流

### 后端开发（Go）

```bash
# 在 VSCode Remote SSH 终端中
cd ~/home-decoration/server

# 修改代码后，重启服务
pkill -f "go run"
go run ./cmd/api &

# 或者使用 air 实现热重载
# 安装 air
go install github.com/cosmtrek/air@latest

# 启动 air
air
```

### Admin 开发（React）

```bash
# 在 VSCode Remote SSH 终端中
cd ~/home-decoration/admin

# 启动开发服务器（已启动则跳过）
npm run dev

# 修改代码后，Vite 会自动热重载
# 在浏览器中访问 http://<云服务器IP>:5173
```

### 小程序开发（Taro）

```bash
# 在 VSCode Remote SSH 终端中
cd ~/home-decoration/mini

# 安装依赖
npm install

# 编译小程序
npm run dev:weapp

# 编译完成后，在本地微信开发者工具中：
# 1. 导入项目
# 2. 项目目录选择：mini/dist（需要通过 SFTP 同步到本地）
```

**同步 mini/dist 到本地的方法：**

```bash
# 方法 1：使用 scp
scp -r ubuntu@<云服务器IP>:~/home-decoration/mini/dist ~/local-mini-dist

# 方法 2：使用 rsync
rsync -avz ubuntu@<云服务器IP>:~/home-decoration/mini/dist/ ~/local-mini-dist/

# 方法 3：使用 VSCode 的 SFTP 插件
# 安装 SFTP 插件后，配置 .vscode/sftp.json
```

### 移动端开发（React Native）

**这部分需要在本地开发**，因为需要连接物理设备或模拟器：

```bash
# 1. 先从云服务器同步代码到本地
cd ~/local-workspace
rsync -avz ubuntu@<云服务器IP>:~/home-decoration/mobile/ ./mobile/

# 2. 本地启动 Metro bundler
cd mobile
npm install
npm start

# 3. 在另一个终端运行
npm run android  # 或 npm run ios

# 4. 开发完成后，同步回云服务器
rsync -avz ./mobile/ ubuntu@<云服务器IP>:~/home-decoration/mobile/
```

### 使用 tmux 保持会话

```bash
# 安装 tmux
sudo apt install tmux -y

# 创建会话
tmux new -s dev

# 在 tmux 中启动服务
cd ~/home-decoration
docker-compose -f docker-compose.local.yml up

# 分离会话：Ctrl+B 然后按 D
# 重新连接：tmux attach -t dev
# 列出所有会话：tmux ls
# 删除会话：tmux kill-session -t dev
```

---

## 成本估算

### 开发阶段（按量付费）

```
云服务器（4核8GB）：¥0.5/小时 × 8小时/天 × 30天 = ¥120/月
带宽（5Mbps）：¥0.8/GB × 50GB = ¥40/月
存储（100GB SSD）：¥0.35/GB × 100GB = ¥35/月

总计：约 ¥200/月
```

### 生产阶段（包年包月）

```
云服务器（4核8GB）：¥300/月
云数据库 RDS：¥400/月
对象存储 OSS：¥50/月
CDN 加速：¥100/月

总计：约 ¥850/月
```

### 成本优化建议

1. **开发阶段**：使用按量付费，不用时关机
2. **测试阶段**：使用包月，但选择较低配置
3. **生产阶段**：使用包年，享受折扣
4. **数据库**：开发阶段自建，生产阶段使用云数据库

---

## 常见问题

### Q1: VSCode Remote SSH 连接很慢怎么办？

**A:**
1. 选择离你近的云服务器区域
2. 增加带宽（至少 5Mbps）
3. 使用 tmux 保持会话，避免频繁重连
4. 配置 SSH KeepAlive：
   ```
   ServerAliveInterval 60
   ServerAliveCountMax 3
   ```

### Q2: 如何在云服务器和本地之间同步代码？

**A:**
- **推荐方式**：使用 Git 进行版本控制
- **临时同步**：使用 `rsync` 或 `scp`
- **实时同步**：使用 VSCode SFTP 插件

### Q3: 移动端开发必须在本地吗？

**A:**
- 是的，因为需要连接物理设备或模拟器
- 但代码可以在云服务器上编辑
- 编译和运行需要在本地进行

### Q4: 如何备份云服务器上的数据？

**A:**
```bash
# 备份数据库
docker exec -t <postgres_container> pg_dumpall -c -U postgres > backup.sql

# 备份代码（使用 Git）
cd ~/home-decoration
git add .
git commit -m "backup"
git push

# 备份上传的文件
tar -czf uploads_backup.tar.gz server/uploads/
scp uploads_backup.tar.gz local-machine:~/backups/
```

### Q5: 如何监控云服务器资源使用情况？

**A:**
```bash
# 查看 CPU 和内存使用
htop

# 查看磁盘使用
df -h

# 查看 Docker 容器状态
docker stats

# 查看进程
ps aux | grep -E "go|node|npm"
```

### Q6: 云服务器被攻击怎么办？

**A:**
1. **预防措施**：
   - 禁用密码登录，只使用 SSH 密钥
   - 配置防火墙，只开放必要端口
   - 定期更新系统和软件
   - 使用云服务商的安全组功能

2. **应急措施**：
   - 立即关闭受攻击的端口
   - 检查日志：`/var/log/auth.log`
   - 更换 SSH 密钥
   - 重置服务器（如果必要）

### Q7: 如何配置 HTTPS？

**A:**
```bash
# 1. 安装 Certbot
sudo apt install certbot python3-certbot-nginx -y

# 2. 获取 SSL 证书
sudo certbot --nginx -d yourdomain.com

# 3. 自动续期
sudo certbot renew --dry-run
```

### Q8: 团队多人如何协作开发？

**A:**
1. **方案 A：每人一台云服务器**
   - 优点：互不干扰
   - 缺点：成本高

2. **方案 B：共享云服务器**
   - 每人创建独立用户账号
   - 使用不同的端口（如 5173, 5174, 5175）
   - 共享数据库，但使用不同的 schema

3. **方案 C：本地开发 + 云数据库**
   - 数据库在云服务器
   - 代码在本地开发
   - 通过 SSH 隧道连接数据库

---

## 安全注意事项

### 1. SSH 安全

```bash
# 禁用密码登录
sudo nano /etc/ssh/sshd_config
# 设置：PasswordAuthentication no
sudo systemctl restart sshd

# 更改 SSH 端口（可选）
# 设置：Port 2222
```

### 2. 防火墙配置

```bash
# 安装 ufw
sudo apt install ufw -y

# 配置规则
sudo ufw allow 22/tcp    # SSH
sudo ufw allow 8080/tcp  # API
sudo ufw allow 5173/tcp  # Admin dev

# 启用防火墙
sudo ufw enable

# 查看状态
sudo ufw status
```

### 3. 数据库安全

```bash
# 不要开放数据库端口到公网
# PostgreSQL (5432) 和 Redis (6380) 只在 Docker 内网访问

# 如需远程连接，使用 SSH 隧道
ssh -L 5432:localhost:5432 ubuntu@<云服务器IP>
```

### 4. 环境变量管理

```bash
# 不要将 .env 文件提交到 Git
echo ".env" >> .gitignore

# 使用 .env.example 作为模板
cp .env.example .env
nano .env  # 填入真实配置
```

---

## 相关文档

- [项目总览](../CLAUDE.md)
- [开发指南](CLAUDE_DEV_GUIDE.md)
- [部署指南](DEPLOYMENT_GUIDE_ZH.md)
- [故障排除](TROUBLESHOOTING.md)

---

## 更新日志

- **2026-01-25**: 初始版本，完整的云服务器开发方案

---

**需要帮助？** 请参考 [故障排除文档](TROUBLESHOOTING.md) 或联系团队成员。
