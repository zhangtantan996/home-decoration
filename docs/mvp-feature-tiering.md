# MVP Feature Tiering

## Purpose

This document defines what should stay in the current mainline product surface and what should be hidden or deprioritized.

The goal is to avoid product drift while the platform is converging toward a trusted transaction-loop MVP.

## Tier definitions

### P0 — mainline / must stay visible

These functions are essential to the MVP business loop and should remain in the main navigation or primary flow.

### P1 — keep in code, weaken in product surface

These functions have value but should not dominate the current mainline experience.

They may stay available via secondary entry points, detail-page entry points, or operational paths.

### P2 — keep code, hide by default

These functions do not determine MVP success in the current phase.

They should be hidden from menus and major CTA flows, and should preferably be controlled by feature flags or permissions.

## User Web tiering

### P0

- home / entry with clear demand-submission CTA
- demand submission
- demand list / detail
- provider list / detail
- quote / proposal comparison
- contract / milestone confirmation
- project progress board
- acceptance
- change order initiation and tracking
- complaint / dispute initiation and tracking
- project completion evaluation

### P1

- case / inspiration discovery
- favorites / browsing history
- basic in-context chat
- supporting content discovery that helps conversion but is not itself the main business flow

### P2

- community / forum features
- AI quote recommendation as a promoted feature
- live site viewing
- points / membership systems
- marketplace expansion that is not connected to the trusted transaction loop

## Merchant Web tiering

### P0

- merchant login / registration
- onboarding / application
- review status and resubmission
- profile / capability management
- case management
- goods / service management where applicable
- assigned-lead / demand intake
- quote / proposal editing
- project list / detail
- milestone delivery submission
- change-order handling
- complaint / after-sales response
- collection / withdrawal / bank binding status

### P1

- chat center
- notification center
- basic business analytics
- secondary operational tools that do not block fulfillment

### P2

- IM test pages
- experimental merchant tools
- old non-mainline pages
- dashboard sections not tied to the current transaction-loop MVP

## Admin Web tiering

### P0

- admin operational dashboard
- review center
- merchant management
- demand review / matching / assignment
- quote / proposal inspection when needed
- contract / project / milestone management
- acceptance management
- dispute / complaint handling
- payment-state / withdrawal supervision
- merchant scoring / penalty operations

### P1

- logs
- risk views
- reporting / analytics
- system dictionaries / region management / support configuration

### P2

- legacy audit entrances that are no longer the mainline
- test or technical utility pages
- immature analysis pages that do not serve the current MVP loop
- low-value configuration exposure that clutters operations

## Hide-don’t-delete policy

For the current phase, prefer **hide first, delete later**.

Do not rush to delete non-mainline code unless:

- the code is proven obsolete,
- the replacement path is already stable,
- or the old path creates material operational risk.

## Recommended hiding methods

### 1. Menu hiding

Use when a function should remain reachable internally but should not appear in main navigation.

### 2. Route hiding / gated registration

Use when a function should not be directly reachable by normal users in the current phase.

### 3. Feature flags

Use for experimental or future-facing capabilities.

Suggested examples:

- `ENABLE_COMMUNITY`
- `ENABLE_SMART_RECOMMEND`
- `ENABLE_MARKETPLACE`
- `ENABLE_MERCHANT_IM_EXPERIMENT`

### 4. Permission-only exposure

Use when a page should stay available only to internal admin or designated operators.

## Product-surface rule

Hiding a function means more than removing a menu item.

When a function is deprioritized, also check and clean:

- homepage cards,
- shortcut entries,
- CTA buttons,
- detail-page deep links,
- dashboard quick actions,
- notification jumps.

## Review rule

When proposing a new page or reviving an old one, the proposer must state:

1. which tier it belongs to,
2. which role uses it,
3. whether it belongs to the current trusted transaction loop,
4. whether it should be visible in main navigation or hidden behind a secondary path.
