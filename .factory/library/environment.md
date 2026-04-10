# Environment

Environment variables, external dependencies, and setup notes for this mission.

**What belongs here:** runtime URLs, service dependencies, local-stack assumptions, validation blockers, env-related gotchas.  
**What does NOT belong here:** service start/stop commands or ports as source of truth (use `.factory/services.yaml`).

---

## Local Stack Assumptions

- Postgres: `127.0.0.1:5432`
- Redis: `127.0.0.1:6380`
- API: `http://127.0.0.1:8080`
- Admin: `http://127.0.0.1:5173/admin/`
- Merchant: `http://127.0.0.1:5174/merchant/`
- Local gateway: `http://127.0.0.1:5175`
- User Web: `http://127.0.0.1:5176`

## Important Constraints

- Current mission reuses the existing local Docker/gateway stack; workers should not bootstrap a second parallel environment.
- Mini is not the first validation surface. Do not block bridge/close milestones on WeChat toolchain readiness.
- Existing worktree contains unrelated user modifications. Never revert or overwrite unrelated changes.

## Validation Readiness Notes

- `scripts/quote-workflow-v1-api-smoke.sh` currently has a known return-shape drift in its later JSON parsing. Workers may repair or replace it with an equivalent focused validation path.
- Merchant browser validation must respect the `/merchant/` public base path.
