# 生产环境部署前检查指南

**目标**: 确保所有安全配置正确，安全上线到生产环境
**预计时间**: 30-45 分钟
**难度**: ⭐⭐ (中等)

> 阿里云（托管 RDS + 托管 Redis + Tinode + 阿里云短信）推荐落地文档：`deploy/ALIYUN_PRODUCTION_LAUNCH.md`  
> 对应 Docker Compose：`deploy/docker-compose.prod.managed.yml`（容器绑定 `127.0.0.1:8888`，建议宿主机 Nginx 负责 80/443）。

---

## 📋 准备工作

### 所需工具

```bash
# 1. 安装 OpenSSL (用于生成密钥)
# Windows: 使用 Git Bash 或下载 https://slproweb.com/products/Win32OpenSSL.html
# Linux/macOS: 已预装

# 验证 OpenSSL 可用
openssl version
# 应输出: OpenSSL 1.1.1 或更高版本

# 2. 准备文本编辑器
# 推荐: VSCode, Notepad++, vim
```

---

## 🔐 步骤 1: 生成密钥和密码

### 1.1 生成 JWT 密钥

```bash
# 在终端执行 (Git Bash/Linux/macOS)
openssl rand -base64 64

# 示例输出 (64字节随机密钥):
# Xm9Kp2Lq3Rt5Yh7Jk9Mp1Nq4Rs6Ut8Wv0Yx2Az4Bc6De8Fg0Hi2Jk4Lm6No8Pq0Rs2Tu4Vw6==
```

**重要**:
- ✅ 保存到安全的地方（如密码管理器）
- ❌ 不要提交到 Git
- ❌ 不要分享给他人

### 1.2 生成数据加密密钥

```bash
# 生成 32 字节加密密钥
openssl rand -base64 32

# 示例输出:
# a1B2c3D4e5F6g7H8i9J0k1L2m3N4o5P6q7R8s9T0u1V2w3X4y5Z6==
```

### 1.3 生成强密码

```bash
# 方法1: 使用 OpenSSL
openssl rand -base64 24

# 方法2: 在线生成器 (推荐)
# https://passwordsgenerator.net/
# 设置: 长度20+, 包含大小写字母、数字、特殊字符

# 示例强密码:
# Kb8$mP3@nQ7!xR2&yT5#wU9
```

**需要生成的密码**:
- [ ] 数据库密码 (DATABASE_PASSWORD)
- [ ] Redis 密码 (REDIS_PASSWORD)

### 1.4 密钥和密码记录表

将生成的密钥填入下表（**仅本地保存，不要提交到 Git**）:

| 环境变量 | 值 | 已设置 |
|----------|-----|--------|
| JWT_SECRET | `生成的64字节密钥` | ⬜ |
| ENCRYPTION_KEY | `生成的32字节密钥` | ⬜ |
| DATABASE_PASSWORD | `生成的强密码` | ⬜ |
| REDIS_PASSWORD | `生成的强密码` | ⬜ |

---

## ⚙️ 步骤 2: 配置环境变量

### 2.1 创建生产环境 .env 文件

在服务器上创建 `.env` 文件（**注意：不在本地开发环境创建**）：

```bash
# SSH 登录到生产服务器
ssh user@your-server.com

# 进入项目目录
cd /path/to/home_decoration/server

# 创建 .env 文件
nano .env
```

### 2.2 填入环境变量

将以下内容粘贴到 `.env` 文件，并替换为实际生成的值：

```bash
# ==================== 生产环境配置 ====================
# ⚠️ 此文件包含敏感信息，切勿提交到 Git！

# 应用环境
APP_ENV=production
SERVER_MODE=release
SERVER_HOST=0.0.0.0
SERVER_PORT=8080

# 安全密钥（必须替换为步骤1生成的值）
JWT_SECRET=<粘贴步骤1.1生成的JWT密钥>
ENCRYPTION_KEY=<粘贴步骤1.2生成的加密密钥>

# 数据库配置
DATABASE_HOST=localhost
DATABASE_PORT=5432
DATABASE_USER=postgres
DATABASE_PASSWORD=<粘贴步骤1.3生成的数据库密码>
DATABASE_NAME=home_decoration

# Redis 配置
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=<粘贴步骤1.3生成的Redis密码>

# CORS 白名单（替换为实际域名）
CORS_ALLOWED_ORIGINS=https://admin.yourdomain.com,https://yourdomain.com

# 日志配置
LOG_LEVEL=info
LOG_FILE=logs/backend.log
```

### 2.3 设置文件权限

```bash
# 确保 .env 文件仅当前用户可读
chmod 600 .env

# 验证权限
ls -la .env
# 应显示: -rw------- 1 user user ... .env
```

### 2.4 验证环境变量已加载

```bash
# 方法1: 直接读取 .env 文件
cat .env | grep JWT_SECRET
# 应输出: JWT_SECRET=<你的密钥>

# 方法2: 在应用启动时会自动加载
```

---

## 🐳 步骤 3: Docker Compose 配置检查

### 3.1 创建 Docker 环境变量文件

```bash
# 进入 deploy 目录
cd /path/to/home_decoration/deploy

# 创建 .env 文件
nano .env
```

填入以下内容（**使用步骤1生成的密码**）：

```bash
# Docker Compose 环境变量

# 数据库
DB_USER=postgres
DB_PASSWORD=<粘贴步骤1.3生成的数据库密码>
DB_NAME=home_decoration

# Redis
REDIS_PASSWORD=<粘贴步骤1.3生成的Redis密码>

# 应用密钥
JWT_SECRET=<粘贴步骤1.1生成的JWT密钥>
ENCRYPTION_KEY=<粘贴步骤1.2生成的加密密钥>
```

### 3.2 验证 Docker Compose 配置

```bash
# 验证配置文件语法
docker-compose -f docker-compose.prod.yml config

# 如果环境变量未设置，应显示错误:
# ERROR: DB_PASSWORD not set

# 正确设置后，应显示完整配置
```

---

## ✅ 步骤 4: 安全检查验证

### 4.1 检查配置文件无硬编码密码

```bash
# 检查 config.yaml 不包含硬编码密码
cd /path/to/home_decoration/server
grep -n "password.*123456" config.yaml
# 应无输出（表示已修复）

# 检查 .env.example 不包含真实密钥
grep -n "TE5zufBZn5hgu6vryJs" .env.example
# 应无输出（表示已修复）
```

### 4.2 启动服务并验证

```bash
# 方法1: 使用 Docker Compose
cd deploy
docker-compose -f docker-compose.prod.yml up -d

# 查看日志确认启动成功
docker-compose -f docker-compose.prod.yml logs api

# 应看到:
# ✅ 加密工具初始化成功 (AES-256-GCM)
# ✅ Database connected successfully
# ✅ Redis connected successfully

# 如果看到错误:
# ❌ 安全错误：ENCRYPTION_KEY 环境变量未设置！
# 说明环境变量未正确设置，返回步骤2
```

### 4.3 验证调试端点已禁用

```bash
# 测试调试端点（应返回 404 Not Found）
curl http://your-server:8080/api/v1/debug/fix-data

# 预期输出:
# {"code":404,"message":"Not Found"}

# ✅ 如果返回 404，说明调试端点已正确禁用
# ❌ 如果返回其他内容，检查 SERVER_MODE 是否为 release
```

### 4.4 验证登录限流生效

```bash
# 连续尝试登录 6 次
for i in {1..6}; do
  echo "尝试 $i:"
  curl -X POST http://your-server:8080/api/v1/auth/login \
    -H "Content-Type: application/json" \
    -d '{"phone":"13800138000","code":"123456"}' \
    -w "\n状态码: %{http_code}\n\n"
  sleep 1
done

# 预期结果:
# 前5次: 状态码 400 (密码错误)
# 第6次: 状态码 429 (Too Many Requests)

# ✅ 如果第6次返回 429，说明限流生效
# ❌ 如果全部返回 400，检查限流中间件是否启用
```

### 4.5 验证安全响应头

```bash
# 检查 HTTP 响应头
curl -I http://your-server:8080/api/v1/health

# 应包含以下响应头:
# X-Content-Type-Options: nosniff
# X-Frame-Options: DENY
# X-Xss-Protection: 1; mode=block
# Referrer-Policy: strict-origin-when-cross-origin
# Content-Security-Policy: default-src 'self'; ...

# ✅ 如果包含上述响应头，说明安全中间件生效
```

---

## 🔍 步骤 5: 完整性检查清单

逐项检查，全部打勾后才能上线：

### 环境变量检查

- [ ] JWT_SECRET 已设置且为随机生成（64字节）
- [ ] ENCRYPTION_KEY 已设置且为随机生成（32字节）
- [ ] DATABASE_PASSWORD 为强密码（≥16字符）
- [ ] REDIS_PASSWORD 为强密码（≥16字符）
- [ ] SERVER_MODE=release
- [ ] CORS_ALLOWED_ORIGINS 仅包含生产域名

### 文件权限检查

- [ ] .env 文件权限为 600 (仅所有者可读写)
- [ ] .env 文件已添加到 .gitignore
- [ ] 配置文件中无硬编码密码
- [ ] .env.example 无真实密钥

### 服务启动检查

- [ ] 数据库连接成功
- [ ] Redis 连接成功
- [ ] 加密工具初始化成功
- [ ] API 服务响应正常 (GET /api/v1/health 返回 200)

### 安全功能检查

- [ ] 调试端点返回 404 (生产环境已禁用)
- [ ] 登录限流生效 (第6次登录返回 429)
- [ ] 安全响应头已启用 (curl -I 可见)
- [ ] CORS 白名单生效 (非白名单域名返回 403)

### 可选但推荐

- [ ] HTTPS 已启用 (SSL 证书配置)
- [ ] HTTP 自动跳转到 HTTPS
- [ ] 数据库端口未暴露到公网 (仅内网访问)
- [ ] Redis 端口未暴露到公网
- [ ] 配置了数据库自动备份
- [ ] 配置了日志轮转 (防止磁盘占满)

---

## 🚨 常见问题排查

### Q1: 启动时提示 "ENCRYPTION_KEY 环境变量未设置"

**原因**: .env 文件未加载或路径错误

**解决方法**:
```bash
# 1. 检查 .env 文件是否存在
ls -la .env

# 2. 检查文件内容
cat .env | grep ENCRYPTION_KEY

# 3. 确保应用在 .env 文件所在目录启动
pwd
# 应输出: /path/to/home_decoration/server

# 4. 手动加载环境变量测试
export ENCRYPTION_KEY="your_key_here"
go run ./cmd/api
```

### Q2: Docker Compose 启动失败 "DB_PASSWORD not set"

**原因**: Docker Compose .env 文件未创建

**解决方法**:
```bash
# 1. 在 deploy 目录创建 .env 文件
cd deploy
nano .env

# 2. 填入环境变量 (参考步骤 3.1)

# 3. 验证
docker-compose -f docker-compose.prod.yml config | grep PASSWORD
```

### Q3: 调试端点仍然可访问

**原因**: SERVER_MODE 未设置为 release

**解决方法**:
```bash
# 检查环境变量
echo $SERVER_MODE
# 应输出: release

# 或检查 .env 文件
cat .env | grep SERVER_MODE

# 修正后重启服务
docker-compose -f docker-compose.prod.yml restart api
```

### Q4: 登录限流未生效

**原因**: 中间件未正确加载

**解决方法**:
```bash
# 检查路由配置
grep -A 3 "LoginRateLimit" server/internal/router/router.go

# 应包含:
# auth.POST("/login", middleware.LoginRateLimit(), handler.Login)

# 重启服务
docker-compose -f docker-compose.prod.yml restart api
```

### Q5: CORS 错误，前端无法访问

**原因**: CORS 白名单未包含前端域名

**解决方法**:
```bash
# 1. 检查 CORS 配置
cat .env | grep CORS_ALLOWED_ORIGINS

# 2. 添加前端域名
CORS_ALLOWED_ORIGINS=https://admin.yourdomain.com,https://app.yourdomain.com

# 3. 或在 router.go 中添加
# allowedOrigins := []string{
#     "https://admin.yourdomain.com",
# }

# 4. 重启服务
```

---

## 📝 部署检查记录表

**项目**: 装修设计一体化平台
**部署日期**: ___________
**检查人**: ___________

| 检查项 | 状态 | 备注 |
|--------|------|------|
| 密钥生成 | ⬜ 完成 | |
| 环境变量配置 | ⬜ 完成 | |
| Docker 配置 | ⬜ 完成 | |
| 服务启动 | ⬜ 完成 | |
| 调试端点禁用 | ⬜ 验证通过 | |
| 登录限流 | ⬜ 验证通过 | |
| 安全响应头 | ⬜ 验证通过 | |
| HTTPS 配置 | ⬜ 完成 | (可选) |

**签名**: ___________
**日期**: ___________

---

## 🎯 快速部署命令汇总

完成上述所有步骤后，使用以下命令一键部署：

```bash
# 1. SSH 登录服务器
ssh user@your-server.com

# 2. 拉取最新代码
cd /path/to/home_decoration
git pull origin main

# 3. 检查环境变量
cd deploy
cat .env | grep -E "JWT_SECRET|ENCRYPTION_KEY|DB_PASSWORD|REDIS_PASSWORD"

# 4. 启动服务
docker-compose -f docker-compose.prod.yml up -d --build

# 5. 查看日志
docker-compose -f docker-compose.prod.yml logs -f api

# 6. 验证服务
curl -I http://localhost:8080/api/v1/health
# 应返回 200 OK

# 7. 验证限流
for i in {1..6}; do curl -X POST http://localhost:8080/api/v1/auth/login \
  -H "Content-Type: application/json" -d '{"phone":"13800138000","code":"123456"}'; done

# 8. 验证调试端点禁用
curl http://localhost:8080/api/v1/debug/fix-data
# 应返回 404
```

---

## 📞 紧急联系方式

如果部署过程中遇到无法解决的问题：

1. **查看日志**:
   ```bash
   docker-compose -f docker-compose.prod.yml logs api
   ```

2. **回滚到之前版本**:
   ```bash
   git checkout <previous_commit>
   docker-compose -f docker-compose.prod.yml up -d --build
   ```

3. **紧急停止服务**:
   ```bash
   docker-compose -f docker-compose.prod.yml down
   ```

---

**✅ 检查清单完成后，即可安全上线！**

祝部署顺利！🎉
