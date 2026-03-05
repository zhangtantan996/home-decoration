# Tinode IM Integration Fixes - Design Document

## Architecture Overview

### Current State
- Tinode server running in Docker (healthy, 46+ hours uptime)
- Dual IM system: Tinode (primary) + Tencent Cloud IM (backup)
- Backend: Go + Gin, using GORM for database access
- Frontend: React Native (Mobile), React (Admin), Taro (Mini Program)
- Database: PostgreSQL (main) + PostgreSQL (Tinode)

### Target State
- All P0 issues fixed (security, functionality, reliability)
- WeChat Mini Program fully integrated
- Comprehensive monitoring and alerting
- Production-ready system with 80%+ test coverage

## Technical Decisions

### 1. Environment Configuration Strategy

**Decision**: Use `.env` files for all environments (dev, staging, prod)

**Rationale**:
- Consistent with existing project structure (server/config.yaml references env vars)
- Prevents accidental secret commits
- Easy to override in different environments

**Implementation**:
```bash
# server/.env
TINODE_UID_ENCRYPTION_KEY=your_uid_encryption_key_here
TINODE_AUTH_TOKEN_KEY=your_auth_token_key_here
TINODE_GRPC_LISTEN=:16060

# mobile/.env
TINODE_API_KEY=AQEAAAABAAD_rAp4DJh05a1HAwFT3A6K
TINODE_SERVER_URL=http://localhost:6060
```

**Validation**: Backend must fail fast if required env vars are missing

### 2. ClearChatHistory Implementation

**Decision**: Use Tinode gRPC API for message deletion

**Rationale**:
- Tinode provides gRPC API for administrative operations
- Direct database manipulation risks data corruption
- gRPC ensures proper cleanup of related data (subscriptions, notifications)

**Implementation Approach**:
```go
// server/internal/tinode/grpc_client.go
type GRPCClient struct {
    conn *grpc.ClientConn
    client pb.NodeClient
}

func (c *GRPCClient) DeleteMessages(topic string, userID uint64) error {
    // 1. Connect to Tinode gRPC (localhost:16060)
    // 2. Authenticate as admin
    // 3. Call {del} message with hard delete flag
    // 4. Handle errors and retry logic
}
```

**Error Handling**:
- If Tinode server unavailable: Return 503 Service Unavailable
- If topic not found: Return 404 Not Found
- If user not authorized: Return 403 Forbidden
- Log all operations for audit trail

### 3. User Sync Transaction Support

**Decision**: Wrap all user sync operations in GORM transactions

**Rationale**:
- Prevents inconsistent state between main DB and Tinode DB
- Allows rollback if Tinode sync fails
- Follows existing escrow transaction pattern

**Implementation Pattern**:
```go
func (s *UserService) Register(req RegisterRequest) (*User, error) {
    tx := s.db.Begin()
    defer tx.Rollback()

    // 1. Create user in main DB
    user := &model.User{...}
    if err := tx.Create(user).Error; err != nil {
        return nil, err
    }

    // 2. Sync to Tinode (using Tinode DB connection)
    if err := tinode.SyncUserToTinodeWithTx(s.tinodeDB, user); err != nil {
        return nil, fmt.Errorf("tinode sync failed: %w", err)
    }

    // 3. Commit both operations
    if err := tx.Commit().Error; err != nil {
        return nil, err
    }

    return user, nil
}
```

**Rollback Strategy**:
- If Tinode sync fails, rollback main DB transaction
- Log failure for manual investigation
- Return error to client with clear message

### 4. Token Generation Error Handling

**Decision**: Return errors to client instead of silent failures

**Rationale**:
- Users need to know if login succeeded but IM is unavailable
- Allows frontend to show appropriate error messages
- Enables retry logic on client side

**Response Format**:
```json
{
  "code": 0,
  "message": "登录成功",
  "data": {
    "token": "eyJhbGc...",
    "refreshToken": "eyJhbGc...",
    "tinodeToken": "",
    "tinodeError": "Tinode token generation failed: TINODE_AUTH_TOKEN_KEY not configured"
  }
}
```

**Frontend Handling**:
- If `tinodeToken` is empty, show warning: "聊天功能暂时不可用"
- Allow user to continue using other features
- Retry token generation on next login

### 5. WeChat Mini Program Integration

**Decision**: Create Taro-specific TinodeService with WebSocket adapter

**Rationale**:
- Taro uses different WebSocket API than React Native
- Need to handle WeChat-specific lifecycle events
- Code structure should mirror mobile app for consistency

**Architecture**:
```
mini/src/services/
├── TinodeService.ts          # Main service (similar to mobile)
├── TaroWebSocketAdapter.ts   # Taro-specific WebSocket wrapper
└── types.ts                  # Shared types
```

**Key Differences from Mobile**:
- Use `Taro.connectSocket` instead of `WebSocket`
- Handle WeChat app lifecycle (onShow, onHide)
- Store connection state in Taro.setStorageSync
- Use Taro.showToast for error messages

### 6. Monitoring Strategy

**Decision**: Use Prometheus + Grafana for metrics and alerting

**Rationale**:
- Industry standard for Go applications
- Tinode server already exposes Prometheus metrics
- Easy to integrate with existing infrastructure

**Metrics to Track**:
- Tinode server health (up/down)
- Message send/receive latency
- WebSocket connection count
- Token generation success/failure rate
- User sync success/failure rate
- gRPC call latency and error rate

**Alert Rules**:
- Tinode server down for >1 minute → Critical
- Message delivery failure rate >10% → Warning
- Token generation failure rate >5% → Warning
- gRPC call latency >1s → Warning

## Risk Mitigation

### Risk 1: gRPC Connection Failures

**Mitigation**:
- Implement connection pooling with max 10 connections
- Add circuit breaker pattern (fail fast after 3 consecutive failures)
- Implement exponential backoff for retries (1s, 2s, 4s, 8s)
- Log all connection failures for debugging

### Risk 2: Transaction Deadlocks

**Mitigation**:
- Keep transactions short (<100ms)
- Always acquire locks in same order (main DB first, then Tinode DB)
- Set transaction timeout to 5 seconds
- Monitor deadlock metrics in PostgreSQL

### Risk 3: WeChat Mini Program Compatibility

**Mitigation**:
- Test on multiple WeChat versions (latest 3 versions)
- Test on both iOS and Android WeChat
- Implement fallback to polling if WebSocket fails
- Add detailed error logging for debugging

### Risk 4: Dual IM System Confusion

**Mitigation**:
- Clear documentation on which system to use (Tinode primary)
- Deprecation plan for Tencent Cloud IM (after 1 month evaluation)
- Separate code paths with clear comments
- Feature flags to switch between systems if needed

## Testing Strategy

### Unit Tests (Target: 80% coverage)

**Backend**:
- `tinode/auth_adapter_test.go`: Token generation, UID encoding
- `tinode/grpc_client_test.go`: Message deletion, error handling
- `service/user_service_test.go`: Transaction rollback scenarios

**Frontend**:
- `TinodeService.test.ts`: Connection, message send/receive
- `TaroWebSocketAdapter.test.ts`: Taro-specific WebSocket handling

### Integration Tests

**Backend**:
- User registration → Tinode sync → Token generation (end-to-end)
- Clear chat history → Verify messages deleted in Tinode DB
- Transaction rollback → Verify no orphaned records

**Frontend**:
- Login → Connect to Tinode → Send message → Receive message
- Offline → Online → Receive queued messages
- Token refresh → Reconnect to Tinode

### E2E Tests (Playwright)

**Critical Flows**:
1. User registers → Logs in → Sends message → Receives reply
2. User clears chat history → Verifies messages deleted
3. User goes offline → Comes back online → Receives offline messages
4. WeChat Mini Program user → Chats with Mobile app user

### Manual Testing Checklist

- [ ] Environment variables loaded correctly
- [ ] Clear chat actually deletes messages
- [ ] Token generation errors shown to user
- [ ] Transaction rollback works correctly
- [ ] WeChat Mini Program connects to Tinode
- [ ] Monitoring dashboards show correct data
- [ ] Alerts trigger correctly

## Deployment Plan

### Phase 1: Development Environment (Week 1)
1. Create `.env` files with test credentials
2. Implement P0 fixes
3. Run unit tests and integration tests
4. Manual testing on local environment

### Phase 2: Staging Environment (Week 2)
1. Deploy to staging server
2. Run E2E tests
3. Load testing (100 concurrent users)
4. Security audit (check for exposed secrets)

### Phase 3: Production Rollout (Week 3)
1. Deploy backend changes (zero downtime)
2. Deploy mobile app update (gradual rollout: 10% → 50% → 100%)
3. Deploy WeChat Mini Program update (submit for review)
4. Monitor metrics for 48 hours
5. Rollback plan ready if issues detected

### Rollback Strategy
- Keep previous Docker images for 7 days
- Database migrations are reversible
- Feature flags to disable Tinode if needed
- Fallback to old WebSocket system (last resort)

## Success Criteria

### Functional Requirements
- [ ] All P0 issues fixed and verified
- [ ] WeChat Mini Program can send/receive messages
- [ ] Clear chat history actually deletes messages
- [ ] Token generation errors surfaced to users
- [ ] User sync operations are transactional

### Non-Functional Requirements
- [ ] Test coverage ≥ 80%
- [ ] Message delivery latency < 500ms (p95)
- [ ] System uptime ≥ 99.9%
- [ ] Zero security vulnerabilities (npm audit, go list)
- [ ] All secrets stored in environment variables

### Documentation Requirements
- [ ] API documentation updated
- [ ] Deployment guide created
- [ ] Troubleshooting guide updated
- [ ] Monitoring runbook created
