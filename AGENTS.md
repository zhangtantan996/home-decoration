# AGENTS.md - home-decoration

Repo-wide entry rules for coding agents. Keep this file short. Put permanent project facts in `.trellis/spec/`, task context in `.trellis/tasks/`, session learnings in `.trellis/workspace/`, and long explanations in `docs/`.

## Workflow Base

- This repository now uses `Aegis + Trellis + Codex` as the AI coding workflow base.
- `Aegis` is the default execution discipline: read baseline, frame goal and scope, implement narrowly, verify with evidence, review current patch P0/P1, then close.
- `Trellis` is the long-task and project-memory layer: PRD, task state, reusable project specs, workspace journal, and finish-work records.
- `Codex` is the implementation host. `/goal` is reserved for long-running execution after Trellis has produced clear task context or CSV-style work items.
- Do not add workflow rules to this file by default. Before changing `AGENTS.md`, analyze existing rules for conflicts, duplication, priority clashes, and consolidation opportunities.

## Default Task Routing

- Small direct tasks: user describes a bug or feature -> Aegis discipline -> Codex implements -> minimal verification -> patch P0/P1 review -> close.
- Medium tasks: use Aegis goal framing when scope, risk, or validation needs explicit boundaries.
- Large or cross-module tasks: use Trellis brainstorm/start -> PRD -> task context -> implement/check -> finish-work.
- Very long tasks: use Trellis task context -> optional `issues/*.csv` -> `/goal @issues/*.csv` -> final REVIEW.
- If the user explicitly says "只回答 / 不改代码 / 不跑命令 / 不提交", stop at that boundary.
- If the request is a clear development, fix, or investigation task, treat it as authorization to proceed within the safety boundaries below.

## Required Reading

Use the smallest useful read set.

1. `.trellis/spec/ai-workflow-routing.md` - AI workflow routing and migration rules.
2. `.trellis/spec/home-decoration-baseline.md` - product, business, engineering, and verification baseline.
3. `docs/AI_WORKFLOW_OPERATION_GUIDE.md` - how to use Aegis, Trellis, Codex, and `/goal`.
4. `docs/CODE_REVIEW_SOP.md` - project-specific review risk table and 3-round stop rule.
5. `docs/CLAUDE_DEV_GUIDE.md`, `docs/TROUBLESHOOTING.md`, `docs/SECURITY.md` - deeper project context when needed.

If docs conflict with executable code, scripts, CI, or checked-in config, follow the executable source of truth and report the conflict.

## Safety And Git

- Local development defaults to `dev` or a branch derived from `dev`. Do not use `main` as a working branch.
- Any `git push` requires explicit user confirmation.
- If push is approved, default target is `origin/dev`. Do not sync or push `origin/main` unless the user explicitly asks for `main` release/sync.
- Never run destructive delete, revert, reset, schema destruction, production-impacting operations, real-account operations, or external-service writes without explicit confirmation.
- Never overwrite or revert user changes you did not make.
- Secrets must stay in env/config. Never commit JWT secrets, DB passwords, API keys, tokens, RAM credentials, SMS keys, OSS keys, or payment secrets.
- `.env` and `.env.local` are gitignored and must not be committed.

## Project Baseline

Primary surfaces:

- `mini/`: primary user transaction surface.
- `merchant/`: primary fulfillment surface.
- `admin/`: primary governance surface.
- `ops/`: service-provider maintenance surface.
- `supervisor/`: project execution surface.
- `web/`: login-gated auxiliary H5 for payment result and browsing.
- `website/`: public landing and brand surface.
- `server/`: Go API and business workflow.
- `deploy/`: Docker, Nginx, gateway, environment wiring.
- `tests/e2e/`: Playwright coverage.

Hard business rules:

- Transaction flow is: design confirmation point A -> quote baseline -> construction party selection -> construction quote -> user confirms construction quote point B -> project creation.
- Design confirmation and foreman confirmation are separate transaction points.
- Project creation happens only after point B.
- Material shops remain a side capability, not the main transaction loop.

High-risk domains:

- `auth`
- `identity`
- `payment/escrow`
- `deploy`
- `rbac`
- `sms`
- `legal/privacy`

High-risk work requires explicit scope framing, targeted verification, and current-patch P0/P1 review.

## Engineering Guardrails

- Backend follows `router -> handler -> service -> repository`.
- `admin/`, `ops/`, `merchant/`, and `supervisor/` use React 18.3.1, Vite, Ant Design 5, and Zustand.
- `mobile/` uses React 19.2, React Native 0.83, and Expo.
- Do not unify React versions across apps.
- Do not introduce Redux, MobX, Recoil, or another UI framework unless explicitly requested.
- Frontend visual values must come from `shared/design-tokens/tokens.json` and generated outputs.
- User-facing UI must not expose API URLs, SQL/schema/database errors, token/JWT, WebSocket internals, localhost, Docker/npm details, stack traces, mock/debug/test-code text, or raw backend errors.
- Artifact/runtime directories are off-limits unless the task explicitly requires them: `**/node_modules/**`, `**/dist/**`, `output/`, `playwright-report/`, `test-results/`, `db_data_local/`, `server/tmp/`, `server/uploads/`.

## Verification And Closeout

- Always report what was verified and what was not.
- Start with the smallest meaningful validation for the touched surface.
- If validation fails, report symptom, repro path, likely cause, and next step; continue fixing unless a high-risk boundary needs user confirmation.
- Before claiming completion: minimal verification -> current patch P0/P1 review -> no blockers -> no unconfirmed high-risk item.
- Only then tell the user the work is ready to commit or ready for the next task.
