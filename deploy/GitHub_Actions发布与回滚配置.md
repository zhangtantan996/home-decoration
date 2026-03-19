# GitHub Actions 发布与回滚配置

这套配置的目标只有三件事：

1. **版本可追踪**：生产只部署 Git Tag
2. **发布可自动化**：推送 Tag 后自动校验并部署
3. **回退可执行**：在 GitHub 上手工选择旧 Tag 回滚

当前仓库已经有发布脚本与回滚脚本：

- `deploy/scripts/deploy_prod.sh`
- `deploy/scripts/rollback_prod.sh`
- `deploy/scripts/deploy_test.sh`
- `deploy/scripts/rollback_test.sh`

本次新增的 GitHub Actions 会先在 GitHub Runner 上 checkout 对应代码，再通过 SSH 同步到服务器，然后调用发布脚本：

- `.github/workflows/release-prod.yml`
- `.github/workflows/rollback-prod.yml`
- `.github/workflows/deploy-test.yml`
- `.github/workflows/rollback-test.yml`

## 1. 推荐版本策略

生产环境不要直接跟着 `dev` 自动发布，建议固定为：

- 日常开发合并到 `dev`
- 准备上线时打 Tag
- 只有 `v*` Tag 触发生产发布

推荐格式：

- `v1.12.3`
- `v1.12.4`

这样回滚时只需要选择上一个稳定 Tag。

## 2. GitHub 侧要配什么

### 2.1 Environment

在 GitHub 仓库里创建 `production` Environment，建议开启人工审批。

### 2.2 Production Secrets

在仓库或 `production` Environment 中配置：

- `PROD_HOST`：生产服务器 IP 或域名
- `PROD_PORT`：SSH 端口，可为空，默认 `22`
- `PROD_USER`：SSH 登录用户
- `PROD_SSH_KEY`：用于部署的私钥
- `PROD_APP_DIR`：服务器上的仓库目录，例如 `/opt/home-decoration`
- `PROD_KNOWN_HOSTS`：可选，推荐填入 `ssh-keyscan -H <host>` 的结果；不填则 workflow 会在运行时自动 `ssh-keyscan`

### 2.3 Test Secrets

在仓库级别配置：

- `TEST_HOST`：测试服务器 IP 或域名
- `TEST_PORT`：SSH 端口，可为空，默认 `22`
- `TEST_USER`：SSH 登录用户
- `TEST_SSH_KEY`：用于测试部署的私钥
- `TEST_APP_DIR`：测试环境仓库目录，例如 `/root/home-decoration-test`
- `TEST_KNOWN_HOSTS`：可选，推荐填入 `ssh-keyscan -H <host>` 的结果

## 3. 服务器上要配什么

### 3.1 基础环境

服务器需要具备：

- `git`
- `docker`
- `docker compose`
- `curl`

并且生产仓库目录要固定，例如：

```bash
/opt/home-decoration
```

### 3.2 生产环境文件

服务器上准备：

```bash
deploy/.env
```

可以从：

```bash
deploy/.env.production.example
```

拷贝后填写。

### 3.3 额外文件

如果你启用了后台 BasicAuth，还需要：

```bash
deploy/nginx/admin.htpasswd
```

### 3.4 工作区要求

如果你走当前这套 GitHub Actions 同步模式：

- 服务器**不需要**主动访问 GitHub
- GitHub Runner 会把代码同步到服务器
- `deploy/.env`、`deploy/.env.test`、`deploy/backups/`、`server/uploads*` 会保留在服务器，不会被同步覆盖
- 测试环境发布脚本会固定使用独立的 Compose Project：`home_decoration_test`，避免和生产环境的 `deploy` 项目互相影响

## 4. 自动发布怎么触发

### 4.1 `dev` 自动部署测试环境

当 `dev` 有代码推送时，`Deploy Test` 会自动：

1. 构建 `admin`
2. 构建 `merchant`
3. 构建 `web`
4. 跑 `server` 的 `go test ./...`
5. 通过 SSH + rsync 把当前 commit 同步到测试服务器
6. 在测试服务器执行：

```bash
bash deploy/scripts/deploy_test.sh --ref <commit-sha> --service all
```

补充说明：

- 测试发布会自动清理旧的冲突 `test_*` 容器，避免从旧 Compose Project 迁移时出现容器名冲突
- API / web / admin 路由检查带重试，首次起库较慢时不会因为瞬时 `502` 直接判失败
- test compose 默认开启 `DATABASE_AUTO_MIGRATE=true`，用于空测试库首次引导；生产环境仍保持手动迁移策略

如果你不想等 push，也可以在 GitHub Actions 页面手工运行：

- workflow：`Deploy Test`
- 输入：
  - `ref`
  - `service_scope`

### 4.2 正常发布生产

本地打 Tag 并推送：

```bash
git tag -a v1.12.3 -m "release v1.12.3"
git push origin v1.12.3
```

然后 GitHub Actions 会自动：

1. 校验 Tag 格式
2. 构建 `admin`
3. 构建 `merchant`
4. 构建 `web`
5. 跑 `server` 的 `go test ./...`
6. 通过 SSH + rsync 把 Tag 对应代码同步到生产服务器
7. 在生产服务器执行：

```bash
bash deploy/scripts/deploy_prod.sh --tag v1.12.3 --service all
```

### 4.3 手工发布生产

如果你不想通过 push tag 触发，也可以在 GitHub Actions 页面手工运行：

- workflow：`Release Production`
- 输入：
  - `tag`
  - `service_scope`：`api` / `web` / `all`

## 5. 如何回滚

### 5.1 回滚测试环境

在 GitHub Actions 页面运行：

- workflow：`Rollback Test`
- 输入：
  - `ref`：例如 `dev`、某个 commit SHA 或某个 tag
  - `service_scope`：`api` / `web` / `all`

它会在服务器执行：

```bash
bash deploy/scripts/rollback_test.sh --ref dev --service all
```

### 5.2 回滚生产环境

在 GitHub Actions 页面运行：

- workflow：`Rollback Production`
- 输入：
  - `tag`：要回滚到的稳定版本，例如 `v1.12.2`
  - `service_scope`：`api` / `web` / `all`

它会在服务器执行：

```bash
bash deploy/scripts/rollback_prod.sh --tag v1.12.2 --service all
```

## 6. 数据库回滚原则

必须记住：

- **代码回滚不等于数据库回滚**
- 当前 GitHub Actions 只回滚代码与容器，不会自动执行 down SQL

如果某个版本带了 migration，发布流程应该是：

1. 先备份数据库
2. 执行 migration
3. 再部署代码

如果要回滚：

1. 先判断是否只回滚代码即可
2. 只有在明确需要时，才人工执行数据库回滚

## 7. 当前工作流文件说明

### `release-prod.yml`

作用：

- `push tags: v*` 时自动发布生产
- 支持手工指定 Tag / 服务范围发布

特点：

- 先校验再部署
- 失败不会进入服务器部署阶段
- 生产部署走 `production` Environment

### `rollback-prod.yml`

作用：

- 只支持手工触发
- 指定稳定 Tag 回滚生产

### `deploy-test.yml`

作用：

- `push dev` 自动部署测试环境
- 支持手工指定 `ref` 做测试环境部署

### `rollback-test.yml`

作用：

- 只支持手工触发
- 支持按 `ref` 回滚测试环境

## 8. 推荐上线操作

每次日常联调按这个顺序：

1. 代码推到 `dev`
2. 等 `Deploy Test` 完成
3. 检查测试环境健康页、首页、`/admin/`
4. 验证业务路径

每次生产上线按这个顺序：

1. 代码合并完成
2. 本地或 CI 通过
3. 打生产 Tag
4. push Tag
5. 等 `Release Production` 完成
6. 检查健康页、首页、`/admin/`、`/merchant/`

## 9. 后续可选增强

如果后面你想进一步稳一点，可以再加两项：

1. **test 环境自动部署**
   - `push dev` 自动部署测试服务器
   - production 继续只走 Tag
2. **镜像仓库发布**
   - GitHub Actions 先构建镜像并推送
   - 服务器只拉取指定镜像 Tag
   - 回滚会更快、更稳定
