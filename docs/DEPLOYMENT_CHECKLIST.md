# 生产与测试发布检查清单

本文档用于把 **production / test** 发布动作拆成**发布前 / 发布中 / 发布后**三段，降低漏项概率。

统一发布入口：`deploy/README.md`

---

## 一、发布前

### 1. 版本与代码确认

- [ ] 已确认本次发布内容与范围
- [ ] 已确认将要部署的是 **Git Tag**，不是分支头
- [ ] 目标 tag 已创建并推送，例如 `v1.2.3`
- [ ] 服务器已执行 `git fetch --tags --prune`
- [ ] 服务器工作区干净，无未提交改动

建议命令：

```bash
git fetch --tags --prune
git status --short
git tag --list | tail
```

### 2. 环境与配置确认

- [ ] 已确认目标环境是 `production` 还是 `test`
- [ ] 已确认对应环境变量文件已就绪（如 `deploy/.env` 或 `deploy/.env.test`）
- [ ] 已确认使用正确 compose 文件（如 `deploy/docker-compose.prod.yml` 或 `deploy/docker-compose.test.yml`）
- [ ] 已确认 test/prod 的数据库、Redis、JWT Secret、上传目录与域名入口完全隔离
- [ ] 对应环境的 `docker compose ... config` 校验通过
- [ ] 如本次涉及环境变量变更，已确认影响范围（仅运行时 / 影响构建）
- [ ] 如本次涉及 Nginx 变更，已明确这是高风险发布

### 3. 备份确认

- [ ] 已执行数据库备份
- [ ] 如涉及 uploads / 静态资源风险，已执行 uploads 备份
- [ ] 如有 OSS 备份要求，已同步或确认稍后同步
- [ ] 已记录备份文件路径和时间

### 4. 数据库迁移确认

- [ ] 本次是否包含数据库 schema 变更已确认
- [ ] 若包含 schema 变更，已准备 `*_up.sql`
- [ ] 若包含 schema 变更，已准备 `*_down.sql`
- [ ] 若包含 schema 变更，已准备验证 SQL 或验证步骤
- [ ] 若包含 schema 变更，已明确“数据库回滚不自动执行”

---

## 二、发布中

### 1. 选择正确的更新范围

- [ ] 仅后端改动时，选择 `api`
- [ ] 仅前端 / website / admin / nginx 静态资源改动时，选择 `web`
- [ ] 前后端都改时，选择 `all`
- [ ] 未把 `docker compose down && up -d --build` 当作常规动作

### 2. 标准发布动作

- [ ] 已执行对应环境的标准发布脚本
- [ ] 已确认发布脚本不会自动执行数据库迁移
- [ ] 未在 test 环境误用 `deploy_prod.sh`，未在 production 环境误用 `deploy_test.sh`

Production 示例：

```bash
bash deploy/scripts/deploy_prod.sh --tag v1.2.3 --service api
```

Test 示例：

```bash
bash deploy/scripts/deploy_test.sh --tag v1.2.3 --service api
```

或：

```bash
bash deploy/scripts/deploy_prod.sh --tag v1.2.3 --service web
```

或：

```bash
bash deploy/scripts/deploy_prod.sh --tag v1.2.3 --service all
```

### 3. 如涉及数据库迁移

- [ ] 已先执行备份
- [ ] 已执行对应 `*_up.sql`
- [ ] 已执行验证 SQL
- [ ] 已确认数据库迁移结果后再更新服务
- [ ] 已记录迁移脚本名、执行时间、执行结果

---

## 三、发布后

### 1. 容器与日志检查

- [ ] 对应 compose 的 `ps` 正常
- [ ] `api` 日志无明显报错
- [ ] `web` 日志无明显报错
- [ ] test 与 prod 可并行运行且容器名 / 网络 / 卷 / 端口不冲突

建议命令（Production）：

```bash
docker compose -f deploy/docker-compose.prod.yml ps
docker compose -f deploy/docker-compose.prod.yml logs --tail=100 api
docker compose -f deploy/docker-compose.prod.yml logs --tail=100 web
```

### 2. 健康检查

- [ ] API 健康检查通过

```bash
curl -fsS http://127.0.0.1:8888/api/v1/health
```

### 3. 人工验证

- [ ] Website 首页可访问
- [ ] Website 关键页面可访问
- [ ] Admin `/admin/` 可访问
- [ ] 关键 API 功能正常
- [ ] 如本次涉及 uploads，抽查资源访问正常
- [ ] 如本次涉及 Nginx，已验证 website / admin / api 三条入口链路

### 4. 发布记录

- [ ] 已记录本次发布 tag
- [ ] 已记录上一个稳定 tag
- [ ] 已记录本次更新范围（api / web / all）
- [ ] 已记录备份文件
- [ ] 已记录是否涉及数据库迁移
- [ ] 已记录回滚目标 tag

---

## 四、异常时处理

### 1. 是否需要立刻回滚

满足以下任一条件应立即进入回滚评估：

- [ ] API 健康检查失败
- [ ] Website 关键页面不可用
- [ ] Admin 不可用
- [ ] 日志持续报错且无法快速止损
- [ ] 本次数据库变更导致服务无法启动

### 2. 标准回滚动作

```bash
bash deploy/scripts/rollback_prod.sh --tag v1.2.2 --service api
```

或：

```bash
bash deploy/scripts/rollback_prod.sh --tag v1.2.2 --service all
```

### 3. 数据库回滚确认

- [ ] 已确认是否真的需要数据库回滚
- [ ] 已确认执行 `*_down.sql` 是否会导致数据丢失
- [ ] 已确认是否更适合从备份恢复
- [ ] 数据库回滚保留人工确认，不自动化盲执行
