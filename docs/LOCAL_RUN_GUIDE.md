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

### ⚠️ 不要混跑多套 Compose 栈

本仓库存在多套 Compose 配置（`docker-compose.local.yml` 与 `docker-compose.yml`）。  
本地开发请固定使用 `docker-compose.local.yml`，不要与默认栈同时运行，否则可能出现：
- API 容器端口存在，但请求 `ERR_EMPTY_RESPONSE`
- `db/redis/api` 不在同一网络，`air` 进程在但 Go 子进程已退出

如果已经混跑，可执行：
```bash
# 1) 停掉默认栈
docker compose -f docker-compose.yml down

# 2) 重新拉起本地栈
docker compose -f docker-compose.local.yml up -d db redis api admin
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

## 6. 商家入驻链路启动前检查（5分钟）

为避免本地出现 `column does not exist`（例如 `merchant_applications.role`）导致入驻提交失败，建议在首次拉起或切分支后执行以下检查。

### Step 1: 执行统一幂等 schema 对齐迁移（本地/测试/预发/生产同一入口）

```bash
docker exec -i home_decor_db_local psql -U postgres -d home_decoration \
  < server/migrations/v1.6.9_reconcile_high_risk_schema_guard.sql
```

### Step 2: 本地 schema 健康检查（推荐）

```bash
npm run db:check
```

此命令会检查：
- migration/version 状态
- 高风险表关键列是否存在
- 高风险写入路径 smoke 测试是否通过

### Step 3: 手动校验认证 + 商家入驻关键字段存在（可选）

```bash
docker exec -i home_decor_db_local psql -U postgres -d home_decoration -At -c \
  "SELECT table_name, column_name
  FROM information_schema.columns
  WHERE table_schema='public'
    AND table_name IN ('users','merchant_applications','providers','material_shop_applications','material_shops','sms_audit_logs')
    AND column_name IN ('public_id','last_login_at','last_login_ip','role','entity_type','avatar','work_types','highlight_tags','pricing_json','graduate_school','design_philosophy','legal_acceptance_json','legal_accepted_at','legal_accept_source','source_application_id','team_size','service_area','service_intro','followers_count','certifications','business_hours_json','risk_tier','template_key','template_code')
  ORDER BY table_name, column_name;"
```

### Step 4: 重启 API（清理 prepared statement 缓存）

```bash
docker restart home_decor_api_local
curl -sS http://127.0.0.1:8080/api/v1/health
```

说明：
- `model.go` 仅为代码映射，不是 schema 真相源
- `public.sql` 与 `local_backup.sql` 当前仅视为历史快照，不再作为认证/入驻环境的 schema source of truth
- 重建库时以 `server/migrations/` 为准
- 高风险链路改动前，建议运行 `npm run db:check` 验证

### Step 5: 入驻冒烟（固定验证码）

默认测试模式验证码为 `123456`。若需要显式开启，可在 API 启动环境中设置：
- `SMS_FIXED_CODE_MODE=true`
- `SMS_FIXED_CODE=123456`

可先用接口验证：
- `POST /api/v1/merchant/apply` 提交申请
- `GET /api/v1/merchant/apply/:phone/status` 查询状态
- 管理端审核通过后校验 `GET /api/v1/foremen/:id` / `designers/:id` / `companies/:id`

## 7. 商家入驻链路 E2E 统一入口

四个核心回归用例已统一为一个命令入口（含设计师/工长/主材商必填校验与审核后可见性）：

```bash
cd /Volumes/tantan/AI_project/home-decoration
E2E_API_BASE_URL=http://127.0.0.1:8080/api/v1 npm run test:e2e:merchant:onboarding
```

仅查看用例列表（不执行）：

```bash
cd /Volumes/tantan/AI_project/home-decoration
npm run test:e2e:merchant:onboarding:list
```

商家链路“全量烟测”入口（包含旧用例与 UI 冒烟，环境依赖更强）：

```bash
cd /Volumes/tantan/AI_project/home-decoration
E2E_API_BASE_URL=http://127.0.0.1:8080/api/v1 MERCHANT_ORIGIN=http://127.0.0.1:5173 npm run test:e2e:merchant:smoke
```

仅查看列表：

```bash
cd /Volumes/tantan/AI_project/home-decoration
npm run test:e2e:merchant:smoke:list
```

---

> [!TIP]
> 如果你是首次运行，前端容器需要执行 `npm install`，受网络环境影响可能需要配置镜像源（脚本中已默认使用 `npmmirror`）。
