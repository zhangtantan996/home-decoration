# AGENTS.md — home-decoration

Repo-wide instructions for coding agents. Module-local `AGENTS.md` may add details but must not override these rules for safety, architecture, dependency versions, verification, or workflow.

## Interaction Contract (Socratic + Execution Gate)

- 默认先澄清再执行：当用户表达模糊，或语气是“你觉得呢/为什么/要不要”，先用少量关键问题澄清（目标与验收、复现路径/用户对象、约束边界），给 1-2 个方案和取舍，等待确认后再改代码/跑命令/提交。
- 默认不把用户结论当事实：独立思考并用代码/日志/运行结果验证；发现矛盾先提问引导校正，而不是直接附和。
- 只有用户明确授权（开始/请实现/直接改/PLEASE IMPLEMENT 等）才可直接执行；若用户明确“只回答不改代码/不跑命令/不提交”，必须严格遵守。
- 当任务可拆为边界清晰且互不冲突的子问题时，可启用子代理并行提效
- 代码审查、复审与审查后修复默认遵守 `docs/CODE_REVIEW_SOP.md`，按边界确认、P0/P1 优先、修复复验、3 轮止损执行。

## 12-Rule Execution Discipline

以下 12 条默认约束所有读取、实现、审查、修复、验证和汇报动作：

1. 先思考再编码：先明确目标、范围、非目标和验证方式；有歧义先指出，不要默默选一个解释开干。
2. 简洁优先：只写解决当前问题的最小必要代码，不添加未要求功能，不为一次性逻辑造抽象。
3. 手术式修改：只改与当前任务直接相关的代码，不顺手重构、不顺手清理无关区域。
4. 目标驱动执行：把任务翻译成可验证目标；修 bug 要有复现，改功能要有成功标准，重构要验证前后行为一致。
5. 模型只用于判断，不用于编造事实：代码现状、配置值、接口契约、测试结果、错误信息、线上状态必须基于代码、日志、命令输出、文档或用户提供信息。
6. token 预算不是跳过关键步骤的理由：不要为了省上下文或省时间跳过关键文档、边界确认和验证说明；追求最小充分上下文，不是最少上下文。
7. 暴露冲突，不要平均化处理：用户目标、仓库规则、业务口径、验证结果一旦冲突，要明确指出冲突点，不用模糊措辞弱化问题。
8. 先读再写：动手前先读相关代码、调用链、接口、脚本和 source-of-truth 文档；Direct Fix 至少读目标文件和直接调用点，Structured Change 至少读规则文档、目标模块和验证入口。
9. 测试验证的是需求意图，不只是表面行为：除 happy path 外，至少考虑关键边界、错误态、状态流转、权限影响和真实业务后果。
10. 每一步都设检查点：多步骤任务分阶段验证；某一步失败就先解释失败现象、原因判断和下一步，不继续盲改。
11. 即使不同意，也先匹配项目约定：组件、状态管理、分层、design tokens、验证命令优先遵守现有约定，不借任务顺手切技术路线。
12. 明确失败，禁止静默带过：清楚区分“已验证通过”“环境阻塞”“状态未知”“未执行”，不把未验证内容包装成已完成。

## Git Workflow Guardrail

- 本地开发默认只在 `dev` 或从 `dev` 派生的功能分支进行，禁止把 `main` 当作本地开发分支。
- 任何 `git push` 都需要用户明确确认；如获准推送，默认先推到 `origin/dev`，只有 `origin/dev` 验证通过后，才允许同步到 `origin/main`。
- 若当前会话为了只读检查临时切到 `main`，完成后必须切回 `dev`，不得继续在 `main` 上开发、提交或累积未发布改动。
- 未经用户明确确认，不得直接把本地改动推到 `origin/main`，也不得绕过 `origin/dev` 直接发版。

## Repo Map

| Dir | Stack | Purpose |
|-----|-------|---------|
| `server/` | Go 1.23, Gin, GORM, PostgreSQL 15, Redis 6.2 | Backend API + WebSocket |
| `admin/` | React 18.3.1, Vite 7, Ant Design 5, Zustand | Admin governance panel |
| `merchant/` | React 18.3.1, Vite 7, Ant Design 5, Zustand | Merchant fulfillment panel |
| `supervisor/` | React 18.3.1, Vite 7, Ant Design 5, Zustand | Supervisor project execution panel |
| `web/` | React 18.3.1, Vite 7, Zustand | Login-gated auxiliary H5 for payment-result and browsing |
| `mini/` | Taro 4.1, NutUI React Taro | WeChat mini program (primary transaction surface) |
| `mobile/` | React 19.2, RN 0.83, Expo | Native mobile app |
| `deploy/` | Docker, Nginx | Deployment configs and gateway |
| `tests/e2e/` | Playwright | E2E tests |

## Local Dev

### Infrastructure only (no app servers)
```bash
npm run infra
```
Starts PostgreSQL (5432) and Redis (6380 — not the default 6379) via `docker-compose.local.yml`.

### Full local dev (infra + API + admin + merchant)
```bash
npm run dev
```
All `npm run dev:*` scripts use `scripts/env/with-env.sh <env>` to load env before executing. The env name defaults to `local`.

### User-web dev (infra + API + web)
```bash
npm run dev:user-web
```

### User-web Docker stack (gateway path)
```bash
npm run dev:user-web:docker
```
Starts DB, Redis, API, website, user-web, merchant, admin, and the local gateway for `/app` and cross-surface smoke tests.

### Docker Compose local stack
`docker-compose.local.yml` starts all services including a Nginx gateway on **port 5175** that routes to admin, merchant, web, website, and API. Individual ports:

| Service | Port | Router basename |
|---------|------|-----------------|
| API | 8080 | — |
| Admin | 5173 | `/admin` |
| Merchant | 5174 | `/merchant` |
| Supervisor | 5178 | `/supervisor` |
| Website (landing) | 5177 (→5175) | — |
| User Web | 5176 | `/app` |

DB: PostgreSQL `home_decoration` on 5432, user `postgres`. Redis on 6380 (container internal 6379).

### Mobile
Requires ADB port forwarding:
```bash
adb reverse tcp:8081 tcp:8081
adb reverse tcp:8080 tcp:8080
```
Env-specific runs: `scripts/env/mobile-run.sh <env> android|ios`

## Commands

### Root shortcuts
```
npm run infra              # DB + Redis only
npm run dev                # infra + API + admin + merchant
npm run dev:supervisor     # supervisor dev container on :5178
npm run dev:user-web       # infra + API + user-web
npm run dev:user-web:docker # full local gateway stack for user-web real-path tests
npm run db:check           # local schema health check
npm run test:e2e           # default Playwright (merchant on :5174)
npm run test:identity:acceptance
npm run test:e2e:merchant:smoke
npm run test:e2e:quote:focused
npm run fixture:user-web
npm run smoke:user-web:api
npm run smoke:test
npm run smoke:release
npm run regression:nightly
npm run verify:user-web    # build + fixture + API smoke + user-web E2E
npm run verify:backend     # go vet + go test
npm run verify:admin       # lint + build
npm run verify:merchant    # lint + build
npm run verify:supervisor  # lint + build
npm run verify:web
npm run verify:mini
npm run verify:mobile
```

### Server (Go)
```
cd server && make dev      # air hot-reload on :8080
cd server && make build    # → bin/home-decoration-server
cd server && make test     # go test -v ./...
cd server && make fmt      # go fmt ./...
cd server && make lint     # golangci-lint run
cd server && make swagger  # swag init -g cmd/api/main.go -o docs
```

### Frontend apps
All frontends require `--legacy-peer-deps` for npm install.

**shared frontend guardrails:**
```
npm run gen:tokens
npm run check:frontend-style
npm run check:frontend-style:<scope>  # scope: admin|merchant|web|website|mini|mobile
node scripts/frontend-style-guard.mjs --scope <scope> --update-baseline
```
Visual values must come from `shared/design-tokens/tokens.json` and generated outputs. Do not edit generated token files directly.

**admin:**
```
cd admin && npm run dev
cd admin && npm run build
cd admin && npm run lint
```

**merchant:**
```
cd merchant && npm run dev -- --host
cd merchant && npm run build
cd merchant && npm run lint
```

**supervisor:**
```
cd supervisor && npm run dev
cd supervisor && npm run lint
cd supervisor && npm run build
```

**web:**
`dev` and `build` both run `generate:tokens` first (Vite Sass tokens from `web/scripts/generateTokens.mjs`).
```
cd web && npm run dev
cd web && npm run build
```
Note: no `lint` script defined in web.

**website:**
```
cd website && npm run dev
cd website && npm run check
cd website && npm run build
```

**mini:**
```
cd mini && npm run dev:weapp      # WeChat dev
cd mini && npm run dev:h5         # H5 dev on :5176
cd mini && npm run build:h5
cd mini && npm run build:weapp    # WeChat production build
cd mini && npm run lint           # eslint + no-emoji check
cd mini && npm run typecheck
cd mini && npm run format         # prettier
```
Uses `tsconfig.typecheck.json` for type checking. Has `@tarojs/plugin-platform-h5` as local file: plugin.

**mobile:**
```
cd mobile && npm run start        # Metro bundler
cd mobile && npm run android      # react-native run-android
cd mobile && npm run ios          # react-native run-ios
cd mobile && npm run lint
cd mobile && npm test
```
No web build — `npm run web` is explicitly not the default.

## Backend Structure

Entry: `server/cmd/api/main.go`. Strict layering under `server/internal/`:
```
router/ → handler/ → service/ → repository/
```
- **handlers**: request parsing, response formatting only
- **services**: business logic
- **repositories**: DB access only
- Use response helpers from `server/pkg/response`
- Wrap errors: `fmt.Errorf("...: %w", err)`
- No `panic` in request paths

## Hard Constraints

- `admin/`, `merchant/`: pinned to **react@18.3.1** and **react-dom@18.3.1** — do not upgrade.
- `mobile/`: uses **react@19.2.0** and **rn@0.83.0** — do not try to unify React versions across apps.
- UI framework: `admin/` and `merchant/` use **Ant Design 5.x** — do not introduce another UI framework.
- State management: **Zustand** everywhere — do not introduce Redux, MobX, or Recoil.
- Backend: `handler → service → repository` is strict. Do not skip layers.
- Frontend design tokens: do not add new hardcoded Hex/RGB/HSL colors, ad hoc spacing scales, ad hoc radii, or local shadow systems in business code. Add tokens in `shared/design-tokens/tokens.json`, run `npm run gen:tokens`, then consume generated variables/exports.
- Component usage: do not hand-roll business buttons, inputs, switches, checkboxes, dialogs, cards, or status primitives with raw platform controls. Use Ant Design in `admin/` and `merchant`, `mini/src/components` in `mini/`, generated CSS/token primitives in `web/` and `website/`, and `mobile/src/components/primitives` in `mobile/`.
- Mobile visual baseline: `mini/` and `mobile/` default to an iOS-like simple style across Android and iOS: white/soft-gray hierarchy, low-saturation state colors, light borders, restrained shadows, clear safe-area-aware bottom actions, and no Android Material-specific large color blocks or FAB-heavy patterns.
- UI state coverage: every user-visible frontend change must account for loading, empty, error, disabled, narrow-width, long-text, and multi-item states.
- Secrets: use env/config. Never hardcode JWT secrets, DB passwords, API keys, or tokens.
- User-facing UI copy must not expose implementation details. Do not show API URLs, SQL/schema/database errors, token/JWT, WebSocket, polling/auto-refresh internals, fallback/debug/mock/test-code text, npm/Docker/localhost instructions, stack traces, or raw backend error strings in `admin/`, `merchant/`, `web/`, `mini/`, or `mobile/`. Put technical detail in logs/audit records; show business-readable fallback text in the UI.
- Artifact directories are off-limits unless the task explicitly requires it: `**/node_modules/**`, `**/dist/**`, `output/`, `playwright-report/`, `test-results/`, `db_data_local/`, `server/tmp/`, `server/uploads/`.

## Testing

- E2E: Playwright, **single worker, Chromium only, fullyParallel=false**.
- Default `playwright.config.ts` points at **http://localhost:5174** (merchant). For other apps, use:
  - `playwright.identity.config.ts`
  - `playwright.user-web.config.ts`
  - `playwright.user-web.real.config.ts`
- Before running Playwright, verify the right app is actually serving on the target URL.
- Server: prefer targeted `go test ./internal/<pkg>/...` before `make test`.
- Schema-sensitive backend changes: run `npm run db:check` after migrations/schema edits.
- Frontend: prefer build + lint for quick validation; add/update tests when the module already has a test pattern.
- Frontend style guard: run the scoped `npm run check:frontend-style:*` command for touched frontend surfaces. The guard uses `scripts/frontend-style-baseline.json` to block new style debt while tolerating existing debt.
- Release/user-web regressions: `npm run smoke:release` covers API health, user-web fixture, identity API acceptance, and user-web API smoke; `npm run smoke:test` adds focused business API smokes; `npm run regression:nightly` runs backend/admin/merchant/web/mobile/mini verification plus the Playwright stack.
- Every test run must clean up its own data afterward. Do not leave test-created accounts, applications, orders, fixtures, or any other temporary records in the database; if you seed/import data for verification, run the matching cleanup before finishing.

## CI

All CI workflows trigger on the **`dev` branch** (not `main`). Paths are filtered per app:
- `server/**` → ci-backend
- `admin/**` → ci-admin
- `merchant/**` → ci-merchant
- `supervisor/**` → ci-supervisor
- `mini/**` → ci-mini
- `mobile/**` → ci-mobile
- `web/**` + `tests/**` → ci-user-web
- `website/**` → ci-website
- `shared/design-tokens/**`, `scripts/frontend-style-guard.mjs`, `scripts/frontend-style-baseline.json`, `stylelint.config.cjs` → relevant frontend CIs
- `deploy/**` → deployment workflows (`deploy-test` / `release-prod` / `rollback-*`)

CI uses `npm ci --legacy-peer-deps` for all frontends and `go test -v -race ./...` for backend.

## Business Context

Default operating strategy:
- **mini** = primary transaction surface
- **merchant** web = primary fulfillment surface
- **admin** web = primary governance surface
- **web/H5** = login-gated auxiliary browsing and payment-result surface, not the primary transaction surface

Hard business rules — do not change unless the user explicitly requests:
- Full transaction flow: 设计方案确认(成交点A) → 报价基线提交 → 施工主体选择 → 施工报价 → 用户确认施工报价(成交点B) → 项目创建
- Design confirmation and foreman confirmation are **two separate** transaction points
- Project creation is triggered **only after** user confirms construction quote (成交点B), not just foreman confirmation
- Quote baseline items use unit-based minimum steps: m/延米/㎡ → 0.5, 个/处/项/套/樘/扇/组 → 1, others → 0.01; 0 means "not applicable"
- Material shops remain a side capability, not part of the main transaction loop

For product/strategy questions, read in order:
1. `docs/产品需求文档(PRD).md`
2. `docs/BUSINESS_FLOW.md`
3. `docs/商业运营文档索引_2026-04.md`

## Verification

- Always report what you verified and what you did not.
- Start with the smallest meaningful validation for the changed files.
- If validation fails, report: symptom, repro path, likely cause, and next step.
- Do not pretend a task is done if validation has not passed.

## Safety

- Default allowed without confirmation: file reads, search, low-risk edits, doc updates, local build/test/lint, non-destructive git inspection.
- Ask first: destructive delete/revert/reset, dependency additions, destructive schema changes, `git push`, production-impacting actions, operations on real accounts or external services.
- Never run destructive commands without explicit confirmation.
- Never overwrite or revert user changes you did not make.
- `.env` and `.env.local` are gitignored. Never commit secrets.

## Environment

- All dev scripts route through `scripts/env/with-env.sh <env>` which loads the corresponding env file before running the command.
- Env files are generated from templates in `env/` (gitignored) plus `.env.example` and `.env.alipay.sandbox.example` at root.
- Docker Compose local defaults: `DATABASE_PASSWORD=local_dev_db_password_change_me`, `REDIS_PASSWORD=local_dev_redis_password_change_me`, `JWT_SECRET=local_dev_jwt_secret_change_me`.

## Key Docs

Read these when you need deeper context:
1. `docs/CLAUDE_DEV_GUIDE.md` — highest policy priority
2. `docs/TROUBLESHOOTING.md`
3. `docs/CODEX_WORKFLOW.md`
4. `docs/SECURITY.md`

Treat `GEMINI.md` as potentially stale. If docs conflict with checked-in config or scripts, follow the executable source of truth.
If you need an expanded explanation of the 12 execution rules, `docs/AGENT_EXECUTION_RULES.md` is a non-authoritative explainer only.
