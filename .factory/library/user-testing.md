# User Testing

Validation surface findings and runtime testing guidance for this mission.

**What belongs here:** primary user surfaces, navigation paths to validate, concurrency limits, known surface-specific gotchas.  
**What does NOT belong here:** service commands or implementation details unrelated to testing.

---

## Validation Surface

### Primary Surface

- `API + Admin + Merchant + User Web`
- Preferred manual/browser entry: `http://127.0.0.1:5175`

### Secondary Surface

- Mini (`mini`) only after the primary surface is stable
- Mini is not a first-closure blocker for this mission

## Critical Navigation Paths

1. Admin quote task list/detail → recommend/select/submit-to-user
2. Merchant assigned quote task list/detail → submit quote
3. User Web progress / pending-entry → quote confirmation → ready_to_start / billing
4. Admin governance list/detail → view blocked/frozen/disputed states

## Validation Concurrency

- Recommended max concurrent validators: **2**

### Rationale

- Machine: 10 CPU cores, 16 GB RAM
- Dry run showed the local stack was already active with multiple containers/frontends
- CPU headroom was acceptable, but memory headroom was tight
- Use 2 concurrent validators to reduce browser + Vite + Node contention

## Known Gotchas

- Merchant browser tests must use the `/merchant/` base path.
- Some legacy smoke assumptions around quote workflow JSON responses are stale.
- Direct URL access is not sufficient evidence for user-facing milestone assertions; prefer actual menu/list navigation.
