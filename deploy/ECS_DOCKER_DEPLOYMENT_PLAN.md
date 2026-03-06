# 单机 ECS Docker 部署方案

## 1. 推荐方案

采用：

**单机 ECS + Docker Compose 自托管 PostgreSQL/Redis/API/Web + 宿主机 Nginx**

原因很简单：

- 你现在已经有 ECS、公网 IP、DNS，但服务还没正式部署。
- 仓库里已经有单机部署基础：`deploy/docker-compose.prod.yml`
- 也已经有更稳的生产入口模式：`deploy/nginx/host_nginx_prod.conf`
- 适合先跑通 HTTP，再补 HTTPS，不会卡在证书阶段。
- 后续如果要升级成阿里云 RDS / Redis，只需要替换基础设施，不需要推翻域名和入口结构。

---

## 2. 目标拓扑

### ECS 宿主机
运行：

- Docker Engine
- Docker Compose
- Nginx
- 项目代码目录：`/opt/home_decoration`

### Docker 内服务
建议部署这些容器：

- `db`：PostgreSQL 15
- `redis`：Redis 6.2
- `api`：Go 后端
- `web`：容器内 Nginx，负责前端静态资源 + API/Tinode 反代
- `tinode`：如果上线即启用聊天/IM，建议一起部署

### 流量路径

```text
公网请求
  -> 宿主机 Nginx :80/:443
  -> 127.0.0.1:8888
  -> Docker 内 web 容器
  -> /api/*      -> api:8080
  -> /uploads/*  -> api:8080
  -> /tinode/*   -> tinode:6060
  -> /v0/*       -> tinode:6060
  -> /admin/*    -> Admin 前端
  -> /merchant*  -> 商家端入口
  -> /           -> 官网静态页
```

---

## 3. 域名规划

建议固定成下面这套：

- `hezeyunchuang.com` → 官网
- `www.hezeyunchuang.com` → 跳转到根域或与根域一致
- `admin.hezeyunchuang.com` → 管理后台
- `api.hezeyunchuang.com` → API / uploads / Tinode / WebSocket

这样划分最稳：

- 根域名给官网
- 后台和 API 完全分离
- 跟现有 Nginx 配置思路一致
- 后面做 HTTPS、权限控制、限流都更清晰

---

## 4. 上线顺序

## 阶段 A：先跑通 HTTP

先别管证书，先确认服务能用。

执行顺序：

1. ECS 安装 Docker、Docker Compose、Nginx
2. 把代码拉到 `/opt/home_decoration`
3. 准备 `deploy/.env`
4. 启动 Docker 服务栈
5. 宿主机 Nginx 先只监听 80，反代到 `127.0.0.1:8888`
6. 验证以下地址：
   - `http://hezeyunchuang.com`
   - `http://admin.hezeyunchuang.com/admin/login`
   - `http://api.hezeyunchuang.com/api/v1/health`

### 这一阶段的目标
不是“正式上线”，而是确认四件事：

- DNS 已经生效
- 安全组和防火墙没拦住
- Docker 服务能起来
- Nginx 路由没配错

---

## 阶段 B：补 HTTPS

HTTP 全部正常后，再做证书。

执行顺序：

1. 用 `deploy/nginx/host_nginx_prod.conf` 作为模板生成宿主机正式 Nginx 配置
2. 保留 `/.well-known/acme-challenge/` 路由
3. 用 certbot 或阿里云证书给以下域名签证书：
   - `hezeyunchuang.com`
   - `admin.hezeyunchuang.com`
   - `api.hezeyunchuang.com`
4. 启用 443
5. 把 80 统一跳转到 HTTPS
6. 再验证：
   - `https://hezeyunchuang.com`
   - `https://admin.hezeyunchuang.com/admin/login`
   - `https://api.hezeyunchuang.com/api/v1/health`

---

## 5. Docker 编排建议

以 `deploy/docker-compose.prod.yml` 为基础，但建议按下面方式调整。

### 必改项

#### 1）`web` 只绑定本机回环地址
不要直接暴露公网。

建议：

```yaml
ports:
  - "127.0.0.1:8888:8888"
```

不要继续让容器直接暴露 443 给公网。

#### 2）给 `api` 增加 uploads 持久化
否则上传文件会丢。

建议挂载：

```yaml
volumes:
  - ../server/uploads:/app/uploads
```

#### 3）数据库和 Redis 仅容器内访问
不要映射到公网端口。

#### 4）如果需要聊天能力，增加 `tinode` 服务
因为 `deploy/nginx/nginx.prod.conf` 已经预留了：

- `/tinode/v0/`
- `/tinode/ws`
- `/v0/channels`
- `/v0/`

---

## 6. `deploy/.env` 建议变量

## 最少需要

```bash
DB_USER=postgres
DB_PASSWORD=强密码
DB_NAME=home_decoration

REDIS_PASSWORD=强密码

JWT_SECRET=强随机字符串
ENCRYPTION_KEY=32位密钥
SERVER_MODE=release
```

## 建议按生产风格补齐

```bash
APP_ENV=production
SERVER_PUBLIC_URL=https://api.hezeyunchuang.com
CORS_ALLOWED_ORIGINS=https://hezeyunchuang.com,https://www.hezeyunchuang.com,https://admin.hezeyunchuang.com

DATABASE_HOST=db
DATABASE_PORT=5432
DATABASE_USER=postgres
DATABASE_PASSWORD=强密码
DATABASE_DBNAME=home_decoration
DATABASE_SSLMODE=disable

REDIS_HOST=redis
REDIS_PORT=6379
REDIS_PASSWORD=强密码
REDIS_DB=0

JWT_SECRET=强随机字符串
ENCRYPTION_KEY=32位密钥
```

## 如果启用 Tinode

```bash
TINODE_DATABASE_DSN=...
TINODE_UID_ENCRYPTION_KEY=...
TINODE_AUTH_TOKEN_KEY=...
TINODE_API_KEY_SALT=...
```

## 如果启用短信

```bash
SMS_PROVIDER=aliyun
SMS_ACCESS_KEY_ID=...
SMS_ACCESS_KEY_SECRET=...
SMS_SIGN_NAME=...
SMS_TEMPLATE_CODE=...
SMS_REGION_ID=...
```

---

## 7. Nginx 配置建议

## 容器内 Nginx
继续用 `deploy/nginx/nginx.prod.conf` 的路由结构，原因：

- 已经处理 `/admin/`
- 已经处理 `/merchant`
- 已经代理 `/api/`
- 已经代理 `/uploads/`
- 已经代理 Tinode HTTP / WS
- 已经内置后台 BasicAuth + IP 白名单入口

## 宿主机 Nginx
用 `deploy/nginx/host_nginx_prod.conf` 做模板。

职责：

- 80 / 443 对外监听
- TLS 终止
- 把流量反代到 `127.0.0.1:8888`

---

## 8. 管理后台安全加固

这个别省。

按 `deploy/nginx/nginx.prod.conf` 的设计：

- `/admin/` 要加 IP 白名单
- `/admin/` 要加 BasicAuth

需要维护两个文件：

- `deploy/nginx/admin_allowlist.conf`
- `deploy/nginx/admin.htpasswd`

上线最低要求：

- 只有你的办公 IP 能访问后台
- 非白名单直接 403
- 白名单但密码不对返回 401

---

## 9. 持久化和备份

## 必须持久化

- PostgreSQL 数据目录
- Redis 数据目录
- `server/uploads`

## 推荐备份

### 数据库
每天导出一次 dump

### uploads
每天打包备份一次

### 备份位置
至少二选一：

- ECS 独立备份目录
- 阿里云 OSS

---

## 10. ECS 侧实际执行顺序

服务器侧 AI 可以按下面顺序执行：

1. 安装 Docker / Docker Compose / Nginx
2. 创建目录 `/opt/home_decoration`
3. 拉取代码到 `/opt/home_decoration`
4. 复制环境模板并生成 `deploy/.env`
5. 调整 `deploy/docker-compose.prod.yml`
   - `web` 只绑定 `127.0.0.1:8888:8888`
   - 不暴露容器 443
   - 增加 uploads 持久化
   - 按需要增加 tinode
6. 准备：
   - `deploy/nginx/admin_allowlist.conf`
   - `deploy/nginx/admin.htpasswd`
7. 启动 Docker Compose
8. 先配置宿主机 HTTP 反代
9. 验证官网、后台、API
10. 验证通过后再上 HTTPS

---

## 11. 验证清单

## 基础网络

- `hezeyunchuang.com` 解析到 ECS 公网 IP
- `www.hezeyunchuang.com` 解析到 ECS 公网 IP
- `admin.hezeyunchuang.com` 解析到 ECS 公网 IP
- `api.hezeyunchuang.com` 解析到 ECS 公网 IP
- 安全组只开放：
  - 22（最好限制你的 IP）
  - 80
  - 443

## HTTP 阶段

- `http://hezeyunchuang.com` 可访问
- `http://admin.hezeyunchuang.com/admin/login` 可打开
- `http://api.hezeyunchuang.com/api/v1/health` 返回 200
- 上传后的资源 URL 能访问

## HTTPS 阶段

- 证书域名匹配正确
- `https://admin.hezeyunchuang.com` 可打开
- `https://api.hezeyunchuang.com/api/v1/health` 返回 200
- `https://api.hezeyunchuang.com/tinode/v0/version` 可访问
- WebSocket / Tinode 连接正常

## 重启验证

- `docker compose down && docker compose up -d` 后：
  - 数据库数据还在
  - Redis 正常恢复
  - uploads 文件还在
  - admin 访问控制还生效

---

## 12. 风险点

### 1）当前单机 compose 更像基础样例，不是最终生产态
主要问题：

- 直接暴露了端口
- 没有把 `web` 收到 `127.0.0.1`
- 没有完整补齐 uploads 持久化
- Tinode 不是默认内置

### 2）不要让数据库和 Redis 直接对公网开放
这是纯粹找麻烦。

### 3）不要一上来先折腾 HTTPS
先跑通 HTTP，排障更简单。

### 4）根域名入口要确认落到官网，不要误落到后台或商家端
这一点要特别检查最终 Nginx 路由。

---

## 13. 最终建议

首发就做这个最小闭环：

- 单机 ECS 跑通 `db + redis + api + web (+ tinode)`
- 宿主机 Nginx 接 80
- 官网 / admin / api 都能访问
- 最后再补 HTTPS

这套方案够稳、够简单，也最适合你现在“服务器还没正式部署，但 DNS 已经准备好”的状态。
