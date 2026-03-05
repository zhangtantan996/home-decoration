# Git 工作流规范

本文档规定了项目的 Git 分支管理、提交规范及 Pull Request (PR) 流程，旨在确保代码库的整洁、可追溯性以及发布的安全稳定。

---

## 1. 分支管理策略

项目采用 **双主分支 (Dual-Branch)** 模式，辅以功能分支和修复分支。

### 1.1 核心分支

| 分支名 | 用途 | 保护状态 | 合并限制 |
| :--- | :--- | :--- | :--- |
| `main` | **生产分支**。存放随时可部署到生产环境的稳定代码。 | 🔒 受保护 | 仅接受来自 `dev` 或 `hotfix/` 分支的 PR |
| `dev` | **开发分支**。存放日常开发集成代码，对应测试环境。 | 🔓 活跃 | 接受 `feat/`、`fix/` 等功能分支的合并 |

### 1.2 辅助分支

| 分支前缀 | 起源分支 | 合并回 | 用途 |
| :--- | :--- | :--- | :--- |
| `feat/` | `dev` | `dev` | 新功能开发。示例：`feat/user-auth` |
| `fix/` | `dev` | `dev` | 日常 Bug 修复。示例：`fix/sidebar-overlap` |
| `hotfix/` | `main` | `main` & `dev` | 紧急线上 Bug 修复。示例：`hotfix/payment-crash` |
| `docs/` | `dev` | `dev` | 仅文档更新。示例：`docs/api-update` |

---

## 2. Commit 提交规范

项目遵循 [Conventional Commits](https://www.conventionalcommits.org/) 规范，确保提交历史清晰、可自动化处理。

### 2.1 提交格式

```text
<type>(<scope>): <subject>

<body> (可选)

<footer> (可选)
```

### 2.2 常用类型 (Type)

- `feat`: 引入新功能
- `fix`: 修复 Bug
- `docs`: 仅修改文档
- `style`: 不影响代码含义的格式调整（空格、分号等）
- `refactor`: 代码重构（既不修复 Bug 也不添加功能）
- `perf`: 提高性能的代码更改
- `test`: 添加或修正测试
- `chore`: 构建过程或辅助工具的变动（如更新依赖）
- `merge`: 分支合并

### 2.3 示例

**✅ 优秀示例：**
- `feat(auth): 增加微信一键登录功能`
- `fix(server): 修复上传大文件时的内存泄漏问题`
- `docs: 更新 Git 工作流文档中的 Tag 说明`

**❌ 错误示例：**
- `update` (太模糊)
- `fixed some bugs` (未说明具体内容)
- `add new feature` (缺少 scope 和具体描述)

---

## 3. Pull Request (PR) 流程

所有代码变更必须通过 PR 进入 `dev` 或 `main` 分支。

### 3.1 PR 创建清单

在提交 PR 前，开发者需确保：
1. [ ] 代码已在本地编译通过。
2. [ ] 已运行相关单元测试（如有）。
3. [ ] 代码风格符合项目规范（运行 `npm run lint` 或 `make fmt`）。
4. [ ] PR 描述清晰，关联了相关的 Issue 或任务 ID。

### 3.2 合并规则

1. **Feature -> dev**:
   - 至少需要 1 名核心开发者的 Review 通过。
   - 所有 CI 检查（如 Lint、Build）必须通过。
2. **dev -> main (发布)**:
   - 必须经过测试环境验证通过。
   - 需由项目负责人审核并执行合并。

---

## 4. 版本发布与打标 (Tag)

生产环境的发布必须基于 `main` 分支的 Git Tag。

### 4.1 命名规范
采用语义化版本号：`v主版本.次版本.修订号` (例如 `v1.2.0`)。

### 4.2 操作流程

```bash
# 1. 切换并拉取最新 main
git checkout main
git pull origin main

# 2. 合并 dev 到 main
git merge dev

# 3. 创建标签
git tag -a v1.2.0 -m "Release v1.2.0: 添加用户反馈系统"

# 4. 推送到远程
git push origin main --tags
```

---

## 5. 紧急修复 (Hotfix) 流程

当线上出现紧急 Bug 时，遵循以下路径：

1. 从 `main` 创建 `hotfix/xxx` 分支。
2. 在 `hotfix/xxx` 分支修复并验证。
3. 发起 PR 合并到 `main` 并打上新的修订号 Tag（如 `v1.2.1`）。
4. **重要**：将 `main` 的变更合并回 `dev` 分支，确保代码同步。

```bash
git checkout dev
git merge main
git push origin dev
```

---

## 6. 常用 Git 命令速查

| 命令 | 用途 |
| :--- | :--- |
| `git pull origin dev` | 开始工作前同步远程代码 |
| `git checkout -b feat/my-task` | 创建新功能分支 |
| `git commit -m "feat: description"` | 规范提交代码 |
| `git log --oneline -n 10` | 查看最近 10 条提交简报 |
| `git diff main..dev` | 查看开发分支领先生产分支的内容 |

---

**最后更新: 2026-01-25**
