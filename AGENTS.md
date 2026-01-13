# Codex Agent Rules (home_decoration)

This file defines working constraints for Codex when editing this repository.

## Source of truth (priority order)

1. `docs/CLAUDE_DEV_GUIDE.md` (P0) - version locks, architecture rules, forbidden operations
2. `docs/TROUBLESHOOTING.md` - known issues + validated fixes
3. `SECURITY_QUICKSTART.md`, `SECURITY_FIXES.md`, `SECURITY_AUDIT_REPORT.md` - security practices and constraints

If docs conflict, follow `docs/CLAUDE_DEV_GUIDE.md`. Treat `GEMINI.md` as potentially stale context.

## Repo map

- `server/`: Go backend (Gin + GORM), REST + WebSocket
- `admin/`: Admin panel (React + Vite + Ant Design), TypeScript
- `mobile/`: React Native app (RN 0.83), TypeScript
- `deploy/`: Docker/Nginx deployment files
- `docs/`: Product/architecture docs (reference before large changes)
- `.superdesign/`: design iterations (design-only outputs)

## Hard constraints (do not violate)

### Versions / ecosystem locks

- **Admin React must stay pinned** to `react@18.3.1` and `react-dom@18.3.1` (no `^` / `~`).
- **Mobile uses React 19.2.0**; do not "unify" React versions across `admin/` and `mobile/`.
- Backend stack stays **Go + Gin**; database stays **PostgreSQL**; cache stays **Redis**.
- Prefer Node.js `>= 20` for JS tooling.

### Frontend conventions

- Admin UI kit: **Ant Design 5.x** (and existing Pro components). Do **not** introduce another UI framework (MUI/Chakra/Bootstrap/etc.).
- Global state: **Zustand**. Do **not** introduce Redux/MobX/Recoil for new work unless explicitly requested.

### Backend architecture

- Keep strict layering: `handler -> service -> repository`.
- Handlers should not talk to DB directly; put business logic in `internal/service/`.

### Safety / security

- Never hardcode secrets (JWT secrets, DB passwords, API keys). Use env vars/config.
- Avoid logging sensitive data; redact tokens/PII in logs and examples.

### What not to touch (unless user explicitly asks)

- `**/node_modules/**`, `db_data_local/`, `output/`, `playwright-report/`, `test-results/`, generated build artifacts
- Large "format everything" refactors unrelated to the task

## Default workflow expectations

- Confirm which target (`server/`, `admin/`, `mobile/`, `deploy/`) before implementing multi-area changes.
- Prefer smallest correct change; avoid scope creep.
- After code changes, run the most relevant checks if available:
  - Go: `cd server; make fmt` / `make test` (or `go test ./...`)
  - Admin: `cd admin; npm run lint` (and `npm run dev` when needed)
  - Mobile: `cd mobile; npm run lint` (and `npm start` / `npm run web` when needed)
- If touching dependencies, explain why and ensure version pins remain valid (especially Admin React 18.3.1).

## UI/design-only requests

If the user asks for UI/UX design mockups (not production code changes), follow the design rule set in:

- `.cursor/rules/design.mdc` (same intent as `.windsurfrules`)

Save design iterations under `.superdesign/design_iterations/` using incremental filenames.

## Local environment shortcuts (Windows)

- Daily startup reference: `.agent/workflows/daily-startup.md`
