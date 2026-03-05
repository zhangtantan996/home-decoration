## Why

Tinode IM integration is currently 85% complete but has critical issues that block production deployment:

1. **Security Risks**: Hardcoded API keys in mobile app, missing environment configuration
2. **Broken Functionality**: ClearChatHistory endpoint only logs but doesn't delete messages
3. **Silent Failures**: Token generation failures are logged but not surfaced to users
4. **Data Integrity**: User sync operations lack transaction support, risking inconsistent state
5. **Incomplete Coverage**: WeChat Mini Program has 0% integration

These issues were discovered during comprehensive code review and must be fixed before the system can be considered production-ready.

## What Changes

### Phase 1: Critical Fixes (P0 - Week 1)
1. **Environment Configuration**: Create `.env` file with proper Tinode keys (TINODE_UID_ENCRYPTION_KEY, TINODE_AUTH_TOKEN_KEY)
2. **ClearChatHistory Implementation**: Replace fake logging with actual Tinode message deletion via gRPC
3. **Remove Hardcoded Secrets**: Move API key from mobile app to environment variables
4. **Token Generation Error Handling**: Return errors to client instead of silent failures
5. **Transaction Support**: Wrap user sync operations in database transactions

### Phase 2: WeChat Mini Program Integration (P1 - Week 2-3)
1. Create `mini/src/services/TinodeService.ts` adapted for Taro
2. Implement Taro WebSocket connection handling
3. Add message send/receive functionality
4. Integrate with existing auth flow

### Phase 3: Testing & Monitoring (P1 - Week 4)
1. Add E2E tests for critical flows (login, send message, receive message)
2. Configure Prometheus metrics collection
3. Set up Grafana dashboards
4. Configure alerting rules

## Capabilities

### New Capabilities
- `tinode-clear-chat`: Ability to delete chat history via Tinode gRPC API
- `tinode-mini-program`: WeChat Mini Program integration with Tinode IM
- `tinode-monitoring`: Prometheus metrics and Grafana dashboards for Tinode health

### Modified Capabilities
- `tinode-user-sync`: Add transaction support to prevent inconsistent state
- `tinode-token-generation`: Return errors to client instead of silent failures
- `tinode-mobile-config`: Remove hardcoded API keys, use environment variables

## Impact

### Affected Code
- **Backend**:
  - `server/internal/tinode/auth_adapter.go` (token generation error handling)
  - `server/internal/handler/tinode_handler.go` (ClearChatHistory implementation)
  - `server/internal/service/user_service.go` (transaction support)
  - `server/.env` (new file for configuration)

- **Mobile App**:
  - `mobile/src/services/TinodeService.ts` (remove hardcoded API key)
  - `mobile/.env` (new file for configuration)

- **WeChat Mini Program**:
  - `mini/src/services/TinodeService.ts` (new file)
  - `mini/src/pages/message/index.tsx` (integration)

### Affected APIs
- `DELETE /api/v1/tinode/topic/:topic/messages` (behavior change: now actually deletes)
- `POST /api/v1/auth/login` (error response change: now returns token generation errors)
- `POST /api/v1/auth/register` (error response change: now returns sync errors)

### Dependencies
- Tinode gRPC client library (for ClearChatHistory)
- Prometheus client library (for monitoring)
- Taro WebSocket adapter (for Mini Program)

### Systems
- Tinode server (Docker container)
- PostgreSQL (Tinode database)
- Prometheus (metrics collection)
- Grafana (visualization)
