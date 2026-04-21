# Admin Panel E2E Test Execution Guide

> **Created**: 2026-01-23  
> **Purpose**: Manual testing guide for Tinode IM integration in Admin Panel  
> **Prerequisites**: Task 1 (Environment Verification) completed successfully

---

## Prerequisites

### Environment Setup
- ✅ Tinode server running (verified in Task 1)
- ✅ Backend API operational (verified in Task 1)
- ✅ Database connected (verified in Task 1)
- ✅ Chrome browser (or modern browser)
- ✅ Admin dev server ready to start

### Test Accounts
- **Merchant Account**: phone=`13900139001`, code=`123456`

### Starting the Admin Panel
```bash
# Terminal: Start Admin dev server
cd admin
npm run dev

# Expected output:
# VITE v5.x.x  ready in xxx ms
# ➜  Local:   http://localhost:5173/
# ➜  Network: use --host to expose
```

**Open browser**: Navigate to `http://localhost:5173`

---

## Test Scenarios

### Scenario 3.1: Merchant Login

**Objective**: Verify merchant login flow and Tinode initialization

**Steps**:
1. Open Chrome browser
2. Navigate to `http://localhost:5173`
3. **If not on login page**: Click "Logout" or clear localStorage
4. Enter phone: `13900139001`
5. Enter verification code: `123456`
6. Click "登录" (Login) button
7. **Observe browser console** (F12 → Console tab)
8. **Observe page navigation**

**Expected Console Logs**:
```
[Tinode] Initializing...
[Tinode] Connected
[Tinode] Logged in
```
(Note: Exact log format may vary based on implementation)

**Expected UI Behavior**:
- Login form disappears
- Page redirects to merchant dashboard or chat page
- No error alerts or toasts
- Navigation menu appears (if applicable)

**Expected Network Activity** (F12 → Network tab):
- POST request to `/api/v1/auth/login` → Status 200
- Response includes `tinodeToken` field
- WebSocket connection to `ws://localhost:6060` (or configured Tinode host)

**Verification Checklist**:
- [ ] Login succeeds without errors
- [ ] Page navigates to merchant area
- [ ] tinodeToken stored in localStorage (check: `localStorage.getItem('merchant_tinode_token')`)
- [ ] Tinode WebSocket connection established
- [ ] No error messages in console
- [ ] No error alerts in UI

**Code Reference**:
- `admin/src/pages/merchant/MerchantLogin.tsx` (login flow)
- `admin/src/services/TinodeService.ts:67-131` (init method)
- `admin/src/pages/merchant/MerchantChat.tsx:52-123` (token retrieval and init)

**Troubleshooting**:
- **If "缺少 Tinode 登录凭证" error**: Check if login API returns tinodeToken
- **If WebSocket connection fails**: Verify Tinode container is running (`docker ps | grep tinode`)
- **If "Tinode 初始化失败" error**: Check browser console for detailed error message
- **If page doesn't redirect**: Check React Router configuration

---

### Scenario 3.2: View Conversation List

**Objective**: Verify conversation list loading and display

**Steps**:
1. After successful login (Scenario 3.1)
2. Navigate to chat page (usually `/merchant/chat` or similar)
3. Wait for conversation list to load (left sidebar)
4. **Observe the UI**
5. **Observe browser console**

**Expected UI Elements**:

**Header/Status Area**:
- Connection status indicator (if implemented)
- Page title: "商家聊天" or similar

**Conversation List (Left Sidebar)**:
- List of conversations displayed
- Each conversation card shows:
  - Avatar (circular image or placeholder)
  - Contact name
  - Last message preview
  - Timestamp (formatted: "HH:mm", "昨天", "M月D日")
  - Unread count badge (if > 0)
- Conversations sorted by most recent first

**Empty State** (if no conversations):
- Empty icon or illustration
- Message: "暂无会话" or similar

**Expected Console Logs**:
```
[Tinode] Loading conversations...
[Tinode] Conversations loaded: <number>
```

**Verification Checklist**:
- [ ] Conversation list loads successfully
- [ ] Each conversation displays complete information
- [ ] Avatars render correctly (or show placeholder)
- [ ] Last message preview shows correctly
- [ ] Timestamps are formatted properly
- [ ] Unread count badges display correctly (if applicable)
- [ ] List is sorted by most recent activity
- [ ] No loading spinners stuck
- [ ] No error messages

**Code Reference**:
- `admin/src/services/TinodeService.ts:136-152` (getConversationList)
- `admin/src/pages/merchant/MerchantChat.tsx:125-157` (loadConversations)

**Troubleshooting**:
- **If list is empty**: Check database for existing conversations
- **If loading spinner never stops**: Check browser console for errors
- **If "Tinode not initialized" error**: Refresh page and re-login
- **If avatars don't load**: Check network tab for failed image requests

---

### Scenario 3.3: Send and Receive Messages

**Objective**: Verify message sending and receiving functionality

#### Part A: Send Message

**Steps**:
1. From conversation list (Scenario 3.2)
2. Click on any conversation to open chat
3. Wait for message history to load (right panel)
4. **Observe existing messages** (if any)
5. Type text in message input field: "您好，我是设计师"
6. Click "发送" (Send) button or press Enter
7. **Observe message appearance**

**Expected UI Behavior**:
- Message appears immediately in chat area
- Message displays on right side (sender = merchant)
- Message shows timestamp
- Message has proper styling (background color, padding, etc.)
- Input field clears after sending
- Send button shows loading state briefly (if implemented)
- Chat scrolls to bottom automatically

**Expected Console Logs**:
```
[Tinode] Sending message: 您好，我是设计师
[Tinode] Message sent successfully
```

**Verification Checklist**:
- [ ] Message sends successfully
- [ ] Message appears in UI immediately
- [ ] Message displays on right side (merchant/sender)
- [ ] Timestamp shows correctly
- [ ] Input field clears
- [ ] No error messages
- [ ] Chat auto-scrolls to bottom

#### Part B: Receive Message (Real-time)

**Prerequisites**:
- Mobile app running with customer account logged in
- OR another browser tab with different account

**Steps**:
1. Keep Admin panel open with conversation active
2. From Mobile app (or other browser): Send message to merchant
3. **Observe Admin panel** for real-time message arrival

**Expected Behavior**:
- Message appears within 2 seconds
- Message displays on left side (receiver)
- Sender name/avatar shows correctly
- Message content is complete and correct
- Timestamp is accurate
- Chat auto-scrolls to show new message

**Expected Console Logs**:
```
[Tinode] Message received: {...}
```

**Verification Checklist**:
- [ ] Message received in real-time (<2 seconds)
- [ ] Message content is complete and correct
- [ ] Message displays on left side (customer/sender)
- [ ] Sender information displays correctly
- [ ] Timestamp is accurate
- [ ] Chat auto-scrolls to new message

**Code Reference**:
- `admin/src/services/TinodeService.ts:200-207` (sendText)
- `admin/src/pages/merchant/MerchantChat.tsx` (message sending handler)
- `admin/src/services/TinodeService.ts:91-93` (onMessage callback)

**Troubleshooting**:
- **If message doesn't send**: Check topic subscription status in console
- **If message appears but no confirmation**: Check Tinode server logs
- **If message doesn't arrive**: Check WebSocket connection status
- **If delay > 2 seconds**: Check network latency, Tinode server load

---

## Task 3 Summary Checklist

After completing all 3 scenarios, verify:

- [ ] All 3 scenarios tested successfully
- [ ] Merchant login and Tinode initialization working
- [ ] Conversation list displays correctly
- [ ] Message sending works
- [ ] Message receiving works (real-time)
- [ ] No blocking bugs discovered
- [ ] User experience is smooth

---

## Recording Test Results

### For Each Scenario
Record in the current test record (recommended: topic doc, issue, or PR comment):

```markdown
### Scenario 3.X: [Name]
- **Status**: ✅ PASSED / ❌ FAILED
- **Tested On**: Chrome 120.x / Firefox 121.x
- **Date**: 2026-01-23
- **Notes**: [Any observations, issues, or comments]
```

### For Issues Found
Record in the current issue log (recommended: issue tracker, defect list, or PR comment):

```markdown
## 问题X: [Brief Description]
- **Scenario**: 3.X
- **Severity**: P0 (Blocking) / P1 (Important) / P2 (Minor)
- **Description**: [Detailed description]
- **Steps to Reproduce**: [Steps]
- **Expected**: [Expected behavior]
- **Actual**: [Actual behavior]
- **Screenshots**: [If applicable]
```

---

## Browser Developer Tools Tips

### Console Tab
- Filter logs: Type "Tinode" in filter box
- Preserve log: Check "Preserve log" to keep logs across page reloads
- Show timestamps: Settings → Preferences → Console → Show timestamps

### Network Tab
- Filter WebSocket: Type "WS" in filter box
- View WebSocket frames: Click on WebSocket connection → Messages tab
- Monitor API calls: Filter by "XHR" or "Fetch"

### Application Tab
- View localStorage: Application → Local Storage → http://localhost:5173
- Check merchant_tinode_token: Should be present after login
- Clear storage: Right-click → Clear to reset state

---

## Next Steps

After completing Task 3 manual testing:
1. Update the current execution checklist or test checklist
2. Document all findings in the current test record / issue / PR notes
3. If P0 issues found: Proceed to Task 6 (Bug Fixes) before continuing
4. If no blocking issues: Proceed to Task 4 (Cross-platform Sync Testing)

---

## Playwright Automation Notes (Future)

For future automation, consider adding these data-testid attributes:

```tsx
// Login form
<input data-testid="merchant-phone-input" />
<input data-testid="merchant-code-input" />
<button data-testid="merchant-login-button" />

// Conversation list
<div data-testid="conversation-list" />
<div data-testid="conversation-item-{topicName}" />

// Chat interface
<div data-testid="message-list" />
<input data-testid="message-input" />
<button data-testid="send-button" />
<div data-testid="message-{seqId}" />
```

This would enable reliable Playwright automation:
```typescript
await page.fill('[data-testid="merchant-phone-input"]', '13900139001');
await page.fill('[data-testid="merchant-code-input"]', '123456');
await page.click('[data-testid="merchant-login-button"]');
```

---

**Test Guide Version**: 1.0  
**Last Updated**: 2026-01-23  
**Maintained By**: AI Assistant
