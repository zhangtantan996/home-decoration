# Codex Repo Rules (home-decoration)

This file is the repo-wide instruction set for Codex and other coding agents.

## Scope And Precedence
- Apply this file to the whole repository.
- The nearest `AGENTS.md` may add module-local details, but it must not override repo-wide rules for safety, architecture, dependency versions, verification, or workflow.
- The `admin/`, `server/`, `mobile/`, and `mini/` subdirectory `AGENTS.md` files currently contain legacy workspace/persona guidance. For engineering work in this repo, treat them as supplemental context only.
- If a prose doc conflicts with a checked-in manifest, lockfile, or config that is required to build or test the current code, follow the executable source of truth and call out the mismatch in your summary.

## Repo Map
- `server/`: Go backend (Gin + GORM), REST + WebSocket
- `admin/`: admin panel (React 18 + Vite + Ant Design)
- `merchant/`: merchant panel (React 18 + Vite + Ant Design)
- `web/`: user-facing web app
- `mobile/`: React Native app (React 19 / RN 0.83)
- `mini/`: WeChat mini program (Taro)
- `deploy/`: Docker and Nginx deployment
- `tests/e2e/`: Playwright end-to-end tests

## Read Order
1. `docs/CLAUDE_DEV_GUIDE.md`
2. `docs/TROUBLESHOOTING.md`
3. `docs/CODEX_WORKFLOW.md`
4. `docs/SECURITY.md`

Rules from `docs/CLAUDE_DEV_GUIDE.md` have the highest policy priority. Treat `GEMINI.md` as potentially stale.

## Business / Product / Ops Baseline
- For business judgment, product prioritization, growth planning, operations design, merchant governance, analytics, or roadmap questions, use this doc chain by default:
  1. `docs/产品需求文档(PRD).md`
  2. `docs/BUSINESS_FLOW.md`
  3. `docs/商业运营文档索引_2026-04.md`
  4. `docs/平台阶段判断与主商业模型_2026-04.md`
  5. `docs/小程序优先增长与成交操作系统_2026-04.md`
  6. `docs/供给运营与商家分层治理体系_2026-04.md`
  7. `docs/经营指标与运营驾驶舱定义_2026-04.md`
- Do not treat older MVP, Web-first, or merchant-analysis docs as the primary strategy baseline when they conflict with the documents above.
- Default operating strategy:
  - `mini` = primary transaction surface
  - `merchant` web = primary fulfillment surface
  - `admin` web = primary governance surface
  - `web/H5` = landing, payment-result, and auxiliary browsing surfaces
- Do not violate these current business baselines unless the user explicitly decides to change strategy:
  - design confirmation and foreman confirmation remain two separate transaction points
  - project creation is triggered only after foreman confirmation
  - material shops remain a side capability and are not part of the current main transaction loop

## Demand Decision Gate
- Before recommending, planning, or implementing a new requirement, first evaluate and state:
  1. whether it is a hard requirement for the current stage
  2. whether it materially improves platform growth, transaction, fulfillment, or governance
  3. whether there is a shorter, cleaner, or more stage-appropriate implementation path
- If a requirement does not serve the current main business loop, do not default to implementation. First challenge the scope based on the business baseline above.
- Avoid feature-count thinking. Prioritize requirements that deepen one of these loops:
  - acquisition and booking
  - design transaction
  - construction bridge
  - fulfillment quality
  - after-sales governance
- When suggesting priorities, default to this framing:
  1. stage judgment
  2. whether it serves the main business model
  3. whether it improves growth, supply, or governance
  4. implementation path and verification

## Execution Model
- Think from first principles. Start from the real goal, constraints, and acceptance target instead of assuming the user already knows the exact implementation path.
- If ambiguity affects correctness, stop and clarify before implementing or recommending a structural change.
- Prefer the smallest correct change. Do short context gathering first and stop reading once the target files, commands, and constraints are clear.
- Do not refactor unrelated code or add dependencies without explicit approval.
- Use these task modes:
  - `Read / Investigate`: read-only analysis, no edits
  - `Direct Fix`: small or medium scoped change with direct verification
  - `Structured Change`: multi-file, routing, schema, deploy, cross-surface, or architectural work; plan before editing
- Unless the user explicitly says `直接上` / `不用计划` / `先做再说`, use this flow:
  1. classify task size and risk
  2. restate goal, in-scope, and out-of-scope
  3. give a brief plan
  4. implement
  5. verify
  6. summarize changed files, verification, risks, and next step
- When proposing a solution, optimize for the shortest correct path that satisfies the real requirement.
- Do not default to compatibility patches, speculative fallbacks, downgrade branches, or “just-in-case” complexity unless they are required for correctness.

## Subagent And Skill Rules
- Use subagents to parallelize bounded work. Do not hand off the whole task as a vague research request.
- The main agent keeps ownership of scope, final decisions, integration, verification, and the user-facing summary.
- Autonomous selection is allowed by default. Choose the minimum useful set without waiting for explicit authorization.
- Stay local when the work is tightly coupled or when delegation would not materially help.
- Prefer read-only `explorer` subagents first. Use writable `worker` subagents only after scope, owned files, and validation targets are clear.
- Give every subagent an explicit goal, scope, owned paths, expected output, and `Done when`.
- Never assign the same file, route config, or shared schema/migration to multiple workers in parallel.
- Repo-oriented split:
  - `server/`: split by business slice and keep `router -> handler -> service -> repository` in one ownership chain when possible
  - `admin/`, `merchant/`, and `web/`: split by app surface, not by shared UI concern across apps
  - `mobile/` and `mini/`: treat as separate delivery surfaces; do not mix them into the `web/` write set
  - `deploy/`: keep Nginx, Docker, and Compose changes under one owner
  - `tests/e2e/`: usually best as a separate verifier after app behavior is settled
- Frontend routing:
  - `ui-orchestrator`: first stop when page direction is unclear or the user needs guided UI questioning before coding
  - `frontend-design` or `frontend-skill`: brand, landing, marketing, download, and other visually led pages
  - `ui-ux-pro-max`: admin, merchant, dashboard, form, table, detail, approval, and other state-heavy product pages
  - `build-web-apps:shadcn`: use only when the target app already follows shadcn patterns; do not route Ant Design apps here by default

## Hard Constraints
- `admin/` and `merchant/` must stay on `react@18.3.1` and `react-dom@18.3.1` exactly.
- `mobile/` uses React `19.2.0` and React Native `0.83.0`. Do not try to unify React versions across apps.
- Admin and merchant UI stay on Ant Design 5.x. Do not introduce another UI framework.
- Frontend global state uses Zustand. Do not introduce Redux, MobX, or Recoil unless requested.
- Backend layering is strict: `handler -> service -> repository`.
- Use env/config for secrets. Never hardcode JWT secrets, DB passwords, API keys, or tokens.
- Do not touch generated or runtime artifact directories unless the task explicitly requires it: `**/node_modules/**`, `**/dist/**`, `output/`, `playwright-report/`, `test-results/`, `db_data_local/`.

## Module Conventions
### Go backend (`server/`)
- Keep request parsing and response formatting in handlers.
- Keep business logic in services.
- Keep DB access in repositories.
- Use existing response helpers from `server/pkg/response`.
- Prefer wrapped errors with context: `fmt.Errorf("...: %w", err)`.
- Avoid `panic` in request paths.

### TypeScript frontends (`admin/`, `merchant/`, `mobile/`, `mini/`, `web/`)
- Inspect and follow the target app's existing `tsconfig`, lint rules, API layer, store pattern, and file naming conventions before introducing new structure.
- Prefer strict typing and `import type` for type-only imports.
- Avoid `any`, `@ts-ignore`, and `@ts-expect-error` for new code unless there is a documented legacy reason.
- Reuse the existing API wrappers and store patterns in each app.
- Avoid logging secrets, tokens, passwords, and phone numbers.

## Commands
### Root
- Infra only: `npm run infra`
- Main local dev: `npm run dev`
- User web dev: `npm run dev:user-web`
- Web build: `npm run build:web`
- Default E2E: `npm run test:e2e`
- Identity acceptance: `npm run test:identity:acceptance`
- User web verification bundle: `npm run verify:user-web`

### server/
- Dev: `cd server && make dev`
- Build: `cd server && make build`
- Test all: `cd server && make test`
- Format: `cd server && make fmt`
- Lint: `cd server && make lint`

### admin/
- Dev: `cd admin && npm run dev`
- Build: `cd admin && npm run build`
- Lint: `cd admin && npm run lint`

### merchant/
- Dev: `cd merchant && npm run dev -- --host`
- Build: `cd merchant && npm run build`

### mobile/
- Start: `cd mobile && npm run start`
- Android: `cd mobile && npm run android`
- iOS: `cd mobile && npm run ios`
- Lint: `cd mobile && npm run lint`
- Test: `cd mobile && npm test`
- Note: `cd mobile && npm run web` is currently not the default root web workflow.

### mini/
- Dev (WeChat): `cd mini && npm run dev:weapp`
- Build: `cd mini && npm run build:weapp`
- Lint: `cd mini && npm run lint`
- Format: `cd mini && npm run format`

## Verification Rules
- Always report what you verified and what you did not verify.
- Start with the smallest meaningful validation for the files and behavior you changed.
- If the task changes behavior, add or update tests when the surrounding module already has an obvious testing pattern.
- For `server/` changes, prefer targeted `go test` before broad test runs.
- For `admin/`, `merchant/`, and `web/` changes, prefer relevant build, lint, type, or targeted browser checks.
- For `mobile/` and `mini/` changes, use the smallest relevant lint, test, or build command available.
- Before running Playwright, verify which app should actually be serving the target URL. Do not assume the default `playwright.config.ts` base URL is correct for the current task.
- If validation fails, report the failure symptom, repro path, likely cause, and next step instead of pretending the task is done.
- If the prompt does not define `Done when`, infer a minimal acceptance target, state the assumption, and verify against it.

## MCP, Skills, And Automation
- Use MCP only when the needed truth is outside the repo or changes too often to keep in docs.
- The current repo-level MCP config only includes `playwright` and `memory` via `.mcp.json`.
- Prefer skills for repeated, stable workflows. Do not create a new skill for a one-off task.
- Do not automate a workflow that still needs frequent manual correction.

## Safety And Approval Boundary
- Default no-confirmation actions: file reads, search, low-risk code edits, doc updates, local build/test/lint, and non-destructive local Git inspection.
- Ask first for destructive delete/revert/reset operations, dependency additions, destructive schema changes, `git push`, production-impacting actions, or operations touching real accounts, external services, or real user data.
- Never run destructive commands without explicit confirmation.
- Never overwrite or revert user changes you did not make.
- If unexpected unrelated changes appear while you are working, stop and ask how to proceed.
