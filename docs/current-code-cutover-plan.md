# Current Code Cutover Plan

## Purpose

This document translates the agreed MVP direction into the **first concrete repository cutover plan**.

Immediate focus:

1. separate Admin Web and Merchant Web inside the current repository,
2. stop treating merchant flows as an admin sub-area,
3. use that split as the foundation for continued MVP development.

This is a planning and execution-baseline document, not a final implementation report.

---

## 1. Current code reality

### Current frontend reality

The repository currently has a single `admin/` frontend application, but inside it there are actually **two different product surfaces mixed together**:

- Admin Web pages
- Merchant Web pages

Evidence today:

- admin-like pages under `admin/src/pages/*`
- merchant workspace and onboarding pages under `admin/src/pages/merchant/*`

Representative merchant pages already living in `admin/`:

- `MerchantLogin.tsx`
- `MerchantRegister.tsx`
- `MerchantDashboard.tsx`
- `MerchantSettings.tsx`
- `MerchantCases.tsx`
- `MerchantProposals.tsx`
- `MerchantBookings.tsx`
- `MerchantIncome.tsx`
- `MerchantWithdraw.tsx`
- `MerchantBankAccounts.tsx`
- `MerchantChat.tsx`
- `MaterialShopRegister.tsx`
- `MaterialShopSettings.tsx`
- `MaterialShopProducts.tsx`

### Why this is a problem

This structure blocks the intended product direction in several ways:

1. **role boundary confusion** — merchant workflows are still physically and semantically attached to Admin Web,
2. **navigation drift** — merchant pages are easier to keep as side-paths instead of becoming a real merchant product surface,
3. **implementation drift** — shared code may accidentally grow around admin assumptions,
4. **deployment confusion** — admin and merchant path semantics are harder to harden independently,
5. **future migration friction** — it becomes harder to evolve merchant independently and later migrate high-frequency merchant scenarios.

So the first major execution step should be:

> separate Admin Web and Merchant Web within the repo before expanding MVP scope too far.

---

## 2. Phase goal

### Phase 0 / Phase 1 combined target

Build a clean same-repo split with:

- `admin` = Admin Web only
- `merchant` = Merchant Web only
- shared code restricted to a minimal pure layer
- route semantics clearly separated:
  - Admin under `/admin/*`
  - Merchant under `/merchant/*`

This split is the **foundation phase** for continued MVP work.

---

## 3. Target architecture

## Frontend apps

### Admin Web

Responsibilities:

- review center
- merchant management
- demand review / assignment
- project / milestone oversight
- dispute / complaint intervention
- payment-state / withdrawal supervision
- scoring / penalty
- supporting configuration

### Merchant Web

Responsibilities:

- login / onboarding / review status
- profile / cases / goods / capability management
- assigned demand handling
- quote / proposal editing
- project execution
- milestone delivery submission
- change / complaint response
- collection / withdrawal status

## Shared layer

Recommended shared location:

- `shared/web/`

Allowed content:

- types / DTO helpers
- pure formatters
- constants
- tiny pure utilities
- narrowly scoped generic hooks without role-specific UI semantics

Not allowed:

- layouts
- menus
- page-level business components
- role-specific stores
- role-specific route guards
- bootstrap logic that leaks one app into another

---

## 4. First repository-cutover tasks

### Task A — freeze ownership boundaries

Define which current pages remain in Admin Web and which pages move to Merchant Web.

#### Keep in Admin Web

Examples from current code:

- `admin/src/pages/dashboard/index.tsx`
- `admin/src/pages/audits/*`
- `admin/src/pages/providers/ProviderList.tsx`
- `admin/src/pages/materials/MaterialShopList.tsx`
- `admin/src/pages/cases/CaseManagement.tsx`
- `admin/src/pages/projects/*`
- `admin/src/pages/bookings/*`
- `admin/src/pages/finance/*`
- `admin/src/pages/risk/*`
- `admin/src/pages/settings/*`
- `admin/src/pages/system/*`
- `admin/src/pages/permissions/*`
- `admin/src/pages/users/*`
- `admin/src/pages/admins/*`

#### Move to Merchant Web

Current merchant-owned pages under `admin/src/pages/merchant/*` should become Merchant Web assets, including:

- merchant auth and entry
- merchant dashboard
- merchant profile/settings
- merchant cases
- merchant proposals
- merchant bookings/orders
- merchant income / withdrawal / bank accounts
- merchant chat
- material shop onboarding/settings/products
- merchant legal/onboarding documents

### Task B — create Merchant Web app shell

Create a dedicated Merchant Web app in-repo.

Goal:

- Merchant should stop being a route island inside the admin app,
- Merchant should have its own app shell, router, entry, and build output.

Minimum needs:

- own app entry
- own router
- own layout
- own route basename semantics
- own static output path

### Task C — keep Admin app admin-only

After Merchant Web shell exists:

- remove merchant routes from Admin Web mainline navigation and future ownership,
- keep Admin focused on platform-control responsibilities.

### Task D — establish shared/web extraction rules

Before moving code around aggressively, define extraction rules:

Move to shared only if the module is:

- pure,
- role-agnostic,
- view-neutral,
- not tied to admin/merchant bootstrap semantics.

Do **not** extract things into shared just because both apps happen to use them once.

### Task E — deployment/output separation

Static artifacts should converge toward:

- Admin output → `/admin/*`
- Merchant output → `/merchant/*`

Do not continue copying merchant artifacts through admin build output or shared root `/assets/*` semantics.

---

## 5. Sequencing recommendation

## Step 1 — split foundation first

Do first:

1. create Merchant Web app shell,
2. migrate current merchant pages into Merchant ownership,
3. isolate routing and build semantics,
4. keep server and API domain unchanged.

Do not try to simultaneously finish the full transaction-loop MVP while the role split is still structurally mixed.

## Step 2 — after split, continue MVP development

Once Admin vs Merchant separation is clean enough, continue with the next MVP workstreams:

### Merchant-side MVP continuation

- onboarding hardening
- profile completeness / visibility correctness
- quote / proposal workflow
- assigned-demand workflow
- project execution workspace
- milestone delivery workflow
- collection / withdrawal status

### Admin-side MVP continuation

- review center stabilization
- merchant visibility / governance
- demand review / assignment
- dispute / complaint handling
- payment-state supervision
- scoring / penalty model foundation

### User-side future Web work

Parallel or subsequent work should introduce the dedicated User Web surface for:

- demand submission
- quote comparison
- contract/milestone confirmation
- progress tracking
- acceptance/change/complaint interaction

---

## 6. Current classification of repository surfaces

### Admin Web = current P0 ownership

Current pages already aligned with Admin Web:

- audits
- providers/materials management
- cases management
- projects
- bookings/disputes
- finance views
- risk
- system/config/permissions
- logs
- admin/user management

### Merchant Web = current P0 ownership once split is created

Current pages already aligned with Merchant Web:

- onboarding
- merchant dashboard/workspace
- merchant profile and cases
- merchant proposals/orders/bookings
- merchant income/withdraw/bank
- merchant chat
- material shop registration/settings/products
- merchant legal pages

### Hidden or deprioritized after split

These should not become first-phase mainline highlights:

- `IMTest.tsx`
- any experimental merchant tool surface
- pages that do not contribute to the trusted transaction loop

---

## 7. Acceptance criteria for this split phase

This phase can be considered structurally complete only when:

1. Admin Web no longer semantically owns merchant business pages,
2. Merchant Web has its own app shell and routing boundary,
3. `/admin/*` and `/merchant/*` semantics are independently understandable,
4. shared code is kept minimal and does not re-couple the apps,
5. future MVP tasks can be assigned by surface without ambiguity.

---

## 8. Risks and guardrails

### Main risk

Trying to continue adding major MVP features before the split is clean enough.

That will increase coupling and make later separation more expensive.

### Guardrail

For the next planning cycle, treat the split as the first prerequisite workstream.

New feature work should be evaluated as:

- Admin-owned,
- Merchant-owned,
- future User Web-owned,

instead of continuing to accumulate under the current mixed `admin/` ownership model.

---

## 9. Next planning output expected

The next execution artifact should be an **issue-level split plan**, including at minimum:

1. ownership freeze,
2. merchant app shell creation,
3. route/build/output separation,
4. shared/web extraction rules,
5. admin cleanup,
6. validation and rollback notes.
EOF

git add docs/current-code-cutover-plan.md && git commit -m "docs: add split-first cutover plan"