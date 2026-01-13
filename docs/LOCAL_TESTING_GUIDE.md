# 本地环境安全修复测试指南

**目标**: 在本地环境验证所有安全修复功能正常，确保无误后再部署到服务器
**预计时间**: 20-30 分钟
**环境**: Windows/Linux/macOS 本地开发环境

---

## 🎯 测试流程概览

```
本地测试 (20分钟) → 验证通过 → 提交代码 → 服务器部署
     ↓
  失败时修复
```

---

## 📋 步骤 1: 准备本地测试环境

### 1.1 生成测试用密钥

在本地终端（Git Bash/PowerShell/Terminal）执行：

```bash
# 进入项目目录
cd g:\AI_engineering\home_decoration\server

# 生成测试用 JWT 密钥（64字节）
openssl rand -base64 64

# 生成测试用加密密钥（32字节）
openssl rand -base64 32

# 生成测试用密码（24字节）
openssl rand -base64 24
```

**保存输出结果**，下一步会用到。

### 1.2 创建本地 .env 文件

在 `server/` 目录下创建 `.env` 文件：

```bash
# Windows (PowerShell)
cd server
notepad .env

# Linux/macOS
cd server
nano .env
```

粘贴以下内容（替换为步骤1.1生成的值）：

```bash
# ==================== 本地测试环境配置 ====================

# 应用环境
APP_ENV=local
SERVER_MODE=debug  # 本地测试先用 debug，稍后会测试 release 模式

# 安全密钥（使用步骤1.1生成的测试密钥）
JWT_SECRET=<粘贴生成的JWT密钥>
ENCRYPTION_KEY=<粘贴生成的加密密钥>

# 数据库配置（本地数据库）
DATABASE_HOST=localhost
DATABASE_PORT=5432
DATABASE_USER=postgres
DATABASE_PASSWORD=<粘贴生成的密码或使用本地数据库密码>
DATABASE_NAME=home_decoration

# Redis 配置（本地 Redis）
REDIS_HOST=localhost
REDIS_PORT=6380
REDIS_PASSWORD=<粘贴生成的密码或留空>

# CORS 白名单（本地开发环境）
CORS_ALLOWED_ORIGINS=http://localhost:5173,http://localhost:3000

# 日志配置
LOG_LEVEL=info
LOG_FILE=logs/backend.log
```

**注意**：
- ✅ `.env` 文件已在 `.gitignore` 中，不会被提交
- ✅ 本地测试可以使用已有的数据库密码
- ✅ REDIS_PASSWORD 如果本地 Redis 无密码可留空

---

## 🧪 步骤 2: 测试环境变量加载

### 2.1 验证加密密钥检查

测试当 ENCRYPTION_KEY 未设置时是否拒绝启动：

```bash
# 临时移除 ENCRYPTION_KEY
# Windows (PowerShell)
$env:ENCRYPTION_KEY=""

# Linux/macOS
unset ENCRYPTION_KEY

# 尝试启动服务
go run ./cmd/api
```

**预期结果**:
```
❌ 安全错误：ENCRYPTION_KEY 环境变量未设置！

敏感数据（身份证号、银行卡号）需要加密存储，必须设置32字节加密密钥。

生成密钥命令:
  Linux/macOS: openssl rand -base64 32
  Windows:     使用在线生成器或 Git Bash 执行上述命令

...

⚠️  服务器拒绝启动以保护数据安全。
exit status 1
```

✅ **如果看到上述错误并退出，说明强制检查生效！**

### 2.2 验证正常启动

恢复 ENCRYPTION_KEY 后启动：

```bash
# 重新加载 .env 文件（在 server/ 目录下）
# 或手动设置环境变量
# Windows (PowerShell)
$env:ENCRYPTION_KEY="<你的密钥>"

# Linux/macOS
export ENCRYPTION_KEY="<你的密钥>"

# 启动服务
go run ./cmd/api
```

**预期结果**:
```
✅ 加密工具初始化成功 (AES-256-GCM)
✅ Database connected successfully
✅ Redis connected successfully
[GIN-debug] Listening and serving HTTP on 0.0.0.0:8080
```

✅ **如果看到上述成功消息，说明环境变量加载正确！**

---

## 🔒 步骤 3: 测试调试端点保护

保持服务运行，打开新终端测试。

### 3.1 测试开发模式（SERVER_MODE=debug）

```bash
# 测试调试端点（开发模式应该可以访问，但需要管理员权限）
curl http://localhost:8080/api/v1/debug/fix-data
```

**预期结果**:
```json
{"code":401,"message":"请先登录"}
```

✅ **返回 401 说明需要认证，这是正确的！**

### 3.2 测试生产模式（SERVER_MODE=release）

修改 `.env` 文件，将 `SERVER_MODE=debug` 改为 `SERVER_MODE=release`，然后重启服务：

```bash
# 停止服务（Ctrl+C）

# 修改 .env
# SERVER_MODE=release

# 重新启动
go run ./cmd/api
```

测试调试端点：

```bash
curl http://localhost:8080/api/v1/debug/fix-data
```

**预期结果**:
```
404 page not found
```

✅ **返回 404 说明生产模式已完全禁用调试端点！**

---

## 🚦 步骤 4: 测试登录限流

### 4.1 连续登录测试

```bash
# Windows (PowerShell)
for ($i=1; $i -le 6; $i++) {
    Write-Host "尝试 $i :"
    curl -X POST http://localhost:8080/api/v1/auth/login `
      -H "Content-Type: application/json" `
      -d '{"phone":"13800138000","code":"123456"}'
    Write-Host "`n"
    Start-Sleep -Seconds 1
}

# Linux/macOS
for i in {1..6}; do
  echo "尝试 $i:"
  curl -X POST http://localhost:8080/api/v1/auth/login \
    -H "Content-Type: application/json" \
    -d '{"phone":"13800138000","code":"123456"}'
  echo -e "\n"
  sleep 1
done
```

**预期结果**:
```
尝试 1: {"code":400,"message":"验证码错误"}
尝试 2: {"code":400,"message":"验证码错误"}
尝试 3: {"code":400,"message":"验证码错误"}
尝试 4: {"code":400,"message":"验证码错误"}
尝试 5: {"code":400,"message":"验证码错误"}
尝试 6: {"code":429,"message":"请求过于频繁，请稍后再试"}  ✅ 限流生效！
```

✅ **第6次返回 429 说明登录限流（5次/分钟）生效！**

### 4.2 等待后恢复

等待 1 分钟后再次尝试：

```bash
# 等待 60 秒
sleep 60

# 再次尝试登录
curl -X POST http://localhost:8080/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"phone":"13800138000","code":"123456"}'
```

**预期结果**:
```json
{"code":400,"message":"验证码错误"}  // 不再是 429，限流窗口已过
```

✅ **滑动窗口限流正常工作！**

---

## 🛡️ 步骤 5: 测试安全响应头

### 5.1 检查响应头

```bash
# 查看完整的 HTTP 响应头
curl -I http://localhost:8080/api/v1/health
```

**预期结果**:
```
HTTP/1.1 200 OK
X-Content-Type-Options: nosniff
X-Frame-Options: DENY
X-Xss-Protection: 1; mode=block
Referrer-Policy: strict-origin-when-cross-origin
Permissions-Policy: geolocation=(), microphone=(), camera=()
Content-Security-Policy: default-src 'self'; script-src 'self' 'unsafe-inline' ...
Content-Type: application/json; charset=utf-8
Date: ...
```

✅ **包含所有安全响应头说明中间件生效！**

### 5.2 验证各个安全头

| 响应头 | 作用 | 预期值 |
|--------|------|--------|
| X-Content-Type-Options | 防止 MIME 嗅探 | nosniff |
| X-Frame-Options | 防止点击劫持 | DENY |
| X-Xss-Protection | XSS 防护 | 1; mode=block |
| Referrer-Policy | Referrer 策略 | strict-origin-when-cross-origin |
| Content-Security-Policy | 内容安全策略 | default-src 'self'; ... |

---

## ✅ 步骤 6: 配置文件安全检查

### 6.1 验证无硬编码密码

```bash
# 检查 config.yaml
grep -n "password.*123456" config.yaml
# 应无输出（已修复）

# 检查 config.yaml 使用环境变量
grep "DATABASE_PASSWORD" config.yaml
# 应输出: password: "${DATABASE_PASSWORD}"

# 检查 .env.example 无真实密钥
grep "TE5zufBZn5hgu6vryJs" .env.example
# 应无输出（已修复）
```

✅ **所有检查无输出说明配置安全！**

---

## 🐳 步骤 7: 本地 Docker 测试（可选）

如果想测试 Docker 环境：

### 7.1 创建本地 Docker .env

```bash
cd ../deploy
notepad .env  # 或 nano .env
```

填入：
```bash
DB_PASSWORD=test123456
REDIS_PASSWORD=test123456
JWT_SECRET=<你的JWT密钥>
ENCRYPTION_KEY=<你的加密密钥>
```

### 7.2 启动本地 Docker

```bash
# 使用本地开发配置
docker-compose -f ../docker-compose.local.yml up -d

# 查看日志
docker-compose -f ../docker-compose.local.yml logs -f api
```

**预期看到**:
```
✅ 加密工具初始化成功 (AES-256-GCM)
✅ Database connected successfully
```

### 7.3 测试生产 Docker 配置

```bash
# 测试生产配置（不启动，仅验证）
docker-compose -f docker-compose.prod.yml config

# 如果 .env 未设置，应报错:
# ERROR: DB_PASSWORD not set

# 设置后应显示完整配置
```

---

## 📊 完整测试结果检查表

勾选所有通过的测试：

### 环境变量测试
- [ ] 未设置 ENCRYPTION_KEY 时拒绝启动
- [ ] 设置 ENCRYPTION_KEY 后正常启动
- [ ] 看到 "✅ 加密工具初始化成功" 消息
- [ ] 数据库连接成功
- [ ] Redis 连接成功

### 调试端点测试
- [ ] 开发模式（debug）调试端点返回 401（需要认证）
- [ ] 生产模式（release）调试端点返回 404（已禁用）

### 限流测试
- [ ] 连续登录 5 次返回错误
- [ ] 第 6 次登录返回 429（限流生效）
- [ ] 等待 1 分钟后恢复

### 安全响应头测试
- [ ] X-Content-Type-Options: nosniff
- [ ] X-Frame-Options: DENY
- [ ] X-Xss-Protection: 1; mode=block
- [ ] Referrer-Policy 已设置
- [ ] Content-Security-Policy 已设置

### 配置文件测试
- [ ] config.yaml 无硬编码密码
- [ ] config.yaml 使用 ${DATABASE_PASSWORD}
- [ ] .env.example 无真实密钥
- [ ] .env 文件不在 Git 中

---

## 🎯 测试通过后的行动

### 全部测试通过 ✅

恭喜！您可以安全地部署到服务器：

```bash
# 1. 提交代码（.env 不会被提交）
git add .
git commit -m "security: 修复所有高危安全问题"

# 2. 推送到远程仓库
git push origin main

# 3. 按照 DEPLOYMENT_CHECKLIST.md 部署到服务器
```

### 部分测试失败 ❌

检查失败的项目并修复：

| 失败项 | 可能原因 | 解决方法 |
|--------|----------|----------|
| ENCRYPTION_KEY 检查失败 | 代码未更新 | 重新拉取最新代码 |
| 调试端点未禁用 | SERVER_MODE 未设置 | 检查 .env 文件 |
| 限流未生效 | 中间件未加载 | 检查 router.go |
| 安全响应头缺失 | SecurityHeaders 未启用 | 检查 router.go |

---

## 🔧 常见问题解决

### Q1: 服务启动失败 "database connection failed"

**原因**: 本地数据库未启动或密码错误

**解决方法**:
```bash
# 方法1: 使用 Docker 启动数据库
docker-compose -f docker-compose.local.yml up -d db

# 方法2: 修改 .env 中的 DATABASE_PASSWORD 为本地数据库密码
```

### Q2: 限流测试时全部返回 400，无 429

**原因**: LoginRateLimit 中间件未加载

**解决方法**:
```bash
# 检查路由配置
grep -A 2 "auth.POST.*login" server/internal/router/router.go

# 应包含:
# auth.POST("/login", middleware.LoginRateLimit(), handler.Login)

# 如果缺少，重新拉取代码
git pull
```

### Q3: 响应头缺少安全头

**原因**: SecurityHeaders 中间件未启用

**解决方法**:
```bash
# 检查路由配置
grep "SecurityHeaders" server/internal/router/router.go

# 应包含:
# r.Use(middleware.SecurityHeaders())

# 如果缺少，重新拉取代码
git pull
```

### Q4: Windows 无法执行 curl 命令

**解决方法**:
```powershell
# 方法1: 使用 PowerShell 的 Invoke-WebRequest
Invoke-WebRequest -Uri http://localhost:8080/api/v1/health -Method GET

# 方法2: 安装 curl
# 下载 https://curl.se/windows/
# 或使用 Git Bash 执行 curl 命令

# 方法3: 使用 Postman 或浏览器测试
```

---

## 📝 本地测试记录表

**测试日期**: ___________
**测试人**: ___________

| 测试项 | 结果 | 备注 |
|--------|------|------|
| 环境变量检查 | ⬜ 通过 / ⬜ 失败 | |
| 调试端点保护 | ⬜ 通过 / ⬜ 失败 | |
| 登录限流 | ⬜ 通过 / ⬜ 失败 | |
| 安全响应头 | ⬜ 通过 / ⬜ 失败 | |
| 配置文件安全 | ⬜ 通过 / ⬜ 失败 | |

**测试结论**: ⬜ 通过，可以部署 / ⬜ 失败，需要修复

---

## 🚀 快速测试命令汇总

```bash
# 1. 进入项目目录
cd g:\AI_engineering\home_decoration\server

# 2. 创建 .env 文件（参考步骤 1.2）

# 3. 测试 ENCRYPTION_KEY 检查
unset ENCRYPTION_KEY  # 或 $env:ENCRYPTION_KEY=""
go run ./cmd/api
# 应报错并退出

# 4. 正常启动
go run ./cmd/api
# 应看到 ✅ 加密工具初始化成功

# 5. 新终端测试调试端点（生产模式）
curl http://localhost:8080/api/v1/debug/fix-data
# 应返回 404

# 6. 测试登录限流
for i in {1..6}; do
  curl -X POST http://localhost:8080/api/v1/auth/login \
    -H "Content-Type: application/json" \
    -d '{"phone":"13800138000","code":"123456"}'
done
# 第6次应返回 429

# 7. 检查安全响应头
curl -I http://localhost:8080/api/v1/health
# 应包含 X-Frame-Options, X-Content-Type-Options 等
```

---

## ✅ 下一步

本地测试全部通过后，请继续：

1. **提交代码**: `git commit -m "security: 修复所有高危安全问题"`
2. **推送代码**: `git push origin main`
3. **服务器部署**: 按照 [DEPLOYMENT_CHECKLIST.md](DEPLOYMENT_CHECKLIST.md) 执行

**祝测试顺利！** 🎉

有任何问题随时在测试过程中提出。
