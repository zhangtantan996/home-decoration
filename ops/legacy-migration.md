# Legacy Migration Inventory

## Status

This file tracks the transition from the old orchestration stack to the new file-first `ops/` control plane.

Current migration stage:
- `ops/` is the active control plane for new work.
- Old workflow assets are still present in the repository for reference or rollback safety.
- No legacy asset in this list should be used as the state source for new tasks.

## Consolidated Into `ops/`

The following legacy references have been absorbed into `ops/runbook.md` and `ops/agents.yaml`:

| Legacy source | Consolidated into | Notes |
|---------------|-------------------|-------|
| `HEARTBEAT.md` | `ops/runbook.md`, `ops/agents.yaml` | startup/end-of-session protocol, routing, self-check rules |
| `MEMORY.md` | `ops/runbook.md`, `ops/agents.yaml`, `ops/project.yaml` | role map, project structure, module boundaries |

These files are now reference-only and should not be used by the new flow as durable state.

## Reference-Only Now

These assets remain in the repo for a short burn-in period but are already outside the new flow:

- `HEARTBEAT.md`
- `MEMORY.md`
- `docs/CCG_QUICK_REFERENCE.md`
- `docs/CCG_WORKFLOW_GUIDE.md`
- `docs/CCG_WORKFLOW_SCENARIOS.md`
- `openspec/`
- `scripts/openspec-dev.ps1`
- `.amazonq/prompts/openspec-apply.md`
- `.amazonq/prompts/openspec-archive.md`
- `.amazonq/prompts/openspec-proposal.md`
- `.speckit/constitution.md`

## Planned Deletion After Burn-In

Delete only after 2 to 3 real tasks have run successfully through `ops/`:

1. `docs/CCG_*`
2. `openspec/`
4. `scripts/openspec-dev.ps1`
5. `.amazonq` OpenSpec prompts
6. `.speckit/constitution.md`

`HEARTBEAT.md` and `MEMORY.md` should be reviewed again after burn-in. If no external automation still depends on them, remove them as well.

## Keep

Keep these because they still provide project context outside the old workflow system:

- `AGENTS.md`
- `IDENTITY.md`
- `USER.md`
- `SOUL.md`
- `memory/`

## Burn-In Exit Criteria

The repo is ready to remove legacy orchestration assets when all of the following are true:

1. At least 2 real tasks updated `ops/state.yaml` and `ops/events.ndjson`.
2. At least 1 task used a named verify profile from `ops/project.yaml`.
3. At least 1 task used approval or handoff through the control plane.
4. No new work referenced `CCG` or `OpenSpec` commands during the burn-in window.
