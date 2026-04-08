# MVP Product Direction

## Current Goal

This project is not trying to become a feature-heavy all-in-one platform in the current phase.

The near-term goal is to build a **trusted transaction-loop MVP** for home-decoration / light commercial renovation scenarios.

The platform must first prove three things:

1. users are willing to submit real demands here,
2. merchants are willing to operate under platform rules,
3. projects can run end-to-end inside the system.

## What “trusted transaction-loop MVP” means

The MVP should focus on the core lifecycle:

- demand submission
- platform review
- merchant matching / assignment
- quote / proposal comparison
- contract confirmation
- milestone / node management
- delivery submission
- acceptance
- change orders
- complaints / disputes
- payment rhythm / release rhythm
- post-project evaluation

The current stage should optimize for **business closure**, not feature count.

## Three-Web strategy first

Before migrating high-frequency scenarios to mini program / app, the system should first run through the business loop with three web surfaces:

1. **User Web** — decision / confirmation / project collaboration
2. **Merchant Web** — onboarding / quoting / fulfillment / collection workspace
3. **Admin Web** — review / assignment / intervention / governance control tower

This means **Web-first**, not **admin-first**.

User Web, Merchant Web, and Admin Web must remain role-separated even if they temporarily share the same repository or some shared code.

## Stage Update (2026-04)

This document records the earlier **Three-Web / Web-first** exploration path.

As of 2026-04, the current operating strategy has been updated to:

- **Mini Program** as the primary transaction surface
- **Merchant Web** as the primary fulfillment surface
- **Admin Web** as the primary governance surface
- **Web/H5** as landing, payment-result, and auxiliary browsing surfaces

This is a **stage strategy update**, not a denial of the historical value of the original document.

The original Three-Web judgment still explains why heavy review, heavy editing, and heavy governance workflows should stay on web surfaces. The updated strategy only changes the current main transaction entry point.

When strategy or prioritization documents conflict, use:

1. `docs/产品需求文档(PRD).md`
2. `docs/BUSINESS_FLOW.md`
3. `docs/商业运营文档索引_2026-04.md`

as the current baseline.

## Why Web first

At the current stage, the project needs to validate:

- domain objects,
- workflow states,
- role permissions,
- intervention points,
- dispute handling,
- payment rhythm.

These are complex business flows and are easier to iterate on web than on multi-end delivery.

## What should not be the current focus

The following are not first-phase priorities and should not dominate current scope planning:

- open marketplace expansion
- community/forum style content products
- live site streaming
- AI auto-quote as a primary feature
- complex recommendation systems
- heavy membership / points systems
- overly broad financial systems
- large-scale social features

## Product boundary for the current phase

### User Web should primarily support

- submit demand
- review matched merchants
- compare quotes / proposals
- confirm contract and milestone rules
- track project progress
- initiate acceptance / change / complaint
- complete evaluation

### Merchant Web should primarily support

- onboarding / review status
- profile / case / service info maintenance
- receive platform-assigned leads
- submit quotes / proposals
- manage project fulfillment
- submit milestone delivery materials
- respond to changes / complaints
- track collection / withdrawal status

### Admin Web should primarily support

- merchant / identity / case reviews
- demand review and assignment
- project / milestone oversight
- acceptance and dispute intervention
- payment-state supervision
- merchant scoring / penalty operations

## Migration principle for future mini program / app

After the three-web loop is stable:

- migrate high-frequency, light-operation scenarios to mini program / app,
- keep heavy editing / heavy review / heavy governance flows on web.

### Priority candidates for future migration

User side:

- progress tracking
- acceptance confirmation
- complaint / change initiation
- quote summary viewing
- notifications

Merchant side:

- new lead viewing
- milestone submission
- site material upload
- collection status viewing
- quick operational responses

### Long-term web-native scenarios

- admin review center
- dispute handling
- system configuration
- complex quote editing
- contract / milestone template management
- merchant profile and asset-heavy configuration

## Direction guardrail

Do not evaluate success by “how many functions exist”.

Evaluate success by whether the system can reliably support:

- demand intake,
- merchant selection,
- controlled execution,
- exception handling,
- trustworthy completion.
