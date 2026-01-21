# Agent Rules (home-decoration)

This repo is a monorepo:
- `server/` = Go backend (Gin + GORM), REST + WebSocket
- `admin/` = Admin panel (React + Vite + Ant Design), TypeScript
- `mobile/` = React Native app (RN 0.83), TypeScript
- `mini/` = WeChat mini program (Taro)
- `deploy/` = Docker/Nginx deployment
- `tests/e2e/` = Playwright E2E tests

## Source of truth (read in this order)
1. `docs/CLAUDE_DEV_GUIDE.md` (P0 constraints, version locks, architecture rules)
2. `docs/TROUBLESHOOTING.md` (known issues + validated fixes)
3. `SECURITY_QUICKSTART.md`, `SECURITY_FIXES.md`, `SECURITY_AUDIT_REPORT.md` (security practices)

If docs conflict, follow `docs/CLAUDE_DEV_GUIDE.md`. Treat `GEMINI.md` as potentially stale.

## Hard constraints (do not violate)
- Admin React must remain `react@18.3.1` and `react-dom@18.3.1` EXACT (no `^` / `~`).
  - Note: `admin/package.json` currently uses `^`; treat this as a bug/footgun (see `docs/TROUBLESHOOTING.md`).
- Mobile uses React `19.2.0`; do not unify React versions across `admin/` and `mobile/`.
- Admin UI kit is Ant Design 5.x (+ Pro components). Do not add another UI framework.
- Frontend global state is Zustand. Do not introduce Redux/MobX/Recoil unless requested.
- Backend layering is strict: `handler -> service -> repository`.
- Backend Go version: `server/go.mod` currently declares `go 1.21`.
- Never hardcode secrets (JWT secret, DB password, API keys). Use env/config.

## Commands (build/lint/test)

### Root (repo)
- Start infra only (Postgres + Redis): `npm run infra` (runs `docker compose up -d db redis`).
- Dev (multi-process): `npm run dev` (runs infra + concurrently: server/admin/mobile).
- E2E tests (Playwright): `npm run test:e2e`.
- Run a single E2E file: `npx playwright test tests/e2e/basic.test.ts`.
- Run a single E2E test by title: `npx playwright test -g "Basic Page Load"`.
- Note: E2E assumes `baseURL` is serving the app under test (see gotchas below).

Docker Compose variants in repo:
- Local full stack (db/redis/api hot reload/admin dev): `docker-compose -f docker-compose.local.yml up -d`.
- Local dev env (db/redis only, persistent): `docker-compose -f docker-compose.dev-env.yml up -d`.

### server/ (Go)
- Dev (hot reload, requires `air`): `cd server && make dev`.
- Build: `cd server && make build`.
- Test all: `cd server && make test` (runs `go test -v ./...`).
- Test a single package: `cd server && go test -v ./internal/service`.
- Test a single test (all packages): `cd server && go test -v ./... -run '^TestName$'`.
- Test a single test (one package): `cd server && go test -v ./internal/service -run '^TestName$'`.
- Disable test cache when debugging: add `-count=1`.
- Format: `cd server && make fmt`.
- Lint: `cd server && make lint` (requires `golangci-lint`).

### admin/ (React + Vite)
- Install + dev: `cd admin && npm install && npm run dev`.
- Build: `cd admin && npm run build` (runs `tsc -b` then `vite build`).
- Lint: `cd admin && npm run lint`.
- Lint one file: `cd admin && npx eslint src/path/to/file.tsx`.

### mobile/ (React Native)
- Start Metro: `cd mobile && npm install && npm run start`.
- Run Android: `cd mobile && npm run android`.
- Run iOS: `cd mobile && npm run ios`.
- Lint: `cd mobile && npm run lint`.
- Test (Jest): `cd mobile && npm test`.
- Run a single test file: `cd mobile && npm test -- __tests__/App.test.tsx`.
- Run a single test by name: `cd mobile && npm test -- -t "renders correctly"`.
- Note: `cd mobile && npm run web` currently prints "Web build disabled".

### mini/ (Taro)
- Dev (WeChat): `cd mini && npm install && npm run dev:weapp`.
- Build: `cd mini && npm run build:weapp`.
- Lint: `cd mini && npm run lint`.
- Format: `cd mini && npm run format`.

### mcp-server/
- Build: `cd mcp-server && npm install && npm run build`.
- Dev watch: `cd mcp-server && npm run dev`.

### Playwright E2E gotchas
- Config: `playwright.config.ts` uses `testDir: ./tests/e2e` and `baseURL: http://localhost:5174`.
- Before running E2E, verify what should be serving `http://localhost:5174` in this repo (current root `dev:mobile` does not start a web build).

## Code style guidelines

### General
- Prefer the smallest correct change; do not refactor unrelated code while fixing bugs.
- Do not add new dependencies without explicit approval.
- Do not touch generated artifacts: `**/node_modules/**`, `**/dist/**`, `output/`, `playwright-report/`, `test-results/`, `db_data_local/`.
- Keep changes local to the module you are working in (admin vs mobile vs mini have different constraints).

### Go backend conventions (server/)
- Layering is mandatory:
  - handler: validate/parse IO, call service, return response
  - service: business logic, orchestration
  - repository: DB access via GORM
- File naming: Go files are `snake_case.go`.
- Formatting: run `make fmt` before committing.
- Error handling:
  - Avoid `panic` in request paths; return errors.
  - Wrap errors with context: `fmt.Errorf("...: %w", err)`.
  - In handlers, use existing response helpers from `server/pkg/response` (e.g. `response.Success`, `response.BadRequest`, `response.ServerError`).

### TypeScript/React conventions (admin/, mobile/, mini/)
- Types:
  - Prefer strict typing; avoid `any` for new code unless the surrounding module already uses it heavily.
  - Prefer `import type { ... }` for type-only imports.
  - Do not suppress type errors with `as any`, `@ts-ignore`, `@ts-expect-error` (if you must for legacy reasons, add a short justification comment and a follow-up TODO).
- Naming:
  - Components/screens/pages: `PascalCase.tsx` (e.g. `UserList.tsx`, `LoginScreen.tsx`).
  - Hooks: `useX.ts` (e.g. `useSessionExpiry.ts`).
  - Stores/services/utils: `camelCase.ts` (e.g. `authStore.ts`, `dictionaryApi.ts`).
- Imports:
  - Group as: builtins -> third-party -> local.
  - Prefer relative imports in `admin/` and `mobile/` (no stable alias configured).
  - `mini/` supports `@/*` alias via `mini/tsconfig.json`.
- State management:
  - Use existing Zustand store patterns:
    - `admin/src/stores/*` (localStorage-based persistence)
    - `mobile/src/store/*` (SecureStorage/Keychain for auth)
    - `mini/src/store/*` (persist + Taro storage)
- Networking:
  - Admin: use `admin/src/services/api.ts` axios instance + interceptors.
  - Mobile: use `mobile/src/services/api.ts` axios instance; token refresh is implemented there.
  - Mini: use `mini/src/utils/request.ts` wrapper (handles refresh + loading).

### Frontend formatting / linting
- Admin:
  - ESLint flat config: `admin/eslint.config.js`.
  - No repo-wide Prettier config for admin; preserve existing file formatting.
  - TypeScript build config: `admin/tsconfig.app.json` is `strict: true`.
- Mobile:
  - ESLint extends `@react-native`: `mobile/.eslintrc.js`.
  - Prettier config: `mobile/.prettierrc.js` (single quotes, trailing commas, arrowParens avoid).
  - Jest preset: `mobile/jest.config.js`.
- Mini:
  - Has `npm run format` using Prettier on `src/**/*.{ts,tsx,scss}`.

### JS/TS error handling + logging
- Do not use empty `catch` blocks.
- Catch errors as `unknown` and narrow as needed.
- Avoid logging tokens/passwords/phone numbers; redact if needed.

## Cursor/Copilot rules
- No Cursor rules found in `.cursor/rules/` or `.cursorrules`.
- No Copilot instructions found in `.github/copilot-instructions.md`.

## Security
- Follow `SECURITY_QUICKSTART.md` for local verification steps.
- Never commit `.env` files or real secrets; use `.env.example` patterns where present.
