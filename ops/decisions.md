# Ops Decisions

## ADR-001 File-first control plane

- Date: 2026-03-17T12:10:00.000Z
- Actor: coordinator
- Task: ops-control-plane-bootstrap

Use repo-tracked files inside `ops/` as the v1 source of truth for project delivery state. Git remains the audit trail, and future SQLite indexing must consume these files instead of replacing them.

## ADR-002 JSON-subset YAML for zero-dependency parsing

- Date: 2026-03-17T12:11:00.000Z
- Actor: coordinator
- Task: ops-control-plane-bootstrap

Keep `project.yaml`, `state.yaml`, and `agents.yaml` in JSON-subset YAML so OpenClaw/Codex can parse and update them with only runtime built-ins. This avoids adding a YAML parser dependency while preserving the requested file names and future compatibility with a richer parser.

## ADR-003 Remote surfaces stay whitelist-only

- Date: 2026-03-17T12:18:00.000Z
- Actor: coordinator
- Task: ops-remote-surface-bootstrap

Expose only safe Telegram actions (`status`, `summary`, `blockers`, `approve`, `run`, `handoff`) and named verify profiles. Do not allow raw shell, file editing, secret reads, or arbitrary external writes through remote entry points.
