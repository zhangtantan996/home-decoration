# 多身份 Phase 1 上线与回滚 SOP（Web 一期）

> 适用范围：
> - “一个 App 多身份 + 商家 Web 分子类型工作台”一期上线
> - 重点覆盖身份审核 API、RBAC 菜单权限点、worker→provider.foreman 兼容迁移

## 1. 变更清单（本次上线）

- 身份模型统一：`owner | provider | admin`
- provider 子类型统一：`designer | company | foreman`
- 身份审核 API：
  - `GET /admin/identity-applications`
  - `GET /admin/identity-applications/:id`
  - `POST /admin/identity-applications/:id/approve`
  - `POST /admin/identity-applications/:id/reject`
- RBAC 权限点：`identity:application:audit`
- RBAC 菜单：`/providers/identity-applications`（身份申请审核）
- 迁移脚本：
  - 数据迁移（历史阶段记录）：`/Volumes/tantan/AI_project/home-decoration/server/scripts/history/004_migrate_worker_to_provider_foreman.sql`
  - RBAC 菜单迁移：`/Volumes/tantan/AI_project/home-decoration/server/migrations/v1.4.2_add_identity_application_audit_menu.sql`

## 2. 上线前检查（必做）

- 确认数据库已备份（全库备份 + 关键表抽样备份）：
  - `user_identities`
  - `providers`
  - `identity_applications`
  - `sys_menus`
  - `sys_role_menus`
- 确认本次服务端版本已包含：
  - `server/internal/router/router.go` 中身份审核路由权限守卫 `identity:application:audit`
  - `server/migrations/v1.4.2_add_identity_application_audit_menu.sql`
- 确认管理员账号具备 `role_id=1`（超级管理员）或 `role_id=8`（管理员）之一。
- 准备联调令牌（测试用户 token、管理员 token）。

## 3. 正向上线步骤（推荐顺序）

### Step 1：执行数据迁移（worker -> provider.foreman）

```bash
cd /Volumes/tantan/AI_project/home-decoration
psql -U postgres -d home_decoration \
  -f server/scripts/history/004_migrate_worker_to_provider_foreman.sql  （历史脚本记录；当前正式目录以 `server/migrations/` 为准）
```

### Step 2：执行 RBAC 菜单与权限迁移

```bash
cd /Volumes/tantan/AI_project/home-decoration
psql -U postgres -d home_decoration \
  -f server/migrations/v1.4.2_add_identity_application_audit_menu.sql
```

### Step 3：发布后端服务

按现有发布流程部署包含上述代码的后端版本。

### Step 4：执行上线后 Smoke

按文档执行：
- `/Volumes/tantan/AI_project/home-decoration/docs/IDENTITY_PHASE1_API_SMOKE.md`

重点断言：
- `login/refresh/switch` 返回中包含 `activeRole`
- `activeRole=provider` 时返回 `providerSubType + providerId`
- 身份审核 API 未授权账号返回 403
- 拥有 `identity:application:audit` 权限账号可正常审核

### Step 5：执行 RBAC 可见性检查

使用 `role_id=8` 管理员登录 Admin：
- 可看到“身份申请审核”菜单：`/providers/identity-applications`
- 可正常进入并审批/拒绝申请

## 4. 紧急回滚策略

> 原则：先恢复服务可用性，再决定是否回滚数据。

### 场景 A：仅权限/菜单异常（不涉及身份数据）

1. 回滚应用版本到上一个稳定版本。
2. 执行 RBAC 回滚脚本（仅回滚菜单与授权）：

```bash
cd /Volumes/tantan/AI_project/home-decoration
psql -U postgres -d home_decoration \
  -f server/scripts/history/005_add_identity_application_audit_menu_rollback.sql  （历史回滚脚本记录）
```

### 场景 B：身份数据迁移引发严重业务问题

1. 先回滚应用版本到上一个稳定版本。
2. 再执行身份迁移回滚脚本（谨慎）：

```bash
cd /Volumes/tantan/AI_project/home-decoration
psql -U postgres -d home_decoration \
  -f server/scripts/history/004_migrate_worker_to_provider_foreman_rollback.sql  （历史回滚脚本记录）
```

3. 回滚后做人工校验：
- `user_identities` 的 `identity_type` 是否恢复为预期
- 历史 worker 账号是否可登录
- 不存在大面积权限缺失

## 5. 发布后 24 小时观测项

- 身份切换失败率（尤其是切换后权限错乱）
- refresh 后身份回退比例
- 身份审核接口成功率（approve/reject）
- 审核积压量（pending 数）
- 403/401 异常趋势（确认无误封）

## 6. 常见执行顺序错误（避免）

- 仅发前端/后端，不执行 DB 迁移。
- 先发 UI 再发后端权限守卫，导致按钮可见但接口 403。
- 回滚时直接执行数据回滚，未先确认问题是否仅为菜单权限配置。

## 7. 快速命令汇总

```bash
# 正向（数据迁移 + RBAC）
psql -U postgres -d home_decoration -f /Volumes/tantan/AI_project/home-decoration/server/scripts/history/004_migrate_worker_to_provider_foreman.sql  # 历史执行记录，当前正式目录以 server/migrations/ 为准
psql -U postgres -d home_decoration -f /Volumes/tantan/AI_project/home-decoration/server/migrations/v1.4.2_add_identity_application_audit_menu.sql

# 回滚（仅 RBAC）
psql -U postgres -d home_decoration -f /Volumes/tantan/AI_project/home-decoration/server/scripts/history/005_add_identity_application_audit_menu_rollback.sql  # 历史回滚记录

# 回滚（身份迁移，谨慎）
psql -U postgres -d home_decoration -f /Volumes/tantan/AI_project/home-decoration/server/scripts/history/004_migrate_worker_to_provider_foreman_rollback.sql  # 历史回滚记录
```
