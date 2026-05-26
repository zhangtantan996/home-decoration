# AI Workflow Routing

This project uses Aegis and Trellis as the new workflow base.

## Role Split

`Aegis` is the default execution discipline:

- baseline-first
- goal and scope framing
- evidence before completion claims
- focused implementation
- smallest meaningful verification
- patch-level P0/P1 review before closeout

`Trellis` is the project task and memory layer:

- long-task PRDs
- task state
- project specs
- reusable decisions
- workspace journals
- finish-work archival

`Codex` is the implementation host.

`/goal` is reserved for long-running execution, usually after Trellis has produced a clear task context or CSV-style task list.

## Default Routing

Small direct tasks:

```text
User describes a bug or small feature -> Aegis discipline -> Codex implements -> verify -> patch review -> close.
```

Medium tasks:

```text
Aegis goal -> baseline read set -> implementation -> verification -> patch review.
```

Large or cross-module tasks:

```text
Trellis brainstorm/start -> PRD -> task context -> implement/check -> finish-work.
```

Very long tasks:

```text
Trellis PRD/task context -> issues/*.csv when useful -> /goal @issues/*.csv -> final REVIEW.
```

## When To Use Trellis

Use Trellis when any of these are true:

- the task crosses more than one app or module
- the task needs PRD-level clarification
- the task may run for hours or across sessions
- the task should produce reusable project memory
- the task touches high-risk domains such as `payment/escrow`, `identity`, `deploy`, or `rbac`
- the task needs a visible status trail for later review

Avoid Trellis for:

- single-file fixes
- text or small UI copy changes
- quick read-only investigations
- small bug fixes with a clear target and obvious verification

## Closeout Gate

Before saying a task is complete:

- run the smallest meaningful verification
- review only the current patch for P0/P1 risks
- continue fixing if validation or review fails
- report what was verified and what was not
- recommend commit only when there is no blocker, validation passed, and no unconfirmed high-risk boundary remains

## Migration Rule

Do not add more workflow rules to `AGENTS.md` by default.

Prefer this direction:

- permanent project facts -> `.trellis/spec/`
- task-specific PRD and context -> `.trellis/tasks/`
- session learnings -> `.trellis/workspace/`
- execution discipline -> Aegis
- concise safety and routing entry point -> `AGENTS.md`
