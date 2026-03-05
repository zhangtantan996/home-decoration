# Mobile App E2E Test Execution Guide

> **Created**: 2026-01-23  
> **Purpose**: Manual testing guide for Tinode IM integration in React Native mobile app  
> **Prerequisites**: Task 1 (Environment Verification) completed successfully

---

## Prerequisites

### Environment Setup
- ✅ Tinode server running (verified in Task 1)
- ✅ Backend API operational (verified in Task 1)
- ✅ Database connected (verified in Task 1)
- ✅ iOS Simulator or Android Emulator available
- ✅ Metro bundler ready to start

### Test Accounts
- **Account A**: phone=`13800138000`, code=`123456`
- **Account B**: phone=`13800138001`, code=`123456`

### Starting the App
```bash
# Terminal 1: Start Metro bundler
cd mobile
npm start

# Terminal 2: Launch simulator
npm run ios     # For iOS
# OR
npm run android # For Android
```

---

## Test Scenarios

### Scenario 2.1: Login and Connection

**Objective**: Verify Tinode initialization and WebSocket connection

**Steps**:
1. Open App in simulator
2. Navigate to login screen (if not already there)
3. Enter phone: `13800138000`
4. Enter verification code: `123456`
5. Tap "Login" button
6. **Observe console logs** in Metro bundler terminal

**Expected Console Logs**:
```
[Tinode] 初始化中...
[Tinode] WebSocket 已连接
[Tinode] 登录成功: {ctrl: {...}}
[Tinode] 初始化成功
```

**Expected UI Behavior**:
- Login screen disappears
- App navigates to home/message screen
- No error toasts or alerts

**Verification Checklist**:
- [ ] Login succeeds without errors
- [ ] Console shows all 4 expected log messages
- [ ] TinodeService initializes successfully
- [ ] No error logs in console
- [ ] App navigates to main screen

**Code Reference**: 
- `mobile/src/services/TinodeService.ts:91-186` (init method)
- `mobile/src/screens/LoginScreen.tsx` (login flow)

**Troubleshooting**:
- **If "WebSocket 已连接" doesn't appear**: Check Tinode container status with `docker ps | grep tinode`
- **If "登录成功" fails**: Verify tinodeToken is present in login API response
- **If connection timeout**: Check `TINODE_SERVER_URL` in `mobile/.env` (optional override) and `mobile/src/config/tinode.ts` / `mobile/src/services/TinodeService.ts` host selection

---

### Scenario 2.2: View Conversation List

**Objective**: Verify conversation list loading and display

**Steps**:
1. After successful login (Scenario 2.1)
2. Navigate to "消息" (Messages) tab
3. Wait for conversation list to load
4. **Observe the UI**

**Expected UI Elements**:
- Connection status indicator (top-right): Green Wifi icon = connected
- Conversation cards showing:
  - Avatar image (circular, 48x48)
  - Name (bold, 15px)
  - Role badge (e.g., "服务商")
  - Last message preview
  - Timestamp (formatted: "HH:MM", "昨天", "周X", or "M/D")
  - Unread count badge (if > 0)
- Conversations sorted by most recent first

**Expected Console Logs**:
```
[Tinode] 会话列表: <number>
```

**Verification Checklist**:
- [ ] Conversation list loads successfully
- [ ] Each conversation displays complete information
- [ ] Avatars render correctly
- [ ] Last message preview shows correctly
- [ ] Timestamps are formatted properly
- [ ] Unread counts display correctly
- [ ] Connection status shows green Wifi icon

**Code Reference**:
- `mobile/src/services/TinodeService.ts:248-275` (getConversationList)
- `mobile/src/screens/MessageScreen.tsx:127-253` (loadConversations)

**Troubleshooting**:
- **If list is empty**: Check database for existing conversations with `psql` queries
- **If "IM 未登录" appears**: Tinode connection failed, check logs
- **If avatars don't load**: Check network connectivity and image URLs

---

### Scenario 2.3: Send Text Message

**Objective**: Verify text message sending with status updates

**Steps**:
1. From conversation list (Scenario 2.2)
2. Tap on any conversation to enter chat room
3. Wait for message history to load
4. Type text in input field: "测试消息1"
5. Tap send button (paper plane icon)
6. **Observe message appearance and status**

**Expected UI Behavior**:
1. Message appears immediately in chat (optimistic UI)
2. Message shows on right side (isMe=true)
3. Message has timestamp
4. Message status changes: pending → sent (via seq number assignment)
5. Input field clears after sending

**Expected Console Logs**:
```
[Tinode] 消息已发送: 测试消息1
```

**Verification Checklist**:
- [ ] Message sends successfully
- [ ] Message appears in UI immediately
- [ ] Message displays on right side (sender)
- [ ] Timestamp shows correctly
- [ ] Status changes from pending to sent
- [ ] Input field clears
- [ ] No error logs

**Code Reference**:
- `mobile/src/services/TinodeService.ts:404-415` (sendTextMessage)
- `mobile/src/screens/ChatRoomScreen.tsx` (send message handler)

**Troubleshooting**:
- **If message doesn't send**: Check topic subscription status
- **If message appears but no seq**: Check Tinode server logs
- **If "Tinode not initialized" error**: Reconnect or restart app

---

### Scenario 2.4: Receive Messages (Real-time)

**Objective**: Verify real-time message reception

**Prerequisites**:
- Two devices/simulators OR one simulator + web admin panel
- Account A logged in on Device 1
- Account B logged in on Device 2

**Steps**:
1. Device 1: Account A stays in chat room with Account B
2. Device 2: Account B sends message: "你好，收到了吗？"
3. **Observe Device 1** for real-time message arrival

**Expected Behavior on Device 1**:
- Message appears within 2 seconds
- Message displays on left side (isMe=false)
- Sender name/avatar shows correctly
- Message content is complete and correct
- Unread count updates (if not in chat room)
- Timestamp is accurate

**Expected Console Logs (Device 1)**:
```
[Tinode] 📩 收到消息: {data: {...}}
```

**Verification Checklist**:
- [ ] Message received in real-time (<2 seconds)
- [ ] Message content is complete and correct
- [ ] Sender information displays correctly
- [ ] Message appears on left side (receiver)
- [ ] Timestamp is accurate
- [ ] Unread count updates correctly

**Code Reference**:
- `mobile/src/services/TinodeService.ts:220-223` (onMessage callback)
- `mobile/src/screens/ChatRoomScreen.tsx` (topic.onData listener)

**Troubleshooting**:
- **If delay > 2 seconds**: Check network latency, Tinode server load
- **If message doesn't arrive**: Check WebSocket connection status
- **If message duplicates**: Check topic subscription logic

---

### Scenario 2.5: Read Receipts

**Objective**: Verify read status synchronization

**Prerequisites**:
- Two devices with Account A and Account B
- Account B has sent unread messages to Account A

**Steps**:
1. Device 1: Account A opens conversation with Account B
2. Device 1: Scroll to view all unread messages
3. **Observe unread count** on Device 1
4. Device 2: **Observe message status** on Account B's side

**Expected Behavior**:
- Device 1: Unread count badge disappears or shows 0
- Device 2: Message status changes to "已读" (read)
- Status update happens within 2 seconds

**Expected Console Logs (Device 1)**:
```
[Tinode] 标记已读: <seqId>
```

**Verification Checklist**:
- [ ] Unread count clears on Device 1
- [ ] Read status syncs to Device 2
- [ ] Status update is real-time (<2 seconds)
- [ ] No errors in console

**Code Reference**:
- `mobile/src/services/TinodeService.ts:472-479` (markAsRead)
- `mobile/src/screens/ChatRoomScreen.tsx` (read receipt logic)

**Troubleshooting**:
- **If unread count doesn't clear**: Check markAsRead call timing
- **If status doesn't sync**: Check WebSocket connection on both devices

---

### Scenario 2.6: Offline Messages

**Objective**: Verify offline message delivery and sync

**Steps**:
1. Device 1: Account A is online in app
2. Device 1: **Close the app completely** (swipe away from app switcher)
3. Device 2: Account B sends 3 messages to Account A:
   - "离线消息1"
   - "离线消息2"
   - "离线消息3"
4. Wait 5 seconds
5. Device 1: **Reopen the app** (Account A)
6. Navigate to conversation with Account B
7. **Observe message delivery**

**Expected Behavior**:
- All 3 offline messages appear after app reopens
- Messages are in correct chronological order
- Unread count shows 3 (or total unread)
- Messages load automatically on conversation open
- No message loss

**Expected Console Logs (Device 1)**:
```
[Tinode] 初始化中...
[Tinode] WebSocket 已连接
[Tinode] 登录成功
[Tinode] 订阅会话: usr...
```

**Verification Checklist**:
- [ ] All offline messages delivered
- [ ] Messages appear in correct order
- [ ] Unread count is accurate
- [ ] No message duplication
- [ ] Automatic sync on reconnection

**Code Reference**:
- `mobile/src/services/TinodeService.ts:322-382` (subscribeToConversation)
- Tinode SDK handles offline queue automatically

**Troubleshooting**:
- **If messages missing**: Check Tinode server message retention
- **If order is wrong**: Check seq number sorting logic
- **If duplicates appear**: Check message deduplication logic

---

### Scenario 2.7: Disconnect and Reconnect

**Objective**: Verify automatic reconnection handling

**Steps**:
1. Device 1: Account A is online and connected
2. **Simulate network disconnection**:
   - iOS Simulator: Toggle Airplane Mode in Settings
   - Android Emulator: Disable WiFi/Mobile data
   - OR: Stop Tinode container: `docker stop decorating_tinode`
3. Wait 3 seconds
4. **Observe console logs and UI**
5. **Restore network connection**:
   - Re-enable WiFi/Mobile data
   - OR: Restart Tinode: `docker start decorating_tinode`
6. Wait for auto-reconnect
7. **Observe reconnection behavior**

**Expected Console Logs**:
```
[Tinode] ❌ 已断开: <error>
[Tinode] 🔄 尝试重连...
[Tinode] 初始化中...
[Tinode] WebSocket 已连接
[Tinode] 登录成功
[Tinode] ✅ 已连接
```

**Expected UI Behavior**:
- Connection status indicator changes to red WifiOff icon
- After reconnect: indicator changes back to green Wifi icon
- Messages sync automatically after reconnection
- No data loss

**Verification Checklist**:
- [ ] Disconnect detected within 3 seconds
- [ ] Console shows "❌ 已断开"
- [ ] Auto-reconnect attempts after 3s
- [ ] Reconnection succeeds
- [ ] Console shows "✅ 已连接"
- [ ] Messages sync after reconnect
- [ ] UI status indicator updates correctly

**Code Reference**:
- `mobile/src/services/TinodeService.ts:206-215` (onDisconnect)
- `mobile/src/services/TinodeService.ts:228-243` (reconnect)

**Troubleshooting**:
- **If reconnect fails repeatedly**: Check Tinode server availability
- **If reconnect doesn't trigger**: Check reconnectTimer logic
- **If messages don't sync**: Check topic subscription after reconnect

---

## Task 2 Summary Checklist

After completing all 7 scenarios, verify:

- [ ] All 7 scenarios tested successfully
- [ ] No blocking bugs discovered
- [ ] Performance meets requirements (message latency <2s)
- [ ] User experience is smooth and responsive
- [ ] All console logs match expected patterns
- [ ] Connection status indicator works correctly
- [ ] Real-time updates function properly

---

## Recording Test Results

### For Each Scenario
Document in `.sisyphus/notepads/tinode-im-completion-week1/verification.md`:

```markdown
### Scenario 2.X: [Name]
- **Status**: ✅ PASSED / ❌ FAILED
- **Tested On**: iOS Simulator 17.0 / Android Emulator API 33
- **Date**: 2026-01-23
- **Notes**: [Any observations, issues, or comments]
```

### For Issues Found
Document in `.sisyphus/notepads/tinode-im-completion-week1/issues.md`:

```markdown
## 问题X: [Brief Description]
- **Scenario**: 2.X
- **Severity**: P0 (Blocking) / P1 (Important) / P2 (Minor)
- **Description**: [Detailed description]
- **Steps to Reproduce**: [Steps]
- **Expected**: [Expected behavior]
- **Actual**: [Actual behavior]
- **Screenshots**: [If applicable]
```

---

## Next Steps

After completing Task 2 manual testing:
1. Mark checkboxes in plan file (`.sisyphus/plans/tinode-im-completion-week1.md`)
2. Document all findings in notepad
3. If P0 issues found: Proceed to Task 6 (Bug Fixes) before continuing
4. If no blocking issues: Proceed to Task 3 (Admin Panel E2E Testing)

---

**Test Guide Version**: 1.0  
**Last Updated**: 2026-01-23  
**Maintained By**: AI Assistant
