# Cross-Platform Message Sync Test Guide

> **Created**: 2026-01-23  
> **Purpose**: Verify real-time message synchronization between Mobile and Admin platforms  
> **Prerequisites**: Tasks 1, 2, and 3 completed successfully

---

## Prerequisites

### Environment Setup
- ✅ Task 1: Environment verified and operational
- ✅ Task 2: Mobile app code inspected (manual tests may be pending)
- ✅ Task 3: Admin panel code inspected (manual tests may be pending)
- ✅ Both Mobile and Admin running simultaneously

### Test Accounts
- **Mobile Account (Customer)**: phone=`13800138000`, code=`123456`
- **Admin Account (Merchant)**: phone=`13900139001`, code=`123456`

### Setup Instructions

**Terminal 1: Mobile App**
```bash
cd mobile
npm start
# In another terminal:
npm run ios  # or npm run android
```

**Terminal 2: Admin Panel**
```bash
cd admin
npm run dev
# Open browser: http://localhost:5173
```

**Ensure both are logged in and connected before starting tests.**

---

## Test Scenarios

### Scenario 4.1: Mobile → Admin Sync

**Objective**: Verify messages sent from Mobile appear in Admin in real-time

**Setup**:
1. Mobile: Customer account (13800138000) logged in
2. Admin: Merchant account (13900139001) logged in and viewing chat page
3. Both devices connected (check connection indicators)

**Steps**:
1. Mobile: Open conversation with merchant
2. Admin: Open same conversation (should show customer)
3. Mobile: Type message: "测试消息 - Mobile to Admin"
4. Mobile: Tap send button
5. **Start timer** (use phone stopwatch or computer timer)
6. Admin: **Observe message arrival**
7. **Stop timer** when message appears
8. **Record latency**

**Expected Behavior**:
- Message appears in Admin panel within 2 seconds
- Message displays on left side (customer/sender)
- Message content is identical: "测试消息 - Mobile to Admin"
- Timestamp is accurate
- No message duplication
- No errors in either console

**Verification Checklist**:
- [ ] Message syncs successfully
- [ ] Latency < 2 seconds (record actual: _____ ms)
- [ ] Message content identical
- [ ] Message appears on correct side (left in Admin)
- [ ] Timestamp accurate
- [ ] No duplication
- [ ] No errors

**Troubleshooting**:
- **If message doesn't appear**: Check WebSocket connection on both devices
- **If latency > 2s**: Check network conditions, Tinode server load
- **If message duplicates**: Check message deduplication logic

---

### Scenario 4.2: Admin → Mobile Sync

**Objective**: Verify messages sent from Admin appear in Mobile in real-time

**Setup**:
1. Admin: Merchant account logged in and viewing chat
2. Mobile: Customer account logged in and viewing same conversation
3. Both devices connected

**Steps**:
1. Admin: Type message in input field: "测试消息 - Admin to Mobile"
2. Admin: Click send button
3. **Start timer**
4. Mobile: **Observe message arrival**
5. **Stop timer** when message appears
6. **Record latency**

**Expected Behavior**:
- Message appears in Mobile app within 2 seconds
- Message displays on left side (merchant/sender)
- Message content is identical: "测试消息 - Admin to Mobile"
- Timestamp is accurate
- No message duplication
- No errors in either console

**Verification Checklist**:
- [ ] Message syncs successfully
- [ ] Latency < 2 seconds (record actual: _____ ms)
- [ ] Message content identical
- [ ] Message appears on correct side (left in Mobile)
- [ ] Timestamp accurate
- [ ] No duplication
- [ ] No errors

---

### Scenario 4.3: Rapid Multi-Message Sync

**Objective**: Verify message ordering and completeness under rapid sending

**Setup**:
1. Both Mobile and Admin logged in and viewing same conversation
2. Both devices connected

**Steps**:
1. Mobile: Rapidly send 5 messages in sequence (< 5 seconds total):
   - "消息1"
   - "消息2"
   - "消息3"
   - "消息4"
   - "消息5"
2. Admin: **Observe message arrival**
3. **Verify all messages appear**
4. **Verify message order**

**Expected Behavior**:
- All 5 messages arrive in Admin
- Messages appear in correct order (1, 2, 3, 4, 5)
- No messages lost
- No messages duplicated
- All messages arrive within 10 seconds total
- Order is preserved

**Verification Checklist**:
- [ ] All 5 messages received
- [ ] Messages in correct order (1→2→3→4→5)
- [ ] No message loss
- [ ] No duplication
- [ ] Total sync time < 10 seconds
- [ ] No errors

**Reverse Test**:
Repeat the same test but send from Admin → Mobile:
- [ ] All 5 messages received on Mobile
- [ ] Correct order maintained
- [ ] No loss or duplication

---

### Scenario 4.4: Bidirectional Conversation

**Objective**: Verify natural back-and-forth conversation flow

**Setup**:
1. Both Mobile and Admin logged in and viewing same conversation

**Steps**:
1. Mobile: Send "你好，我想咨询装修"
2. Wait for Admin to receive
3. Admin: Reply "您好，请问您的需求是什么？"
4. Wait for Mobile to receive
5. Mobile: Reply "我想了解全屋定制"
6. Wait for Admin to receive
7. Admin: Reply "好的，我们可以提供全屋定制服务"
8. Wait for Mobile to receive

**Expected Behavior**:
- Each message syncs within 2 seconds
- Conversation flow is natural and uninterrupted
- Messages appear in chronological order
- Both sides see complete conversation history
- No messages lost or duplicated

**Verification Checklist**:
- [ ] All 4 messages synced successfully
- [ ] Each message latency < 2 seconds
- [ ] Conversation order correct on both sides
- [ ] No message loss
- [ ] No duplication
- [ ] Natural conversation flow

---

### Scenario 4.5: Unread Count Sync

**Objective**: Verify unread count updates across platforms

**Setup**:
1. Mobile: Customer logged in but NOT viewing conversation
2. Admin: Merchant logged in and viewing conversation list

**Steps**:
1. Admin: Send 3 messages to customer
2. Mobile: **Do NOT open conversation yet**
3. Mobile: Observe conversation list
4. **Verify unread count** shows 3 (or increments by 3)
5. Mobile: Open conversation
6. Mobile: View all messages
7. Admin: **Observe conversation list**
8. **Verify unread count** clears or updates

**Expected Behavior**:
- Mobile conversation list shows unread count = 3
- After opening conversation, unread count clears
- Admin sees read status update (if implemented)
- Sync happens within 2 seconds

**Verification Checklist**:
- [ ] Unread count appears on Mobile (= 3)
- [ ] Unread count updates after viewing
- [ ] Read status syncs to Admin (if applicable)
- [ ] Sync latency < 2 seconds

---

## Task 4 Summary Checklist

After completing all 5 scenarios, verify:

- [ ] Bidirectional sync working (Mobile ↔ Admin)
- [ ] Latency < 2 seconds for all scenarios
- [ ] No message loss in any scenario
- [ ] Message order preserved
- [ ] Unread counts sync correctly
- [ ] No blocking bugs discovered

---

## Performance Data Recording

Document actual performance metrics:

```markdown
### Performance Metrics (Task 4)

**Scenario 4.1 (Mobile → Admin)**:
- Average latency: _____ ms
- Min latency: _____ ms
- Max latency: _____ ms
- Message loss rate: _____ %

**Scenario 4.2 (Admin → Mobile)**:
- Average latency: _____ ms
- Min latency: _____ ms
- Max latency: _____ ms
- Message loss rate: _____ %

**Scenario 4.3 (Rapid Multi-Message)**:
- Total sync time (5 messages): _____ seconds
- Message loss: _____ / 5
- Order preservation: ✅ / ❌

**Overall Assessment**:
- Meets <2s latency requirement: ✅ / ❌
- Zero message loss: ✅ / ❌
- Order preservation: ✅ / ❌
```

---

## Recording Test Results

### For Each Scenario
Record in the current test record (recommended: topic doc, issue, or PR comment):

```markdown
### Scenario 4.X: [Name]
- **Status**: ✅ PASSED / ❌ FAILED
- **Tested On**: iOS Simulator + Chrome / Android Emulator + Chrome
- **Date**: 2026-01-23
- **Latency**: _____ ms (average)
- **Notes**: [Any observations, issues, or comments]
```

### For Issues Found
Record in the current issue log (recommended: issue tracker, defect list, or PR comment):

```markdown
## 问题X: [Brief Description]
- **Scenario**: 4.X
- **Severity**: P0 (Blocking) / P1 (Important) / P2 (Minor)
- **Description**: [Detailed description]
- **Platforms**: Mobile + Admin
- **Steps to Reproduce**: [Steps]
- **Expected**: [Expected behavior]
- **Actual**: [Actual behavior]
- **Performance Impact**: [If applicable]
```

---

## Troubleshooting Common Issues

### High Latency (> 2 seconds)

**Possible Causes**:
- Network congestion
- Tinode server overload
- WebSocket connection issues
- Device performance issues

**Debugging Steps**:
1. Check Tinode server logs: `docker logs decorating_tinode`
2. Check network latency: `ping localhost` (if local) or ping server IP
3. Monitor WebSocket frames in browser DevTools (Network → WS)
4. Check CPU/memory usage on devices

### Message Loss

**Possible Causes**:
- WebSocket disconnection
- Topic subscription issues
- Message queue overflow
- Server-side issues

**Debugging Steps**:
1. Check connection status on both devices
2. Verify topic subscription in console logs
3. Check Tinode server message retention settings
4. Review message sequence numbers (seq) for gaps

### Message Duplication

**Possible Causes**:
- Retry logic triggering multiple sends
- Message deduplication not working
- Topic subscription issues

**Debugging Steps**:
1. Check message seq numbers (should be unique)
2. Review send logic for retry mechanisms
3. Check Tinode SDK message caching

---

## Next Steps

After completing Task 4 cross-platform sync testing:
1. Mark checkboxes in plan file
2. Document all performance metrics in notepad
3. If P0 issues found: Proceed to Task 6 (Bug Fixes)
4. If no blocking issues: Proceed to Task 5 (Image Upload Testing)

---

**Test Guide Version**: 1.0  
**Last Updated**: 2026-01-23  
**Maintained By**: AI Assistant
