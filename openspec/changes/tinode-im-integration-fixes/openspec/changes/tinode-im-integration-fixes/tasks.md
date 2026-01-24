# Tinode IM Integration Fixes - Task Breakdown

## Phase 1: Critical Fixes (P0) - Week 1

### Task 1.1: Environment Configuration Setup
**Priority**: P0
**Estimated Time**: 2 hours
**Dependencies**: None

**Subtasks**:
1. Create `server/.env` file with Tinode configuration
   ```bash
   TINODE_UID_ENCRYPTION_KEY=your_uid_encryption_key_here
   TINODE_AUTH_TOKEN_KEY=your_auth_token_key_here
   TINODE_GRPC_LISTEN=:16060
   ```

2. Update `server/internal/tinode/auth_adapter.go`:
   - Add validation: fail fast if env vars missing
   - Add startup check in `main.go`
   ```go
   func ValidateConfig() error {
       required := []string{"TINODE_UID_ENCRYPTION_KEY", "TINODE_AUTH_TOKEN_KEY"}
       for _, key := range required {
           if os.Getenv(key) == "" {
               return fmt.Errorf("%s is required", key)
           }
       }
       return nil
   }
   ```

3. Create `mobile/.env` file:
   ```bash
   TINODE_API_KEY=AQEAAAABAAD_rAp4DJh05a1HAwFT3A6K
   TINODE_SERVER_URL=http://localhost:6060
   ```

4. Update `mobile/src/services/TinodeService.ts`:
   - Remove hardcoded API key
   - Load from environment: `process.env.TINODE_API_KEY`

5. Add `.env` to `.gitignore` (if not already present)

6. Create `.env.example` files with placeholder values

**Acceptance Criteria**:
- [ ] Backend fails to start if Tinode env vars missing
- [ ] Mobile app loads API key from environment
- [ ] No hardcoded secrets in codebase
- [ ] `.env` files not committed to git

---

### Task 1.2: Implement ClearChatHistory Functionality
**Priority**: P0
**Estimated Time**: 8 hours
**Dependencies**: Task 1.1

**Subtasks**:
1. Create `server/internal/tinode/grpc_client.go`:
   ```go
   package tinode

   import (
       "context"
       "google.golang.org/grpc"
       pb "github.com/tinode/chat/pbx"
   )

   type GRPCClient struct {
       conn   *grpc.ClientConn
       client pb.NodeClient
   }

   func NewGRPCClient(addr string) (*GRPCClient, error) {
       conn, err := grpc.Dial(addr, grpc.WithInsecure())
       if err != nil {
           return nil, err
       }
       return &GRPCClient{
           conn:   conn,
           client: pb.NewNodeClient(conn),
       }, nil
   }

   func (c *GRPCClient) DeleteMessages(ctx context.Context, topic string, userID uint64) error {
       // Implement {del} message with hard delete flag
       // Reference: https://github.com/tinode/chat/blob/master/docs/API.md#del
   }
   ```

2. Update `server/internal/handler/tinode_handler.go`:
   ```go
   func ClearChatHistory(c *gin.Context) {
       userId := c.GetUint64("userId")
       topic := c.Param("topic")

       // Validate topic format
       if !isValidTopic(topic) {
           response.Error(c, 400, "Invalid topic format")
           return
       }

       // Call gRPC client to delete messages
       grpcClient := tinode.GetGRPCClient()
       ctx, cancel := context.WithTimeout(c.Request.Context(), 10*time.Second)
       defer cancel()

       if err := grpcClient.DeleteMessages(ctx, topic, userId); err != nil {
           log.Printf("[ClearChat] Failed: user=%d topic=%s err=%v", userId, topic, err)
           response.Error(c, 500, "Failed to clear chat history")
           return
       }

       log.Printf("[ClearChat] Success: user=%d topic=%s", userId, topic)
       response.SuccessWithMessage(c, "聊天记录已清空", nil)
   }
   ```

3. Add gRPC dependency to `server/go.mod`:
   ```bash
   go get google.golang.org/grpc
   go get github.com/tinode/chat/pbx
   ```

4. Initialize gRPC client in `server/cmd/api/main.go`:
   ```go
   grpcClient, err := tinode.NewGRPCClient("localhost:16060")
   if err != nil {
       log.Fatalf("Failed to connect to Tinode gRPC: %v", err)
   }
   defer grpcClient.Close()
   ```

5. Add error handling and retry logic:
   - Circuit breaker pattern (fail fast after 3 failures)
   - Exponential backoff (1s, 2s, 4s, 8s)

**Acceptance Criteria**:
- [ ] DELETE /api/v1/tinode/topic/:topic/messages actually deletes messages
- [ ] Verify deletion in Tinode database (messages table)
- [ ] Returns 503 if Tinode server unavailable
- [ ] Returns 404 if topic not found
- [ ] Returns 403 if user not authorized
- [ ] All operations logged for audit

**Testing**:
```bash
# Manual test
curl -X DELETE http://localhost:8080/api/v1/tinode/topic/usr1_usr2/messages \
  -H "Authorization: Bearer <token>"

# Verify in Tinode DB
docker-compose exec -T db psql -U postgres -d tinode \
  -c "SELECT COUNT(*) FROM messages WHERE topic='usr1_usr2';"
```

---

### Task 1.3: Add Transaction Support to User Sync
**Priority**: P0
**Estimated Time**: 6 hours
**Dependencies**: None

**Subtasks**:
1. Update `server/internal/tinode/auth_adapter.go`:
   ```go
   func SyncUserToTinodeWithTx(tinodeDB *gorm.DB, user *model.User) error {
       tx := tinodeDB.Begin()
       defer tx.Rollback()

       publicData := map[string]interface{}{
           "fn":    user.Nickname,
           "photo": image.GetFullImageURL(user.Avatar),
       }
       publicJSON, err := json.Marshal(publicData)
       if err != nil {
           return fmt.Errorf("marshal public json: %w", err)
       }

       accessJSON := []byte(`{"Auth":"JRWPAS","Anon":"N"}`)

       query := `
           INSERT INTO users (id, createdat, updatedat, state, access, public)
           VALUES ($1, NOW(), NOW(), 0, $2, $3)
           ON CONFLICT (id) DO UPDATE SET
               updatedat = NOW(),
               access = $2,
               public = $3
       `

       if err := tx.Exec(query, user.ID, accessJSON, publicJSON).Error; err != nil {
           return fmt.Errorf("upsert users failed: %w", err)
       }

       return tx.Commit().Error
   }
   ```

2. Update `server/internal/service/user_service.go`:
   ```go
   func (s *UserService) Register(req RegisterRequest) (*User, error) {
       mainTx := s.db.Begin()
       defer mainTx.Rollback()

       // 1. Create user in main DB
       user := &model.User{
           Phone:    req.Phone,
           Nickname: req.Nickname,
           Password: hashedPassword,
       }
       if err := mainTx.Create(user).Error; err != nil {
           return nil, fmt.Errorf("create user failed: %w", err)
       }

       // 2. Sync to Tinode (with transaction)
       if err := tinode.SyncUserToTinodeWithTx(s.tinodeDB, user); err != nil {
           return nil, fmt.Errorf("tinode sync failed: %w", err)
       }

       // 3. Commit main DB transaction
       if err := mainTx.Commit().Error; err != nil {
           return nil, fmt.Errorf("commit failed: %w", err)
       }

       return user, nil
   }
   ```

3. Add similar transaction support to `Login` function

4. Add transaction timeout (5 seconds):
   ```go
   ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
   defer cancel()
   mainTx := s.db.WithContext(ctx).Begin()
   ```

5. Add deadlock detection and logging:
   ```go
   if err := mainTx.Commit().Error; err != nil {
       if strings.Contains(err.Error(), "deadlock") {
           log.Printf("[Deadlock] User registration: userID=%d", user.ID)
       }
       return nil, err
   }
   ```

**Acceptance Criteria**:
- [ ] User creation and Tinode sync are atomic
- [ ] If Tinode sync fails, user is not created in main DB
- [ ] If main DB commit fails, Tinode record is not created
- [ ] Transaction timeout prevents hanging requests
- [ ] Deadlocks are logged for investigation

**Testing**:
```go
// Test case: Tinode sync failure should rollback user creation
func TestRegister_TinodeSyncFailure_RollsBack(t *testing.T) {
    // Mock Tinode DB to return error
    // Attempt registration
    // Verify user not created in main DB
}
```

---

### Task 1.4: Improve Token Generation Error Handling
**Priority**: P0
**Estimated Time**: 4 hours
**Dependencies**: None

**Subtasks**:
1. Update `server/internal/service/user_service.go`:
   ```go
   type TokenResponse struct {
       Token        string `json:"token"`
       RefreshToken string `json:"refreshToken"`
       ExpiresIn    int64  `json:"expiresIn"`
       TinodeToken  string `json:"tinodeToken"`
       TinodeError  string `json:"tinodeError,omitempty"`
   }

   func (s *UserService) Login(req LoginRequest) (*TokenResponse, *model.User, error) {
       // ... existing login logic ...

       // Generate Tinode token
       tinodeToken, err := tinode.GenerateTinodeToken(user.ID, user.Nickname)
       tinodeError := ""
       if err != nil {
           log.Printf("[Tinode] Token generation failed (login): userID=%d, err=%v", user.ID, err)
           tinodeError = fmt.Sprintf("Tinode token generation failed: %v", err)
       }

       return &TokenResponse{
           Token:        token,
           RefreshToken: refreshToken,
           ExpiresIn:    int64(cfg.ExpireHour * 3600),
           TinodeToken:  tinodeToken,
           TinodeError:  tinodeError,
       }, &user, nil
   }
   ```

2. Update mobile app to handle token errors:
   ```typescript
   // mobile/src/services/api.ts
   interface LoginResponse {
       token: string;
       refreshToken: string;
       tinodeToken: string;
       tinodeError?: string;
   }

   async function login(phone: string, code: string): Promise<LoginResponse> {
       const response = await api.post('/auth/login', { phone, code });

       if (response.tinodeError) {
           console.warn('[Tinode] Token generation failed:', response.tinodeError);
           // Show warning to user
           Alert.alert('提示', '聊天功能暂时不可用，请稍后重试');
       }

       return response;
   }
   ```

3. Add retry mechanism in mobile app:
   ```typescript
   // Retry token generation on next app launch
   useEffect(() => {
       const checkTinodeToken = async () => {
           const token = await SecureStorage.getTinodeToken();
           if (!token) {
               // Retry token generation
               await refreshTinodeToken();
           }
       };
       checkTinodeToken();
   }, []);
   ```

**Acceptance Criteria**:
- [ ] Login succeeds even if Tinode token generation fails
- [ ] Error message returned in response (not just logged)
- [ ] Mobile app shows warning if Tinode unavailable
- [ ] User can retry token generation later
- [ ] Other app features work without Tinode token

---

### Task 1.5: Add Unit Tests for P0 Fixes
**Priority**: P0
**Estimated Time**: 8 hours
**Dependencies**: Tasks 1.1-1.4

**Subtasks**:
1. Create `server/internal/tinode/grpc_client_test.go`:
   ```go
   func TestDeleteMessages_Success(t *testing.T) { ... }
   func TestDeleteMessages_ServerUnavailable(t *testing.T) { ... }
   func TestDeleteMessages_InvalidTopic(t *testing.T) { ... }
   ```

2. Create `server/internal/tinode/auth_adapter_test.go`:
   ```go
   func TestSyncUserToTinodeWithTx_Success(t *testing.T) { ... }
   func TestSyncUserToTinodeWithTx_Rollback(t *testing.T) { ... }
   ```

3. Update `server/internal/service/user_service_test.go`:
   ```go
   func TestRegister_TinodeSyncFailure_RollsBack(t *testing.T) { ... }
   func TestLogin_TinodeTokenFailure_ReturnsError(t *testing.T) { ... }
   ```

4. Run tests and verify coverage:
   ```bash
   go test ./... -coverprofile=coverage.out
   go tool cover -html=coverage.out
   # Target: 80%+ coverage
   ```

**Acceptance Criteria**:
- [ ] All P0 code paths have unit tests
- [ ] Test coverage ≥ 80%
- [ ] All tests pass
- [ ] Edge cases covered (timeouts, errors, rollbacks)

---

## Phase 2: WeChat Mini Program Integration (P1) - Week 2-3

### Task 2.1: Create Taro WebSocket Adapter
**Priority**: P1
**Estimated Time**: 6 hours
**Dependencies**: Phase 1 complete

**Subtasks**:
1. Create `mini/src/services/TaroWebSocketAdapter.ts`:
   ```typescript
   import Taro from '@tarojs/taro';

   export class TaroWebSocketAdapter {
       private socket: Taro.SocketTask | null = null;
       private messageHandlers: ((data: any) => void)[] = [];

       connect(url: string, protocols?: string[]): void {
           this.socket = Taro.connectSocket({
               url,
               protocols,
           });

           this.socket.onOpen(() => {
               console.log('[Tinode] WebSocket connected');
           });

           this.socket.onMessage((res) => {
               const data = JSON.parse(res.data as string);
               this.messageHandlers.forEach(handler => handler(data));
           });

           this.socket.onError((err) => {
               console.error('[Tinode] WebSocket error:', err);
           });

           this.socket.onClose(() => {
               console.log('[Tinode] WebSocket closed');
               // Auto-reconnect after 3 seconds
               setTimeout(() => this.connect(url, protocols), 3000);
           });
       }

       send(data: any): void {
           if (this.socket) {
               this.socket.send({ data: JSON.stringify(data) });
           }
       }

       onMessage(handler: (data: any) => void): void {
           this.messageHandlers.push(handler);
       }

       close(): void {
           if (this.socket) {
               this.socket.close({});
               this.socket = null;
           }
       }
   }
   ```

2. Add lifecycle handling:
   ```typescript
   // mini/src/app.tsx
   import { useEffect } from 'react';
   import TinodeService from './services/TinodeService';

   function App() {
       useEffect(() => {
           // Connect on app launch
           Taro.onAppShow(() => {
               TinodeService.reconnect();
           });

           // Disconnect on app hide
           Taro.onAppHide(() => {
               TinodeService.disconnect();
           });
       }, []);

       return <>{props.children}</>;
   }
   ```

**Acceptance Criteria**:
- [ ] WebSocket connects successfully
- [ ] Messages sent and received
- [ ] Auto-reconnect on disconnect
- [ ] Lifecycle events handled correctly

---

### Task 2.2: Create TinodeService for Mini Program
**Priority**: P1
**Estimated Time**: 12 hours
**Dependencies**: Task 2.1

**Subtasks**:
1. Create `mini/src/services/TinodeService.ts` (mirror mobile structure):
   ```typescript
   import Tinode from 'tinode-sdk';
   import { TaroWebSocketAdapter } from './TaroWebSocketAdapter';
   import { useAuthStore } from '@/store/authStore';

   class TinodeService {
       private tinode: Tinode;
       private wsAdapter: TaroWebSocketAdapter;

       constructor() {
           this.wsAdapter = new TaroWebSocketAdapter();
           this.tinode = new Tinode({
               appName: 'HomeDecoration',
               host: process.env.TARO_APP_TINODE_URL,
               apiKey: process.env.TARO_APP_TINODE_API_KEY,
               transport: this.wsAdapter,
           });
       }

       async init(token: string): Promise<boolean> {
           try {
               await this.tinode.connect();
               await this.tinode.loginToken(token);
               return true;
           } catch (error) {
               console.error('[Tinode] Init failed:', error);
               Taro.showToast({
                   title: '聊天服务连接失败',
                   icon: 'none',
               });
               return false;
           }
       }

       async sendTextMessage(topicName: string, text: string): Promise<void> {
           const topic = this.tinode.getTopic(topicName);
           await topic.publishMessage({ txt: text });
       }

       // ... other methods similar to mobile
   }

   export default new TinodeService();
   ```

2. Add environment variables to `mini/.env`:
   ```bash
   TARO_APP_TINODE_URL=ws://localhost:6060/v0/channels
   TARO_APP_TINODE_API_KEY=AQEAAAABAAD_rAp4DJh05a1HAwFT3A6K
   ```

3. Update `mini/src/app.config.ts` to include message page:
   ```typescript
   export default defineAppConfig({
       pages: [
           'pages/home/index',
           'pages/message/index',  // Add this
           // ... other pages
       ],
   });
   ```

**Acceptance Criteria**:
- [ ] TinodeService initializes successfully
- [ ] Can send text messages
- [ ] Can receive messages
- [ ] Error handling works correctly

---

### Task 2.3: Implement Message Page for Mini Program
**Priority**: P1
**Estimated Time**: 10 hours
**Dependencies**: Task 2.2

**Subtasks**:
1. Create `mini/src/pages/message/index.tsx`:
   ```typescript
   import { View, ScrollView, Input, Button } from '@tarojs/components';
   import { useState, useEffect } from 'react';
   import TinodeService from '@/services/TinodeService';
   import { useAuthStore } from '@/store/authStore';

   export default function MessagePage() {
       const [conversations, setConversations] = useState([]);
       const { tinodeToken } = useAuthStore();

       useEffect(() => {
           const loadConversations = async () => {
               if (!TinodeService.isConnected()) {
                   await TinodeService.init(tinodeToken);
               }
               const convs = await TinodeService.getConversationList();
               setConversations(convs);
           };
           loadConversations();
       }, [tinodeToken]);

       return (
           <View className="message-page">
               <ScrollView>
                   {conversations.map(conv => (
                       <View key={conv.topic} onClick={() => navigateToChat(conv.topic)}>
                           <Text>{conv.public.fn}</Text>
                           <Text>{conv.lastMessage}</Text>
                       </View>
                   ))}
               </ScrollView>
           </View>
       );
   }
   ```

2. Create `mini/src/pages/chat/index.tsx` (chat room):
   ```typescript
   // Similar to mobile ChatRoomScreen
   ```

3. Add styling with Taro UI components

**Acceptance Criteria**:
- [ ] Conversation list displays correctly
- [ ] Can navigate to chat room
- [ ] Can send and receive messages
- [ ] UI matches design specifications

---

### Task 2.4: E2E Testing for Mini Program
**Priority**: P1
**Estimated Time**: 8 hours
**Dependencies**: Task 2.3

**Subtasks**:
1. Set up WeChat DevTools automation
2. Create test scenarios:
   - Login → View conversations → Send message
   - Receive message from mobile app
   - Clear chat history
3. Run tests on multiple WeChat versions

**Acceptance Criteria**:
- [ ] All E2E tests pass
- [ ] Tests run on CI/CD pipeline
- [ ] Test coverage ≥ 70%

---

## Phase 3: Testing & Monitoring (P1) - Week 4

### Task 3.1: Set Up Prometheus Metrics
**Priority**: P1
**Estimated Time**: 6 hours
**Dependencies**: Phase 1 complete

**Subtasks**:
1. Add Prometheus client to `server/go.mod`:
   ```bash
   go get github.com/prometheus/client_golang/prometheus
   go get github.com/prometheus/client_golang/prometheus/promhttp
   ```

2. Create `server/internal/metrics/metrics.go`:
   ```go
   package metrics

   import (
       "github.com/prometheus/client_golang/prometheus"
       "github.com/prometheus/client_golang/prometheus/promauto"
   )

   var (
       TinodeTokenGenerationTotal = promauto.NewCounterVec(
           prometheus.CounterOpts{
               Name: "tinode_token_generation_total",
               Help: "Total number of Tinode token generation attempts",
           },
           []string{"status"}, // success, failure
       )

       TinodeMessageSendDuration = promauto.NewHistogramVec(
           prometheus.HistogramOpts{
               Name:    "tinode_message_send_duration_seconds",
               Help:    "Duration of Tinode message send operations",
               Buckets: prometheus.DefBuckets,
           },
           []string{"status"},
       )

       TinodeUserSyncTotal = promauto.NewCounterVec(
           prometheus.CounterOpts{
               Name: "tinode_user_sync_total",
               Help: "Total number of user sync operations",
           },
           []string{"status"},
       )
   )
   ```

3. Instrument code with metrics:
   ```go
   // In user_service.go
   tinodeToken, err := tinode.GenerateTinodeToken(user.ID, user.Nickname)
   if err != nil {
       metrics.TinodeTokenGenerationTotal.WithLabelValues("failure").Inc()
   } else {
       metrics.TinodeTokenGenerationTotal.WithLabelValues("success").Inc()
   }
   ```

4. Expose metrics endpoint:
   ```go
   // In main.go
   import "github.com/prometheus/client_golang/prometheus/promhttp"

   router.GET("/metrics", gin.WrapH(promhttp.Handler()))
   ```

**Acceptance Criteria**:
- [ ] Metrics endpoint accessible at /metrics
- [ ] All key operations instrumented
- [ ] Metrics follow Prometheus naming conventions

---

### Task 3.2: Configure Grafana Dashboards
**Priority**: P1
**Estimated Time**: 4 hours
**Dependencies**: Task 3.1

**Subtasks**:
1. Create `deploy/grafana/dashboards/tinode.json`:
   - Tinode server health panel
   - Message send/receive rate
   - Token generation success rate
   - User sync success rate
   - gRPC call latency

2. Add Prometheus data source to Grafana

3. Import dashboard

**Acceptance Criteria**:
- [ ] Dashboard displays all metrics
- [ ] Panels update in real-time
- [ ] Dashboard accessible to team

---

### Task 3.3: Set Up Alerting Rules
**Priority**: P1
**Estimated Time**: 4 hours
**Dependencies**: Task 3.1

**Subtasks**:
1. Create `deploy/prometheus/alerts/tinode.yml`:
   ```yaml
   groups:
     - name: tinode
       rules:
         - alert: TinodeServerDown
           expr: up{job="tinode"} == 0
           for: 1m
           labels:
             severity: critical
           annotations:
             summary: "Tinode server is down"

         - alert: TinodeTokenGenerationFailureHigh
           expr: rate(tinode_token_generation_total{status="failure"}[5m]) > 0.05
           for: 5m
           labels:
             severity: warning
           annotations:
             summary: "Tinode token generation failure rate > 5%"

         - alert: TinodeMessageSendLatencyHigh
           expr: histogram_quantile(0.95, rate(tinode_message_send_duration_seconds_bucket[5m])) > 1
           for: 5m
           labels:
             severity: warning
           annotations:
             summary: "Tinode message send latency > 1s (p95)"
   ```

2. Configure alert notification channels (Slack, email)

3. Test alerts by simulating failures

**Acceptance Criteria**:
- [ ] Alerts trigger correctly
- [ ] Notifications sent to team
- [ ] Alert runbook documented

---

### Task 3.4: Integration Testing
**Priority**: P1
**Estimated Time**: 8 hours
**Dependencies**: Phase 1 complete

**Subtasks**:
1. Create `server/tests/integration/tinode_test.go`:
   ```go
   func TestUserRegistration_TinodeSync_EndToEnd(t *testing.T) {
       // 1. Register user
       // 2. Verify user in main DB
       // 3. Verify user in Tinode DB
       // 4. Verify token generation
   }

   func TestClearChatHistory_EndToEnd(t *testing.T) {
       // 1. Send messages
       // 2. Clear chat history
       // 3. Verify messages deleted in Tinode DB
   }
   ```

2. Set up test database (Docker Compose)

3. Run integration tests in CI/CD

**Acceptance Criteria**:
- [ ] All integration tests pass
- [ ] Tests run on every commit
- [ ] Test coverage ≥ 80%

---

## Phase 4: Documentation & Deployment (P2) - Week 5

### Task 4.1: Update API Documentation
**Priority**: P2
**Estimated Time**: 4 hours
**Dependencies**: Phase 1 complete

**Subtasks**:
1. Update `docs/API.md` with new response format:
   ```markdown
   ### POST /api/v1/auth/login

   **Response**:
   ```json
   {
       "code": 0,
       "message": "登录成功",
       "data": {
           "token": "eyJhbGc...",
           "refreshToken": "eyJhbGc...",
           "tinodeToken": "base64_encoded_token",
           "tinodeError": "Tinode token generation failed: ..."
       }
   }
   ```
   ```

2. Document ClearChatHistory endpoint behavior change

3. Add troubleshooting section

**Acceptance Criteria**:
- [ ] All API changes documented
- [ ] Examples provided
- [ ] Troubleshooting guide complete

---

### Task 4.2: Create Deployment Guide
**Priority**: P2
**Estimated Time**: 4 hours
**Dependencies**: Phase 1 complete

**Subtasks**:
1. Create `docs/TINODE_DEPLOYMENT.md`:
   - Environment setup
   - Configuration checklist
   - Deployment steps
   - Rollback procedure
   - Monitoring setup

2. Create deployment scripts:
   ```bash
   # deploy/scripts/deploy-tinode.sh
   #!/bin/bash
   set -e

   echo "Deploying Tinode IM integration fixes..."

   # 1. Backup database
   # 2. Deploy backend
   # 3. Run migrations
   # 4. Deploy frontend
   # 5. Verify deployment
   # 6. Monitor for 10 minutes
   ```

**Acceptance Criteria**:
- [ ] Deployment guide complete
- [ ] Scripts tested on staging
- [ ] Rollback procedure documented

---

### Task 4.3: Production Deployment
**Priority**: P2
**Estimated Time**: 8 hours
**Dependencies**: All previous tasks

**Subtasks**:
1. Deploy to staging environment
2. Run smoke tests
3. Load testing (100 concurrent users)
4. Security audit
5. Deploy to production (gradual rollout)
6. Monitor for 48 hours

**Acceptance Criteria**:
- [ ] Zero downtime deployment
- [ ] All smoke tests pass
- [ ] No critical errors in logs
- [ ] Metrics within expected ranges

---

## Summary

**Total Estimated Time**: 5 weeks (120 hours)

**Phase Breakdown**:
- Phase 1 (P0): 30 hours (Week 1)
- Phase 2 (P1): 36 hours (Week 2-3)
- Phase 3 (P1): 30 hours (Week 4)
- Phase 4 (P2): 24 hours (Week 5)

**Critical Path**:
1. Environment configuration (Task 1.1)
2. ClearChatHistory implementation (Task 1.2)
3. Transaction support (Task 1.3)
4. Token error handling (Task 1.4)
5. Unit tests (Task 1.5)
6. WeChat Mini Program integration (Tasks 2.1-2.3)
7. Monitoring setup (Tasks 3.1-3.3)
8. Production deployment (Task 4.3)

**Risk Mitigation**:
- Buffer time: Add 20% to each estimate
- Parallel work: Tasks 1.1-1.4 can be done in parallel
- Early testing: Run integration tests after each phase
- Incremental deployment: Deploy P0 fixes first, then P1 features

**Success Metrics**:
- All P0 issues fixed ✓
- WeChat Mini Program functional ✓
- Test coverage ≥ 80% ✓
- Zero production incidents ✓
- Message delivery latency < 500ms ✓
