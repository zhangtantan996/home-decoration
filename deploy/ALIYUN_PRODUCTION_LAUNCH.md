# 阿里云生产上线落地指南（MVP：托管 RDS + 托管 Redis + Tinode + 阿里云短信）

> 面向本仓库的**首版上线**流程与“需要购买的云服务”清单。  
> 默认：阿里云（中国内地）+ 小流量 MVP + **托管 DB/Redis** + **Tinode 自建 IM** + **阿里云短信**。

---

## 0. 你要买什么（生产必买）

> 建议全部放在同一地域（默认**华东1 杭州**）+ 同一 VPC。

1) **VPC + vSwitch**
- 1 个生产专用 VPC、1 个交换机（建议同可用区）

2) **ECS（1 台，Ubuntu 22.04）**
- 推荐：u1/e 实例 **4C8G**（最低 2C4G）
- 系统盘：ESSD **100GB**
- 公网带宽：按量计费，峰值建议 **≥20Mbps**（图片多可 50–100Mbps）

3) **RDS PostgreSQL 15（托管数据库）**
- 推荐：**2C4G / 50G ESSD**
- 在 RDS 中创建两个数据库：
  - `home_decoration`（主业务库）
  - `tinode`（Tinode 专用库，后端代码固定会尝试连接该库）
- 开启自动备份（7–14 天保留）

4) **ApsaraDB for Redis（托管 Redis）**
- 1GB 起即可（MVP）
- 开启密码，仅内网访问

5) **OSS（对象存储）**
- 首版用途：**备份 DB 导出文件 / 备份 uploads 压缩包**
- Bucket 权限建议私有

6) **域名 + 备案 + HTTPS 证书**
- 建议准备两个子域名（也可以先用一个域名）：
  - `admin.<domain>`：管理后台
  - `api.<domain>`：API + Tinode + uploads
- HTTPS：推荐 **宿主机 Nginx + Let's Encrypt（自动续期）**

7) **阿里云短信**
- 上线必须接入真实短信验证码（代码中 debug 环境可用 `123456`，但 release 禁用）
- 需要短信签名与短信模板（审核需要时间，越早越好）

---

## 0.1 建议购买顺序（照此买就能落地）

1) 域名（立刻买，立刻启动备案）  
2) VPC + vSwitch（生产专用）  
3) RDS PostgreSQL（创建 `home_decoration` + `tinode` 两个库）  
4) ApsaraDB for Redis（同 VPC）  
5) ECS（同 VPC，配安全组：`22(仅你的IP)`, `80`, `443`）  
6) OSS（备份桶，先用于备份即可）  
7) 阿里云短信（签名/模板尽早提审）  

## 0.2 可选但推荐（按需购买）

- CDN：用于 OSS 图片/静态资源加速（成本低、收益明显）
- WAF：给 `api.<domain>`/管理后台做基础防护（后续流量上来再加）
- SLS 日志服务：集中采集 Nginx/API 日志，便于审计与排障
- ACR 镜像仓库：需要 CI/CD（GitHub Actions 构建镜像 → ACR → ECS 拉取）时再买

## 1. 部署形态（本仓库推荐）

### 1.1 宿主机 Nginx（80/443） + Docker 容器（本地 8888）

- Docker 中运行：
  - Go API（连接 RDS + Redis）
  - Tinode（连接 RDS 的 `tinode` 库）
  - Nginx（容器内监听 `8888`，对外仅绑定到 `127.0.0.1:8888`）
- ECS 宿主机运行 Nginx：
  - 终止 TLS
  - 根据域名路由到 `127.0.0.1:8888`

对应配置文件：
- Docker：`deploy/docker-compose.prod.managed.yml`
- 容器 Nginx：`deploy/nginx/nginx.prod.conf`
- 宿主机 Nginx 模板：`deploy/nginx/host_nginx_prod.conf`

---

## 2. 生产环境变量（必须配置）

生产环境变量建议放在：`deploy/.env`（只存在服务器上，不要提交 Git）。

从模板生成：
```bash
cd deploy
cp ../.env.example .env
```

你至少需要填写/确认这些（示例值仅为说明）：

### 2.1 后端（Go API）
- `APP_ENV=production`
- `SERVER_MODE=release`
- `SERVER_PUBLIC_URL=https://api.<domain>`
- `CORS_ALLOWED_ORIGINS=https://admin.<domain>`（多个用逗号分隔；开发可用 `*`，生产强烈建议显式白名单）

数据库（RDS 内网地址）：
- `DATABASE_HOST=pgm-xxx.pg.rds.aliyuncs.com`（建议用内网）
- `DATABASE_PORT=5432`
- `DATABASE_USER=postgres`
- `DATABASE_PASSWORD=******`
- `DATABASE_DBNAME=home_decoration`
- `DATABASE_SSLMODE=disable`（若你启用 RDS SSL，请改为 `require`）

Redis（托管 Redis 内网地址）：
- `REDIS_HOST=r-xxx.redis.rds.aliyuncs.com`
- `REDIS_PORT=6379`
- `REDIS_PASSWORD=******`

密钥：
- `JWT_SECRET=...`（64 字节随机，建议 `openssl rand -base64 64`）
- `ENCRYPTION_KEY=...`（32 字节随机，建议 `openssl rand -base64 32`）

Tinode（后端用于生成 Tinode token）：
- `TINODE_UID_ENCRYPTION_KEY=...`（16 字节 base64）
- `TINODE_AUTH_TOKEN_KEY=...`（32 字节 base64，解码后长度需 ≥ 32）

短信（阿里云短信）：
- `SMS_PROVIDER=aliyun`
- `SMS_ACCESS_KEY_ID=...`
- `SMS_ACCESS_KEY_SECRET=...`
- `SMS_SIGN_NAME=...`
- `SMS_TEMPLATE_CODE=...`

### 2.2 Tinode 容器（IM 服务）
需要这些变量（也在同一份 `deploy/.env` 中）：
- `TINODE_DATABASE_DSN=postgres://<user>:<pass>@<rds-host>:5432/tinode?sslmode=disable`
- `TINODE_API_KEY_SALT=...`
- `TINODE_UID_ENCRYPTION_KEY=...`（与后端一致）
- `TINODE_AUTH_TOKEN_KEY=...`（与后端一致）

### 2.3 管理后台访问加固（IP 白名单 + BasicAuth）

生产镜像已内置以下 Nginx 规则（`deploy/nginx/nginx.prod.conf`）：
- `/admin/` 路径启用 IP 白名单（`/etc/nginx/admin_allowlist.conf`）
- `/admin/` 路径启用 BasicAuth（`/etc/nginx/admin.htpasswd`）
- 根域名 `/` 返回官网静态页，商家端入口保留在 `/merchant`

`docker-compose.prod.managed.yml` 已将这两个文件映射为宿主机可维护文件：
- `deploy/nginx/admin_allowlist.conf`
- `deploy/nginx/admin.htpasswd`

部署前请先配置：

1) 编辑白名单 `deploy/nginx/admin_allowlist.conf`，加入办公出口 IP
```nginx
allow 203.0.113.10;
allow 198.51.100.24;
deny all;
```

2) 同时在 `deploy/.env` 配置应用层白名单
```bash
ADMIN_AUTH_ALLOWED_CIDRS=203.0.113.10/32,198.51.100.24/32,10.10.0.0/16
SERVER_TRUSTED_PROXIES=127.0.0.1,::1,10.0.0.0/8,172.16.0.0/12,192.168.0.0/16
```

3) 生成 BasicAuth 密码文件（示例用户 `admin`）
```bash
cd /opt/home_decoration
printf "admin:$(openssl passwd -apr1 'ReplaceWithStrongPassword')\n" > deploy/nginx/admin.htpasswd
chmod 600 deploy/nginx/admin.htpasswd
```

4) 热更新配置
```bash
cd /opt/home_decoration/deploy
docker compose -f docker-compose.prod.managed.yml up -d api web
```

5) 验证
- 白名单 IP + 正确账号密码：可访问 `/admin/login`
- 非白名单 IP：403
- 白名单 IP + 错误密码：401
- 白名单 IP 访问 `/api/v1/admin/*`：不应再被应用层误拦截

---

## 3. 一键启动（Docker）

在 ECS 上：
```bash
cd /opt/home_decoration/deploy
docker compose -f docker-compose.prod.managed.yml up -d --build
docker compose -f docker-compose.prod.managed.yml ps
```

---

## 4. HTTPS（宿主机 Nginx）

将模板复制到你的 Nginx 站点配置并替换占位符：
- `deploy/nginx/host_nginx_prod.conf`

建议流程：
1. 安装 Nginx + certbot
2. 配置 HTTP 站点（包含 `/.well-known/acme-challenge/`）
3. 申请证书后启用 443
4. reload Nginx

---

## 5. 验收清单（上线前必须过）

1) 健康检查：
- `GET https://api.<domain>/api/v1/health` 返回 200

2) Tinode：
- `GET https://api.<domain>/tinode/v0/version` 可访问
- 移动端能建立连接并收发消息（WSS）

3) 上传：
- 上传接口返回的 `url` 可访问
- 重启容器后上传文件不丢（`../server/uploads` 已做持久化）

4) 短信：
- release 模式下 `/api/v1/auth/send-code` 不再返回测试验证码
- 注册/登录必须通过真实短信验证码校验

5) 安全（最小暴露）：
- 安全组仅开放 `80/443`（以及 `22` 限定你的 IP）
- 数据库与 Redis 不暴露公网，仅内网访问

---

## 6. 备份（推荐）

> 托管 RDS 仍建议保留一份“可离线恢复”的定期导出；uploads 目录也需要定期备份。

在 ECS 上执行（从 `deploy/` 目录）：
```bash
cd deploy
mkdir -p backups

# 1) 备份主库 + tinode 库（需要 DATABASE_* 环境变量）
bash ./scripts/backup_postgres.sh

# 2) 备份 uploads（默认 ../server/uploads）
bash ./scripts/backup_uploads.sh
```

将生成的 `deploy/backups/*` 上传到 OSS（可用 ossutil/aliyun-cli 或阿里云控制台）。

> 如果你当前是“本地上传 + 先用 OSS 免费包做备份”，可直接按 `deploy/OSS_FREE_PLAN_SETUP.md` 执行（含 `crontab` 示例与一键脚本）。
