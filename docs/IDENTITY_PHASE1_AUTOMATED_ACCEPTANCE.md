# 多身份 Phase 1 自动化验收（API + 管理端）

> 目标：把 `docs/IDENTITY_PHASE1_API_SMOKE.md` 的手工联调升级为可重复执行的一键自动化验收。

## 1. 覆盖范围

- API 验收（阻断级）
  - 身份申请约束（含禁止 `worker` 子类型申请）
  - 管理端审核接口权限
  - 审核状态流转（approve/reject）
  - 身份切换 + refresh 身份保持
- Admin UI 验收（默认告警级，可切严格阻断）
  - 管理员登录
  - 身份申请审核页列表/详情
  - 通过与驳回操作
  - 状态筛选结果

## 2. 新增命令

在仓库根目录执行：

```bash
# 全流程：API + UI + 汇总 + （可选）DB清理
npm run test:identity:acceptance

# 仅API阻断验收
npm run test:identity:acceptance:api

# 仅Admin UI验收
npm run test:identity:acceptance:ui

# 仅重生成摘要报告（读取上次执行JSON）
npm run test:identity:acceptance:report
```

## 3. 环境变量

- `E2E_API_BASE_URL`（默认 `http://localhost:8080/api/v1`）
- `E2E_ADMIN_ORIGIN`（默认 `http://localhost:5173`）

> 建议：管理端 UI 验收优先使用 `localhost`（不要改为 `127.0.0.1`），避免触发本地 CORS 白名单不一致。
- `E2E_ADMIN_USER`（默认 `admin`）
- `E2E_ADMIN_PASS`（默认 `admin123`）
- `E2E_PHONE_PREFIX`（默认 `19999`）
- `E2E_RUN_ID`（默认自动生成）
- `E2E_UI_STRICT`（`0/1`，默认 `0`）
- `E2E_DB_CLEANUP`（`0/1`，默认 `0`）
- `E2E_DB_URL`（当 `E2E_DB_CLEANUP=1` 时必填）

## 4. 门禁规则

- API 项目失败：**阻断（退出码非0）**
- UI 项目失败：
  - 默认：仅告警，不阻断
  - 若 `E2E_UI_STRICT=1`：阻断

## 5. 数据生命周期

- 默认使用唯一 `runId` 生成独立测试手机号，避免脏数据冲突。
- 清理策略为“混合模式”：
  - 软清理（默认）：不删库，仅通过 `runId` 隔离。
  - 硬清理（可选）：执行脚本
    - `server/scripts/testdata/identity_acceptance_cleanup.sql`

示例：

```bash
E2E_DB_CLEANUP=1 \
E2E_DB_URL='postgres://postgres:密码@localhost:5432/home_decoration?sslmode=disable' \
npm run test:identity:acceptance
```

## 6. 输出产物

- 机器可读摘要：
  - `test-results/identity-acceptance-summary.json`
- 人类可读摘要：
  - `test-results/identity-acceptance-summary.md`
- Playwright 原生 trace/screenshot：
  - `test-results/identity-playwright/`

## 7. 前置条件（本地）

- API 服务可访问：`http://localhost:8080`
- Admin 前端可访问：`http://localhost:5173`
- 管理员账号可登录（默认 `admin/admin123`）

## 8. 已知限制

- 仅覆盖 Web 一期范围（API + 管理端 UI），不含移动端/小程序 UI 自动化。
- 若本地无 `psql`，即使开启 `E2E_DB_CLEANUP=1` 也会回退软清理并给出告警。
