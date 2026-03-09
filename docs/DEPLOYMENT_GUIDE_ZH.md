# 生产与测试部署指南

本文档用于说明**当前仓库推荐的生产部署与日常更新方式**。

重点不是建设重型 CI/CD，而是在复用现有生产 Docker Compose、Dockerfile、Nginx 配置和备份脚本的前提下，建立一条**低出错、可回滚、便于执行**的标准 SOP。

> 统一入口：`deploy/README.md`

---

## 1. 当前推荐的部署模式

当前项目默认采用以下发布策略：

- **production**：正式环境，只部署 Git Tag，不直接上线分支头
- **test**：长期复用测试环境，使用独立 compose / env / 域名 / 数据 / 回滚链路
- **发布前先备份**（数据库必备，uploads 视情况但推荐默认执行）
- **按服务最小化更新**，优先只更新 `api` 或 `web`
- **发布后做基础验证**，至少检查容器、日志、健康检查和关键页面
- **回滚以 Tag 为主**，数据库回滚独立判断

Production 推荐命令：

```bash
bash deploy/scripts/deploy_prod.sh --tag v1.2.3 --service api
```

回滚命令：

```bash
bash deploy/scripts/rollback_prod.sh --tag v1.2.2 --service api
```

Test 推荐命令：

```bash
bash deploy/scripts/deploy_test.sh --tag v1.2.3 --service api
```

Test 回滚命令：

```bash
bash deploy/scripts/rollback_test.sh --tag v1.2.2 --service api
```

> 说明：发布脚本负责备份、切 tag、按服务更新和基础验证；**数据库迁移不会由脚本自动执行**，如涉及 schema 变更，必须先按 `docs/DATABASE_MIGRATIONS.md` 受控执行。认证/短信审计/商家入驻统一补洞入口为 `server/migrations/v1.6.4_reconcile_auth_and_onboarding_schema.sql`。

---

## 2. 环境基线

当前仓库已具备以下部署资产：

### Production

- 生产编排：`deploy/docker-compose.prod.yml`
- 托管资源编排：`deploy/docker-compose.prod.managed.yml`
- 后端镜像构建：`deploy/Dockerfile.backend`
- 前端 / Nginx 镜像构建：`deploy/Dockerfile.frontend`、`deploy/Dockerfile.frontend.prod`
- Nginx 路由与静态站点入口：`deploy/nginx/nginx.conf`、`deploy/nginx/nginx.prod.conf`
- 备份脚本：`deploy/scripts/backup_postgres.sh`、`deploy/scripts/backup_uploads.sh`
- 宿主机 Nginx 模板：`deploy/nginx/host_nginx_http.conf`、`deploy/nginx/host_nginx_prod.conf`

### Test

- 测试编排：`deploy/docker-compose.test.yml`
- 测试托管资源编排：`deploy/docker-compose.test.managed.yml`
- 测试环境文件模板：`deploy/.env.test.example`
- 测试发布脚本：`deploy/scripts/deploy_test.sh`
- 测试回滚脚本：`deploy/scripts/rollback_test.sh`
- 测试宿主机 Nginx 模板：`deploy/nginx/host_nginx_test_http.conf`、`deploy/nginx/host_nginx_test.conf`
- 测试默认 loopback 端口：`127.0.0.1:8889`

> 如果生产环境或测试环境使用托管 RDS/Redis、宿主机 Nginx 或阿里云变体部署，也建议沿用**同一套发布规则**，只是替换为对应的 compose 文件和环境变量。

---

## 3. 日常发版 SOP

### 3.1 发布前

1. 本地完成开发、测试、代码审查
2. 创建并推送发布 tag

```bash
git tag v1.2.3
git push origin v1.2.3
```

3. 登录生产服务器，进入仓库目录
4. 获取最新 tag

```bash
git fetch --tags --prune
```

5. 确认工作区干净

```bash
git status --short
```

6. 确认 `deploy/.env` 或对应生产环境变量文件已就绪

### 3.2 发布中

根据变更类型选择更新范围：

- 仅后端 Go 代码变更：

```bash
bash deploy/scripts/deploy_prod.sh --tag v1.2.3 --service api
```

- 仅前端页面 / Website / Admin / Nginx 静态资源变更：

```bash
bash deploy/scripts/deploy_prod.sh --tag v1.2.3 --service web
```

- 前后端都改：

```bash
bash deploy/scripts/deploy_prod.sh --tag v1.2.3 --service all
```

### 3.3 发布后

至少执行：

```bash
docker compose -f deploy/docker-compose.prod.yml ps
docker compose -f deploy/docker-compose.prod.yml logs --tail=100 api
docker compose -f deploy/docker-compose.prod.yml logs --tail=100 web
curl -fsS http://127.0.0.1:8888/api/v1/health
```

还应人工检查：

- website 首页或核心页面
- `/admin/` 后台入口
- 关键 API
- uploads 资源访问（若本次涉及）

---

## 4. 按改动类型选择动作

| 改动类型 | 推荐动作 | 说明 |
|---|---|---|
| 仅后端 Go 代码 | rebuild `api` | 不动 `web` |
| 仅前端 / 静态站点 / Nginx 配置 | rebuild `web` | 不动 `api` |
| 前后端都改 | rebuild `api` + `web` | 使用 `--service all` |
| 仅运行时环境变量变化 | restart / recreate 对应服务 | 若不影响 build，可不全量 rebuild |
| 构建期环境变量变化 | rebuild 对应服务 | 例如前端构建注入 |
| 数据库 schema 变更 | 先迁移，再更新服务 | 数据库步骤必须单独执行，认证/入驻链路优先执行 `server/migrations/v1.6.4_reconcile_auth_and_onboarding_schema.sql` |

> 默认不要使用 `docker compose down && docker compose up -d --build` 作为常规动作，除非确认要整体重建整套服务。

---

## 5. 数据库变更规范

当前仓库没有统一 migration runner，因此生产环境数据库变更采用：

- **受控手工执行**
- **SQL 文件规范化提交**
- **执行过程文档化**
- **回滚与验证脚本成对提供**

### 5.1 必须遵守

- 迁移前必须备份数据库
- 每次 schema 变更必须提供回滚 SQL
- 发布流程中必须单独记录迁移步骤和验证结果
- 数据库回滚不建议全自动化，保留人工确认

### 5.2 推荐文件形式

放在：`server/migrations/`（唯一正式 schema 发布目录）

推荐每次迁移至少提交：

- `YYYYMMDD_<name>_up.sql`
- `YYYYMMDD_<name>_down.sql`
- 可选：`YYYYMMDD_<name>_verify.sql`

历史/辅助脚本继续保留在 `server/scripts/migrations/`，但不作为正式发版依据。详细规范见：`docs/DATABASE_MIGRATIONS.md`

---

## 6. Tag 发布规则

### 6.1 为什么必须用 Tag

因为 Tag 具备以下优点：

- 对应代码快照稳定，不受后续提交漂移影响
- 便于记录发布版本
- 便于服务器精确切换
- 便于回滚到上一个稳定版本

### 6.2 不推荐的做法

以下方式不应作为生产日常 SOP：

```bash
git pull origin main
git pull origin dev
docker compose up -d --build
```

原因：

- 上线内容不够精确
- 回滚基线不清晰
- 容易把未准备好的提交一起带上去

---

## 7. 回滚策略

### 7.1 代码回滚

回滚时切换到上一个稳定 tag，再只重建受影响服务：

```bash
bash deploy/scripts/rollback_prod.sh --tag v1.2.2 --service web
```

### 7.2 数据库回滚与代码回滚分离

需要明确：

- 代码回滚不自动代表数据库也应回滚
- 如果数据库迁移是向前兼容的，很多情况下只需要回滚代码
- 如果数据库迁移不可兼容，再根据 `*_down.sql` 或备份恢复方案人工处理

### 7.3 建议的回滚判断

1. **仅页面或 API 逻辑异常**：优先回滚代码
2. **Schema 变更导致应用启动失败**：评估是否需要执行数据库回滚
3. **数据已被新逻辑写坏**：优先使用备份恢复或受控修复，不要盲目 down SQL

---

## 8. 发布与回滚常用命令

### 8.1 检查 Compose 配置

```bash
docker compose -f deploy/docker-compose.prod.yml config
```

### 8.2 查看状态

```bash
docker compose -f deploy/docker-compose.prod.yml ps
```

### 8.3 查看日志

```bash
docker compose -f deploy/docker-compose.prod.yml logs --tail=100 api
docker compose -f deploy/docker-compose.prod.yml logs --tail=100 web
```

### 8.4 健康检查

```bash
curl -fsS http://127.0.0.1:8888/api/v1/health
```

---

## 9. 相关文档

- 总入口：`deploy/README.md`
- 发布与回滚：`docs/版本发布与回滚指南.md`
- 检查清单：`docs/DEPLOYMENT_CHECKLIST.md`
- 数据库迁移：`docs/DATABASE_MIGRATIONS.md`
- 阿里云生产落地：`deploy/ALIYUN_PRODUCTION_LAUNCH.md`
