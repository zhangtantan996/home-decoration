# GitHub Actions 发布与回滚配置

这套配置的目标只有三件事：

1. **版本可追踪**：生产只部署 Git Tag
2. **发布可自动化**：推送 Tag 后自动校验并部署
3. **回退可执行**：在 GitHub 上手工选择旧 Tag 回滚

当前仓库已经有发布脚本与回滚脚本：

- `deploy/scripts/deploy_prod.sh`
- `deploy/scripts/rollback_prod.sh`

本次新增的 GitHub Actions 只是把这两套脚本接到 GitHub 上：

- `.github/workflows/release-prod.yml`
- `.github/workflows/rollback-prod.yml`

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

### 2.2 Secrets

在仓库或 `production` Environment 中配置：

- `PROD_HOST`：生产服务器 IP 或域名
- `PROD_PORT`：SSH 端口，可为空，默认 `22`
- `PROD_USER`：SSH 登录用户
- `PROD_SSH_KEY`：用于部署的私钥
- `PROD_APP_DIR`：服务器上的仓库目录，例如 `/opt/home-decoration`
- `PROD_KNOWN_HOSTS`：可选，推荐填入 `ssh-keyscan -H <host>` 的结果；不填则 workflow 会在运行时自动 `ssh-keyscan`

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

服务器上的仓库工作区必须保持干净。

因为当前发布脚本会执行：

```bash
git status --porcelain
```

如果服务器上有手改代码、手工生成文件或未清理产物，发布会被阻止。

## 4. 自动发布怎么触发

### 4.1 正常发布

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
6. SSH 到生产服务器执行：

```bash
bash deploy/scripts/deploy_prod.sh --tag v1.12.3 --service all
```

### 4.2 手工发布

如果你不想通过 push tag 触发，也可以在 GitHub Actions 页面手工运行：

- workflow：`Release Production`
- 输入：
  - `tag`
  - `service_scope`：`api` / `web` / `all`

## 5. 如何回滚

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

## 8. 推荐上线操作

每次上线按这个顺序：

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
