# Decisions - Tinode Docker Configuration

## Separate Compose File vs Modifying Existing
**Decision**: Created separate `docker-compose.tinode.yml` file

**Rationale**:
- Modularity: Tinode is optional and can be started independently
- Easier testing: Can test Tinode without affecting main stack
- Cleaner separation: IM service is distinct from core app services
- Follows project pattern: Already has separate compose files (docker-compose.yml, docker-compose.local.yml)

**Usage**: `docker-compose -f docker-compose.tinode.yml up -d`

## Network Configuration
**Decision**: Use `external: true` for `decorating-net` network

**Rationale**:
- Tinode needs to communicate with existing `db` service
- External network allows connection to services in other compose files
- Matches production network name from docker-compose.yml

**Requirement**: Main stack must be running first to create the network

## Database Connection
**Decision**: Connect to existing `home_decoration` database, not separate `tinode` database

**Rationale**:
- Integration guide (section 5.1) shows separate database in example
- But Task 2 schema uses `tinode_` prefixed tables in same database
- Simpler deployment: One database to manage
- Easier data relationships: Can join with existing user tables if needed

## Environment Variables
**Decision**: Use `${VAR:-default}` pattern in docker-compose, `${VAR}` in tinode.conf

**Rationale**:
- Docker Compose supports default values for missing env vars
- Tinode config uses simple substitution (handled by Tinode at runtime)
- JWT_SECRET reused from existing app configuration

## Push Notifications
**Decision**: Empty push array in initial config

**Rationale**:
- Push notifications deferred to Phase 2 (per issues.md)
- FCM and APNS variables added to .env.example for future use
- Can be configured later without changing compose file

## Backend Tinode Auth (Token + User Sync)
**Decision**: Generate Tinode token during login/register and return it as `tinodeToken` (best-effort).

**Rationale**:
- Mobile needs a Tinode-compatible JWT at auth time to avoid a second login.
- Tinode DB sync is non-critical; failures should not block core authentication.
- Use the same JWT secret as the main backend (`cfg.JWT.Secret`) to keep key management simple.

## [2026-01-22 19:16] Task 4: User ID Type - VARCHAR vs BIGSERIAL

**Decision**: Changed tinode_users.id from BIGSERIAL to VARCHAR(255)

**Rationale**:
- Tinode uses string-based user IDs in format usr{userID} (e.g., usr123)
- Backend code generates these string IDs via tinodeUserID() function
- Foreign keys (owner, from_user, user_id) also changed to VARCHAR for consistency
- Allows future flexibility for non-numeric ID schemes

**Impact**: Schema now matches application code expectations

## Admin Frontend Architecture
**Decision**: Create `TinodeService` singleton wrapper around `tinode-sdk`.

**Rationale**:
- Provides a unified interface for connection and state management.
- Avoids prop drilling of the Tinode instance.
- Allows strict type control (via `tinode-sdk.d.ts`) centralized in one place.

**Decision**: Comment out TUIKit code instead of deleting.

**Rationale**:
- Requested by task.
- Serves as a reference for required features (conversation list, chat UI) during the migration.
