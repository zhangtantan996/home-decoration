# Development Guardrails

## Purpose

This document records the current implementation guardrails for `home-decoration` so future development, review, and AI-assisted execution do not drift too far from agreed direction.

## 1. Output style for plans / review tasks

When producing implementation plans, refactor plans, or review suggestions for this project, default to writing for an **AI / coding agent executor**, not as a vague human report.

Expected structure should emphasize:

- goal
- scope
- constraints
- target files / modules
- acceptance criteria
- risks and boundaries
- unresolved items

## 2. Completion-status language must stay strict

Use:

- 已完成
- 部分完成
- 未完成

Avoid vague “almost done” language when reporting implementation state.

## 3. UI stability is a hard requirement

For any UI change or UI review:

- no visible misalignment,
- no overflow,
- no compression breakage,
- no odd layout jumps,
- no broken dynamic areas,
- no “looks fine in default state but breaks on long content / error state / narrow width / add-remove interactions”.

Reviews must not only inspect static default state.

They must consider:

- input-filled states
- error states
- extreme values
- dynamic add/remove
- narrow widths
- long text
- status / help / error area stability

## 4. Web-first, role-separated architecture

Current product direction is:

- User Web
- Merchant Web
- Admin Web

Web-first does **not** mean pushing all business flows into Admin.

Merchant and Admin are expected to diverge more clearly over time.

## 5. Admin / Merchant split direction

Mid-to-long term direction:

- Admin and Merchant should become separate frontend apps.

Current preferred path:

- same repository,
- separate frontend apps,
- server unchanged,
- unified API domain unchanged,
- Admin under `/admin/*`,
- Merchant under `/merchant/*`.

Avoid big-bang repo split in the current stage.

## 6. Shared code must remain minimal and clean

Allowed shared categories should be limited to:

- pure types / DTO helpers
- formatters
- constants
- small pure utilities
- truly generic hooks without role-specific UI meaning

Do **not** re-couple apps through shared:

- layouts
- menus
- stores with role semantics
- page-level components
- role-specific view adapters
- bootstrap logic that leaks one app into another

## 7. Schema source of truth

Database schema truth should be treated as:

- **migration is the only schema source of truth**.

`model.go` is not the source of truth.

`public.sql` / `local_backup.sql` should not be treated as the authoritative evolving schema path.

When a model / handler / service depends on a new column, the change should be accompanied by:

1. migration,
2. minimal smoke / write-path verification,
3. clear statement of compatibility / backfill expectations where needed.

## 8. Schema-drift prevention direction

The project should increasingly move toward:

- empty-database migration verification,
- minimal write-path smoke coverage for high-risk tables,
- low-cost local DB checks / rebuild paths.

Do not normalize a workflow where runtime DB errors are first discovered from user-facing form submissions.

## 9. Verification language must stay honest

Do not describe static inspection as real-device verification.

Do not describe build/lint success as completed UI acceptance.

Keep these distinctions explicit:

- structural fix landed
- local static validation passed
- human regression verified
- real-device behavior verified

## 10. Review expectations for current hot areas

For onboarding / SMS / visibility / app-interaction work, reports should explicitly separate:

- what has landed structurally,
- what is only partially wired,
- what still lacks tests,
- what still lacks manual regression,
- what still lacks production-style rule unification.

## 11. Product-surface discipline

When a capability is not part of the current mainline MVP:

- prefer hide first,
- keep code if needed,
- remove main navigation exposure,
- gate via route, permission, or feature flag,
- avoid noisy user-visible surface area.

## 12. Pricing / quote-display unification principle

For provider pricing UI unification:

- unify information structure,
- unify layout hierarchy,
- unify visual grammar,
- do **not** force all provider types into identical business wording.

Title and unit wording may differ by provider type.

Card structure, quote-area order, spacing, and detail-module rhythm should stay unified.
