# Split-First Issue Plan

## Goal

Turn the current mixed `admin/` frontend into a clean same-repo split foundation so continued MVP development can proceed on top of:

- Admin Web
- Merchant Web
- later User Web

The first phase is **not** full MVP delivery.

The first phase is:

> separate Admin and Merchant ownership cleanly enough that future work can be assigned and built without role confusion.

---

## Issue 1 — Freeze Admin vs Merchant ownership

### Goal

Define which current pages belong to Admin Web and which belong to Merchant Web, and stop treating merchant as an admin sub-area.

### Scope

- inspect current `admin/src/pages/**`
- classify Admin-owned vs Merchant-owned modules
- produce/update documentation if needed

### Expected output

- explicit ownership list
- no new ambiguity for future work

### Acceptance

- merchant page set is explicitly recognized as Merchant Web-owned
- admin page set is explicitly recognized as Admin Web-owned
- future tasks can reference the ownership list directly

---

## Issue 2 — Create dedicated Merchant Web app shell

### Goal

Create an in-repo Merchant Web application shell so merchant stops living as a route island inside the admin app.

### Scope

- dedicated merchant app entry
- merchant router
- merchant layout/app shell
- independent route basename semantics
- independent dev/build entry point

### Constraints

- same repo
- do not change server/API domain architecture in this phase
- minimal necessary shared extraction only

### Acceptance

- Merchant Web can boot independently
- merchant routes are no longer conceptually owned by Admin Web
- merchant has its own route boundary

---

## Issue 3 — Migrate current merchant pages into Merchant Web ownership

### Goal

Move the current merchant business pages out of admin ownership.

### Scope

At minimum current merchant pages including:

- auth / entry
- dashboard
- onboarding / review status
- profile / settings
- cases
- bookings / proposals / orders
- income / withdraw / bank accounts
- chat
- material shop register / settings / products
- merchant legal pages

### Constraints

- preserve working business flows as much as possible
- no big redesign in this issue
- move structure first, optimize later

### Acceptance

- merchant pages live under Merchant Web ownership
- Admin Web no longer has to carry merchant business routes as first-class internal pages

---

## Issue 4 — Define and enforce minimal shared/web extraction

### Goal

Create a clean shared boundary without re-coupling apps.

### Scope

Extract only what is:

- pure
- role-agnostic
- reusable without UI/role leakage

Examples of acceptable shared modules:

- types
- DTO helpers
- formatters
- constants
- tiny utilities

### Not allowed

- shared layouts
- shared role menus
- shared role stores with business semantics
- admin bootstrap leaking into merchant
- merchant bootstrap leaking into admin

### Acceptance

- shared layer remains minimal and pure
- no new re-coupling through convenience extraction

---

## Issue 5 — Separate route/base/build/output semantics

### Goal

Make Admin and Merchant independently understandable in local/dev/build/deploy semantics.

### Scope

- Admin under `/admin/*`
- Merchant under `/merchant/*`
- separate app base/basename handling
- separate build outputs
- avoid artifact mixing through shared `/assets/*` assumptions

### Acceptance

- route semantics are explicit
- local/dev behavior is understandable
- production path intent is preserved
- no continued reliance on admin output to serve merchant-specific pages

---

## Issue 6 — Clean Admin surface after Merchant split

### Goal

Refocus Admin Web on platform-control responsibilities only.

### Scope

- remove merchant-first navigation ownership from Admin
- keep Admin for:
  - review center
  - merchant management
  - demand/project oversight
  - dispute/complaint/payment supervision

### Acceptance

- Admin mainline no longer feels like mixed admin+merchant product
- merchant workflows do not remain promoted in admin navigation

---

## Issue 7 — Validation and rollback notes

### Goal

Define minimal validation for the split and basic rollback expectations.

### Validation checklist

- Admin app boots
- Merchant app boots
- admin routes reachable as intended
- merchant routes reachable as intended
- merchant auth/onboarding path still works structurally
- no obvious cross-app asset pollution

### Rollback notes

- preserve ability to revert route/build split cleanly if cutover breaks local/dev flow
- keep changes staged in logical commits by issue/workstream

---

## Execution order

Recommended order:

1. Issue 1 — ownership freeze
2. Issue 2 — merchant app shell
3. Issue 3 — merchant page migration
4. Issue 4 — shared extraction guardrails while migrating
5. Issue 5 — route/base/build/output separation
6. Issue 6 — admin cleanup
7. Issue 7 — validation and rollback notes

---

## What should happen only after this split phase

Only after the split is structurally stable should we accelerate deeper MVP work such as:

- assigned-demand workflow
- quote comparison completion
- contract/milestone pages
- acceptance/change/dispute pages
- scoring/penalty flow
- dedicated User Web surface
