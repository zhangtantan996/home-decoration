# 生产与测试部署总入口

本文档是当前仓库的**统一生产部署入口**。

目标只有一件事：在**复用现有 Docker Compose、Dockerfile、Nginx 配置和备份脚本**的前提下，收敛出一条**简单、安全、可回滚**的标准发布路径。

> 当前项目阶段的默认生产模式：**Git Tag 发布 + 发布前备份 + 按服务更新 + 发布后验证 + Tag 回滚**

推荐先读：

- `deploy/正式上线实施方案.md`：面向当前项目的正式上线目标态、采购清单、域名规划与实施阶段
- `docs/DEPLOYMENT_GUIDE_ZH.md`：当前仓库的生产与测试部署 SOP
- `deploy/阿里云生产上线指南.md`：阿里云资源购买与落地细节

---

## 1. 默认部署策略

### 1.1 统一原则

项目当前维护两套长期部署环境：

- `production`：正式环境，对外真实流量
- `test`：长期复用的测试服务器环境，用于联调、验收、演练与预发布验证

两套环境必须遵循相同发布原则，但使用各自独立的 compose、环境文件、入口域名、数据库、Redis、JWT Secret、上传目录与回滚脚本。

生产环境默认遵循以下规则：

1. **只部署 Git Tag**
   - 不直接上线漂移中的分支头
   - 不以 `git pull origin <branch>` 作为常规生产发布动作
2. **每次发布前必须备份**
   - 至少备份数据库
   - 如涉及用户上传文件，同时备份 `server/uploads`
3. **默认按服务更新**
   - 仅后端改动：更新 `api`
   - 仅前端 / Nginx / 静态站点改动：更新 `web`
   - 前后端都改：更新 `api web`
   - **不要**把 `docker compose down && docker compose up -d --build` 当作常规发布方式
4. **数据库变更必须单独执行**
   - 迁移前先备份
   - 必须有对应回滚 SQL
   - 数据库回滚与代码回滚分开决策
5. **每次发布后必须验证**
   - 容器状态
   - 关键日志
   - API 健康检查
   - Website / Admin 关键页面
6. **回滚以 Git Tag 为主**
   - 回滚代码到上一个稳定 tag
   - 仅重建受影响服务
   - 数据库回滚保留人工确认步骤

### 1.2 当前默认基线

当前仓库默认以以下资产作为基线：

#### Production

- 生产编排：`deploy/docker-compose.prod.yml`
- 托管资源编排：`deploy/docker-compose.prod.managed.yml`
- 后端镜像：`deploy/Dockerfile.backend`
- 前端 / Nginx 镜像：`deploy/Dockerfile.frontend`、`deploy/Dockerfile.frontend.prod`
- 容器 Nginx：`deploy/nginx/nginx.conf`、`deploy/nginx/nginx.prod.conf`
- 宿主机 Nginx：`deploy/nginx/host_nginx_http.conf`、`deploy/nginx/host_nginx_prod.conf`
- 当前生产入口标准：`deploy/生产Nginx标准.md`
- 发布脚本：`deploy/scripts/deploy_prod.sh`
- 回滚脚本：`deploy/scripts/rollback_prod.sh`

#### Test

- 测试编排：`deploy/docker-compose.test.yml`
- 测试托管资源编排：`deploy/docker-compose.test.managed.yml`
- 测试环境文件模板：`deploy/.env.test.example`
- 测试发布脚本：`deploy/scripts/deploy_test.sh`
- 测试回滚脚本：`deploy/scripts/rollback_test.sh`
- 测试宿主机 Nginx：`deploy/nginx/host_nginx_test_http.conf`、`deploy/nginx/host_nginx_test.conf`
- 测试容器默认 loopback 端口：`127.0.0.1:8889`

#### Shared

- 备份脚本：`deploy/scripts/backup_*.sh`
- 公共发布库：`deploy/scripts/lib/release_common.sh`

> 如你使用托管 RDS/Redis 或阿里云变体部署，仍建议沿用**同一套 SOP**，只是把 compose 文件、环境变量和备份方式替换为对应环境。

---

## 2. 标准发布矩阵

| 改动类型 | 是否需要备份 | 是否需要数据库迁移 | 推荐动作 |
|---|---|---:|---|
| 仅后端 Go 代码 | 是 | 否 | 更新 `api` |
| 仅前端页面 / Admin / Website / Nginx 静态站点 | 建议是 | 否 | 更新 `web` |
| 前后端都改 | 是 | 否 | 更新 `api web` |
| 环境变量变更（仅运行时） | 建议是 | 否 | 对应服务 `restart` 或 `up -d` |
| 环境变量变更（影响构建） | 是 | 否 | 对应服务重新 build |
| 数据库 schema 变更 | **必须** | **是** | 先备份 → 执行迁移 → 再更新服务 |
| uploads / 媒体目录相关改动 | **必须** | 否 | 先备份 uploads，再更新对应服务 |

### 2.1 风险说明

- `web` 不仅影响后台，也可能影响 website 静态内容和 Nginx 路由分发。
- 任何 `deploy/nginx/nginx.conf` 相关变更都视为**高风险发布**，发布后需扩大验证范围。
- 数据库变更不是“顺手一起发”的步骤，必须单独记录执行人与验证结果。
- test 与 production 禁止共享数据库、Redis、JWT Secret、上传目录、域名入口与宿主机 loopback 端口。

---

## 3. 标准生产发布 SOP

### 3.1 发布前准备

1. 在本地确认代码已经合并并测试完成
2. 创建并推送发布 tag，例如：

```bash
git tag v1.2.3
git push origin v1.2.3
```

3. 登录生产服务器，进入仓库根目录
4. 确认服务器没有未提交改动
5. 确认 `deploy/.env` 等生产环境变量已就绪

### 3.2 常规发布命令

在服务器仓库根目录执行：

```bash
bash deploy/scripts/deploy_prod.sh --tag v1.2.3 --service api
```

或：

```bash
bash deploy/scripts/deploy_prod.sh --tag v1.2.3 --service web
```

或：

```bash
bash deploy/scripts/deploy_prod.sh --tag v1.2.3 --service all
```

脚本会串联以下步骤：

1. 校验当前仓库、tag、工作区与环境文件
2. 自动执行发布前备份
3. 切换到指定 tag
4. 根据 `api` / `web` / `all` 仅更新受影响服务
5. 执行最小健康验证
6. 输出发布后建议检查命令

> 说明：`deploy_prod.sh` 负责代码发布、服务更新和基础验证；**不会自动执行数据库迁移**。如本次发布涉及 schema 变更，仍需先按数据库迁移规范人工执行迁移与验证。

### 3.3 数据库变更发布

如果本次发布包含数据库结构变更，流程必须改为：

1. 先执行发布前备份
2. 按 `docs/数据库迁移规范.md` 执行对应 `*_up.sql`
3. 运行验证 SQL
4. 再执行 `deploy_prod.sh`
5. 将本次迁移脚本、执行时间、验证结果记录到发布记录中

> **禁止**把数据库 schema 变更隐含在应用启动过程中自动完成。

---

## 4. 标准回滚 SOP

### 4.1 何时回滚

满足任一情况即可启动回滚评估：

- API 健康检查失败
- Website / Admin 关键路径异常
- 核心功能不可用
- 错误日志持续增长且无法快速热修
- 数据迁移已执行但应用逻辑不兼容

### 4.2 常规代码回滚命令

```bash
bash deploy/scripts/rollback_prod.sh --tag v1.2.2 --service api
```

或：

```bash
bash deploy/scripts/rollback_prod.sh --tag v1.2.2 --service all
```

脚本会：

1. 校验目标 tag 存在
2. 切回指定稳定 tag
3. 按服务重新 build / up
4. 执行最小验证

### 4.3 数据库回滚原则

- **代码回滚 ≠ 数据库自动回滚**
- 如果新版本已经执行 schema/data migration，必须单独判断是否需要执行 `*_down.sql`
- 数据库回滚前必须再次确认：
  - 是否有新写入数据会丢失
  - 是否只是代码兼容性问题，数据库可保持不动
  - 是否更适合回滚数据库备份而不是直接执行 down SQL

---

## 5. 发布后验证清单

每次发布后至少执行：

```bash
docker compose -f deploy/docker-compose.prod.yml ps
docker compose -f deploy/docker-compose.prod.yml logs --tail=100 api
docker compose -f deploy/docker-compose.prod.yml logs --tail=100 web
curl -fsS http://127.0.0.1:8888/api/v1/health
```

还应人工验证：

- Website 首页是否可访问
- Admin `/admin/` 是否可访问
- API 域名或入口代理是否正常
- 如本次改动涉及上传文件：抽查 `/uploads/` 资源
- 如本次改动涉及 Nginx：验证 website / admin / api 三条入口链路

---

## 6. 备份入口

### 6.1 现有备份脚本

- 数据库备份：`deploy/scripts/backup_postgres.sh`
- uploads 备份：`deploy/scripts/backup_uploads.sh`
- 一次性备份并同步 OSS：`deploy/scripts/backup_and_sync_oss.sh`
- 仅同步备份到 OSS：`deploy/scripts/oss_sync_backups.sh`

### 6.2 最低要求

常规发布前至少执行：

- 数据库备份
- 若本次涉及上传文件或静态资源风险较高，再补做 uploads 备份

`deploy_prod.sh` 默认会同时调用数据库备份和 uploads 备份；如果环境不支持对应备份脚本，需先补齐环境变量或按文档手工执行。

---

## 7. 数据库迁移入口

数据库迁移规范请统一参考：

- `docs/数据库迁移规范.md`

当前仓库已有迁移目录：

- `server/scripts/migrations/`

后续新迁移统一建议提交：

- `*_up.sql`
- `*_down.sql`
- 可选：`*_verify.sql`

---

## 8. 关联文档索引

- 完整部署与运维说明：`docs/部署指南.md`
- 发布与回滚策略：`docs/版本发布与回滚指南.md`
- 上线检查清单：`docs/发布检查清单.md`
- 数据库迁移规范：`docs/数据库迁移规范.md`
- 阿里云落地方案：`deploy/阿里云生产上线指南.md`

---

## 9. 推荐日常使用方式

### 发布

```bash
bash deploy/scripts/deploy_prod.sh --tag v1.2.3 --service api
```

### 回滚

```bash
bash deploy/scripts/rollback_prod.sh --tag v1.2.2 --service api
```

### 发布前手工检查

```bash
docker compose -f deploy/docker-compose.prod.yml config
git status --short
git tag --list | tail
```

### 发布后检查

```bash
docker compose -f deploy/docker-compose.prod.yml ps
docker compose -f deploy/docker-compose.prod.yml logs --tail=100 api
docker compose -f deploy/docker-compose.prod.yml logs --tail=100 web
curl -fsS http://127.0.0.1:8888/api/v1/health
```
