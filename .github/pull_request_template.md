## PR Description

<!-- Please provide a brief description of the changes in this PR -->

## Schema Changes

### Migration File(s)
<!-- If this PR includes database schema changes, please list the migration file(s) -->

- [ ] No schema changes
- [ ] New migration file: `server/migrations/`
- [ ] Existing migration updated:

### Schema Source of Truth
> **Note**: Schema truth is in `server/migrations/*.sql`. `model.go` is only a code mapping, not schema truth. `public.sql` / `local_backup.sql` are not formal schema entry points.

### Smoke / Test Coverage
<!-- Please confirm test coverage for schema changes -->

- [ ] Added unit tests in `server/internal/repository/`
- [ ] Added smoke test for high-risk write path
- [ ] No test changes needed (reason: )

### Empty DB Bootstrap
<!-- Please verify if empty database initialization still works -->

- [ ] Verified empty DB bootstrap works with `v1.6.9_reconcile_high_risk_schema_guard.sql`
- [ ] Not applicable (no schema changes)

### Data Migration / Backward Compatibility
<!-- If the changes affect existing data or require data migration -->

- [ ] No data changes required
- [ ] Data migration script included:
- [ ] Backward compatible (explain: )
- [ ] Requires repair migration (explain: )

### Local Verification
<!-- Please run the following before submitting -->

- [ ] `npm run db:check` passes
- [ ] `cd server && make test` passes
- [ ] `cd server && make fmt` passes

## Checkpoints

- [ ] Migration is idempotent
- [ ] Migration can be applied on top of existing schema
- [ ] No secrets committed
- [ ] PR description includes migration information
