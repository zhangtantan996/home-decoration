# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Multi-platform home decoration (家装) marketplace connecting homeowners, designers, contractors, foremen, and workers. Monorepo with Go backend and multiple frontend apps.

| Dir | Stack | Purpose |
|-----|-------|---------|
| `server/` | Go 1.23, Gin, GORM, PostgreSQL 15, Redis 6.2 | Backend API + WebSocket |
| `admin/` | React 18.3.1, Vite 7, Ant Design 5, Zustand | Admin governance panel |
| `merchant/` | React 18.3.1, Vite 7, Ant Design 5, Zustand | Merchant fulfillment panel |
| `web/` | React 18.3.1, Vite 7, Zustand | User-facing H5 app |
| `mini/` | Taro 4.1, NutUI React Taro | WeChat mini program (primary transaction surface) |
| `mobile/` | React 19.2, RN 0.83, Expo | Native mobile app |
| `website/` | Vite | Landing/marketing site |
| `deploy/` | Docker, Nginx | Deployment configs and gateway |
| `tests/e2e/` | Playwright | E2E tests |

## Common Commands

### Infrastructure
```bash
npm run infra                         # PostgreSQL + Redis via Docker
npm run dev                           # infra + API + admin + merchant (full stack)
npm run dev:user-web                  # infra + API + user-web
```

### Server (Go)
```bash
cd server && make dev                 # air hot-reload on :8080
cd server && make test                # go test -v ./...
cd server && make build               # → bin/home-decoration-server
cd server && make lint                # golangci-lint run
cd server && make fmt                 # go fmt ./...
# Targeted test: cd server && go test ./internal/<pkg>/...
```

### Frontend (all require `--legacy-peer-deps` for npm install)
```bash
# admin
cd admin && npm run dev               # localhost:5173
cd admin && npm run build && npm run lint

# merchant
cd merchant && npm run dev -- --host   # localhost:5174

# web (user H5)
cd web && npm run dev                  # localhost:5176

# mini (WeChat)
cd mini && npm run dev:weapp           # WeChat dev
cd mini && npm run dev:h5              # H5 dev on :5176
cd mini && npm run lint                # eslint + no-emoji check

# mobile
cd mobile && npm run start             # Metro bundler
cd mobile && npm run android           # react-native run-android
cd mobile && npm run ios               # react-native run-ios
```

### Design Tokens
```bash
npm run gen:tokens                     # regenerate from shared/design-tokens/tokens.json
npm run check:frontend-style           # style guard (all scopes)
npm run check:frontend-style -- --scope admin|merchant|web|website|mini|mobile
```

### Testing
```bash
npm run test:e2e                       # default Playwright (merchant on :5174)
npm run test:e2e:user-web              # user-web E2E
npm run test:e2e:merchant:smoke        # merchant smoke tests
npm run test:identity:acceptance       # identity acceptance tests
npm run verify:backend                 # go vet + go test
npm run verify:admin                   # lint + build
npm run verify:merchant                # lint + build
npm run smoke:test                     # full smoke test
```

### Database
```bash
npm run db:check                       # run dbcheck tool
npm run db:cleanup:testdata:local      # clean tagged test data
```

### Environment
```bash
npm run env:print:local                # print resolved env for local
# All dev:* scripts use scripts/env/with-env.sh <env> to load env files
```

## Architecture

### Backend Layering (strict)
```
router/ → handler/ → service/ → repository/
```
- **handlers**: request parsing, response formatting only (no business logic)
- **services**: business logic
- **repositories**: DB access only
- Entry: `server/cmd/api/main.go`
- Use response helpers from `server/pkg/response`
- Wrap errors: `fmt.Errorf("...: %w", err)`, no `panic` in request paths

### Local Dev Ports
| Service | Port | Router basename |
|---------|------|-----------------|
| API | 8080 | — |
| Admin | 5173 | `/admin` |
| Merchant | 5174 | `/merchant` |
| User Web | 5176 | `/app` |
| Website | 5177 (→5175) | — |
| Nginx gateway | 5175 | routes all |
| PostgreSQL | 5432 | — |
| Redis | 6380 (not 6379) | — |

### CI
All CI triggers on the **`dev`** branch (not `main`). Path-filtered per app:
- `server/**` → ci-backend
- `admin/**` → ci-admin
- `merchant/**` → ci-merchant
- `mini/**` → ci-mini
- `mobile/**` → ci-mobile
- `web/**` + `tests/**` → ci-user-web

## Hard Constraints

- `admin/`, `merchant/`: pinned to **react@18.3.1** — do not upgrade.
- `mobile/`: uses **react@19.2.0** and **rn@0.83.0** — do not unify React versions across apps.
- UI framework: `admin/` and `merchant/` use **Ant Design 5.x** only.
- State management: **Zustand** everywhere — no Redux, MobX, or Recoil.
- Backend: `handler → service → repository` is strict. Do not skip layers.
- Design tokens: no hardcoded Hex/RGB/HSL colors, spacing, radii, or shadows in business code. Add tokens in `shared/design-tokens/tokens.json`, run `npm run gen:tokens`, then consume generated variables/exports.
- Components: do not hand-roll buttons, inputs, switches, checkboxes, dialogs, cards, or status primitives with raw controls. Use Ant Design in `admin/`/`merchant/`, `mini/src/components` in `mini/`, generated CSS/token primitives in `web/`/`website/`, and `mobile/src/components/primitives` in `mobile/`.
- Mobile visual baseline: iOS-like simple style across Android and iOS — white/soft-gray, low-saturation state colors, light borders, restrained shadows.
- UI state coverage: every user-visible change must account for loading, empty, error, disabled, narrow-width, long-text, and multi-item states.
- Never hardcode secrets (JWT, DB passwords, API keys). Use env/config.
- User-facing UI copy must never expose API URLs, SQL errors, JWT tokens, WebSocket internals, stack traces, or raw backend error strings.
- Artifact directories are off-limits: `**/node_modules/**`, `**/dist/**`, `output/`, `playwright-report/`, `test-results/`, `db_data_local/`, `server/tmp/`, `server/uploads/`.

## Business Context

- **mini** = primary transaction surface
- **merchant** web = primary fulfillment surface
- **admin** web = primary governance surface
- **web/H5** = landing, payment-result, and auxiliary browsing

Core transaction flow: 设计方案确认(成交点A) → 报价基线提交 → 施工主体选择 → 施工报价 → 用户确认施工报价(成交点B) → 项目创建

Design confirmation and foreman confirmation are **two separate** transaction points. Project creation triggers **only after** user confirms construction quote (成交点B).

## Design Principles

Design decisions are governed by `DESIGN.md`. Key points:
- Default气质: 专业、温暖、克制、有秩序、不炫技
- Different page types (marketing, transaction, merchant workbench, admin governance) have distinct visual rules
- Brand assets from `docs/branding/` and `shared/design-tokens/`
- Priority: 业务正确性 > 可读性 > 多端一致性 > 品牌资产 > 风格参考

## Key Docs

Read when needed:
1. `AGENTS.md` — full engineering rules (superset of this file)
2. `DESIGN.md` — page-level design decisions
3. `docs/产品需求文档(PRD).md` — product requirements
4. `docs/BUSINESS_FLOW.md` — business flow details
5. `docs/TROUBLESHOOTING.md` — common issues
6. `docs/SECURITY.md` — security guidelines

If docs conflict with checked-in config or scripts, follow the executable source of truth.

## Safety

- Default allowed: file reads, search, low-risk edits, doc updates, local build/test/lint, non-destructive git inspection.
- Ask first: destructive delete/revert/reset, dependency additions, destructive schema changes, `git push`, production-impacting actions.
- `.env` and `.env.local` are gitignored. Never commit secrets.
