# Ops Runbook

## Purpose

This directory is the v1 control plane for `home-decoration` and the base template for future OpenClaw-first projects.

Core rules:
- `ops/` files are the only durable state source for task coordination.
- Main session stays thin: classify, split, assign, update state, summarize.
- Specialists only touch their owned paths.
- Verifier work stays isolated from implementation write sets.
- Remote entry points are whitelist-only and never expose secrets.
- Legacy `HEARTBEAT.md` and `MEMORY.md` are reference-only after this migration stage; new sessions should read `ops/` first.

## File Layout

- `project.yaml`: project adapter, module map, verify profiles, remote policy, legacy ignored assets
- `state.yaml`: current task state, blockers, next actions, active session
- `events.ndjson`: append-only event log
- `decisions.md`: append-only decisions
- `agents.yaml`: role boundaries and escalation rules
- `server.mjs`: local WebUI/API server
- `telegram-bot.mjs`: Telegram polling bridge
- `validate.mjs`: schema and cross-reference validation

Note: v1 keeps `*.yaml` in JSON-subset YAML format so runtime code can parse it without adding dependencies. Later SQLite support should index these files instead of replacing them.

## Task Lifecycle

Supported task statuses:
- `queued`
- `in_progress`
- `blocked`
- `pending_approval`
- `approved`
- `done`
- `cancelled`

State update protocol:
1. Update `state.yaml`
2. Append one record to `events.ndjson`
3. If architecture or policy changed, append to `decisions.md`

Never use chat history as the system of record.

## Main Session Model

Main session responsibilities:
- classify incoming work
- split multi-module work into bounded tasks
- assign exactly one owner role per task
- keep `state.yaml` and `events.ndjson` current
- ask verifier to validate before closing risky work

Specialists:
- must stay inside `agents.yaml` ownership
- must not cross-write into other module surfaces
- hand off instead of silently drifting into another role

Verifier:
- may add or update tests only inside verifier-owned paths
- does not patch implementation files
- reports findings or acceptance evidence back through ops state

## Session Protocol

Session start:
1. Read docs in `project.yaml.project.docs_order`.
2. Read `ops/state.yaml`, `ops/decisions.md`, and the recent tail of `ops/events.ndjson`.
3. Load relevant project memory from `memory/` if the task touches architecture, deployment, or prior pitfalls.
4. Pick or create a bounded task in `ops/state.yaml` before implementation.

Session end:
1. Ensure `state.yaml` reflects the final task status.
2. Append at least one event to `events.ndjson` for progress, blocker, handoff, verify, or decision.
3. If a policy or architecture change happened, append it to `decisions.md`.
4. If durable project learning emerged, update the relevant file in `memory/`:
   - `memory/decisions.md`
   - `memory/pitfalls.md`
   - `memory/patterns.md`
   - `memory/deployment.md`

Trigger-based memory usage:
- Prior pitfall: read `memory/pitfalls.md`
- Architecture decision: read `memory/decisions.md`
- Deploy/config change: read `memory/deployment.md`
- Reusable implementation pattern: read or update `memory/patterns.md`

## Legacy Role Mapping

Old names from `HEARTBEAT.md` and `MEMORY.md` map to current role ids as follows:

| Legacy name | Current role id | Current scope |
|-------------|-----------------|---------------|
| `婷婷（总控）` | `coordinator` | classify, split, delegate, summarize |
| `网页侦察员（Web）` | `web` | `web/` and browser-facing user-web work |
| `后端工匠（Server）` | `backend` | `server/` |
| `管理台匠人（Admin）` | `admin` | `admin/` |
| `小程序工匠（Mini）` | `mini` | `mini/` |
| `移动端工匠（Mobile）` | `mobile` | `mobile/` |
| `质检员（QA）` | `verifier` | `tests/e2e/`, `tests/ops/`, acceptance |

Routing note:
- Old `Web / X / 页面提取 / 浏览器` routing now splits into:
  - `web` for repository work under `web/`
  - local Playwright or browser tooling for runtime inspection
- Old `只读分析 / 评审` is no longer a standalone permanent role in v1. Use the main session for bounded analysis, or add a dedicated read-only role later if needed.

## Commands

Validate the control plane:
```bash
node ops/validate.mjs
```

Run the control-plane tests:
```bash
node --test tests/ops/schema.test.mjs tests/ops/routing.test.mjs tests/ops/state-store.test.mjs tests/ops/remote.test.mjs tests/ops/engine.test.mjs
```

Launch WebUI/API:
```bash
node ops/server.mjs
```

Launch the full automatic control plane (recommended):
```bash
node ops/system.mjs
```

Runtime options:
- `OPS_HOST`
- `OPS_PORT`
- `OPS_ENGINE_INTERVAL_MS`

Enable Telegram remote control:
```bash
export OPS_TELEGRAM_BOT_TOKEN=...your-bot-token...
export OPS_TELEGRAM_CHAT_ID=...optional-allowed-chat-id...
node ops/telegram-bot.mjs
```

Recommended automatic mode:
```bash
export OPS_TELEGRAM_BOT_TOKEN=...your-bot-token...
export OPS_TELEGRAM_CHAT_ID=...optional-allowed-chat-id...
node ops/system.mjs
```

Supported Telegram commands:
- `/status`
- `/summary`
- `/blockers`
- `/task <任务描述>`
- `/approve <task-id>`
- `/run <named-profile>`
- `/handoff <task-id> <role> [reason]`

`/task` behavior:
- auto-routes to one module role when the description clearly matches one surface
- falls back to `coordinator` when the description is ambiguous or spans multiple modules
- auto-marks high-risk work as `pending_approval`
- requires `/approve <task-id>` before risky work should start

Automatic execution flow:
1. `task` enters `ops/state.yaml`
2. `engine` plans coordinator tasks and splits cross-module work
3. runnable leaf tasks are dispatched to the worker executor
4. worker result is written back to state/events
5. the task's named verify profile runs automatically
6. result is reported back to Telegram when the task originated there

Remote entry points must never support:
- arbitrary shell
- arbitrary file edits
- secret reads
- arbitrary external API writes

## Verify Profiles

Remote-runnable profiles are explicitly marked in `project.yaml`.

Current safe remote profiles:
- `ops-validate`
- `ops-control-plane-tests`
- `merchant-smoke`
- `web-build`
- `user-web-e2e`
- `user-web-verify`
- `identity-acceptance`

Non-remote profiles remain local-only even if they exist in the project config.

## Legacy Migration

Legacy assets are recorded in `project.yaml.legacy_ignored` and are not part of the new flow.

Migration path:
1. Use `ops/` for all new task coordination now.
2. Treat root `HEARTBEAT.md` and `MEMORY.md` as reference-only; do not use them as the state source.
3. Stop referencing `CCG/OpenSpec` docs and scripts in new work.
4. Run 2-3 real tasks through this control plane.
5. Delete legacy CCG/OpenSpec assets after the new flow is stable.

## Security Rules

- Store remote tokens only in runtime env or system keychain.
- Never commit remote tokens, bot tokens, API keys, or chat IDs with secret meaning.
- If a future external integration is needed, prefer credential-isolated adapters where the agent sees only capability names and payload contracts.
