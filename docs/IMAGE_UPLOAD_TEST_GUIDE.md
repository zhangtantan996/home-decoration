# Image/File Upload Functionality Test Guide

> **Created**: 2026-01-23  
> **Purpose**: Verify image message sending and display functionality  
> **Prerequisites**: Task 1 (Environment) and Task 2 (Mobile E2E) completed

---

## Prerequisites

### Environment Setup
- ✅ Task 1: Environment verified and operational
- ✅ Task 2: Mobile app code inspected
- ✅ Backend upload API available (`/api/v1/upload`)
- ✅ Mobile app running with image picker libraries installed

### Test Accounts
- **Account A**: phone=`13800138000`, code=`123456`
- **Account B**: phone=`13800138001`, code=`123456` (for receiving)

### Code Verification

**Image Upload Implementation Status**: ✅ IMPLEMENTED

**Mobile (TinodeService.ts)**:
- ✅ `sendImageMessage()` method exists (lines 420-446)
- ✅ `uploadFile()` private method exists (lines 451-467)
- ✅ Uses Tinode's LargeFileHelper for upload
- ✅ Drafty format for image messages
- ✅ Includes image metadata (width, height, mime type)

**Mobile (ChatRoomScreen.tsx)**:
- ✅ Image picker integration (`react-native-image-picker`)
- ✅ Camera launch support (`launchCamera`)
- ✅ Gallery selection support (`launchImageLibrary`)
- ✅ Image message sending integrated

**Backend (upload_handler.go)**:
- ✅ Upload endpoint: `POST /api/v1/upload`
- ✅ File storage: `./uploads/chat/{YYYYMM}/{filename}`
- ✅ Static file serving: `/uploads` route
- ✅ File URL generation

---

## Test Scenarios

### Scenario 5.1: Test Backend Upload API

**Objective**: Verify backend upload endpoint is functional

**Steps**:
```bash
# 1. Prepare a test image
# Download or use any JPEG image, save as test.jpg

# 2. Get authentication token
TOKEN=$(curl -s -X POST http://localhost:8080/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"phone": "13800138000", "code": "123456"}' \
  | grep -o '"token":"[^"]*"' | cut -d'"' -f4)

# 3. Test upload
curl -X POST http://localhost:8080/api/v1/upload \
  -H "Authorization: Bearer $TOKEN" \
  -F "file=@test.jpg"

# Expected response:
# {
#   "code": 0,
#   "message": "success",
#   "data": {
#     "url": "/uploads/chat/202601/xxxxx.jpg"
#   }
# }

# 4. Verify file is accessible
curl -I http://localhost:8080/uploads/chat/202601/xxxxx.jpg
# Expected: HTTP 200 OK
```

**Verification Checklist**:
- [ ] Upload endpoint responds with 200 OK
- [ ] Response includes `url` field
- [ ] File URL is accessible
- [ ] Image displays in browser when visiting URL
- [ ] File is stored in correct directory (`./uploads/chat/YYYYMM/`)

**Troubleshooting**:
- **If 401 Unauthorized**: Token expired or invalid, re-login
- **If 500 Error**: Check server logs, verify upload directory permissions
- **If file not accessible**: Check static file serving configuration

---

### Scenario 5.2: Mobile - Select Image from Gallery

**Objective**: Verify image selection and sending from device gallery

**Prerequisites**:
- Mobile app running
- Test images available in device gallery (simulator/emulator)

**Steps**:
1. Open Mobile app
2. Login with Account A (13800138000)
3. Navigate to a conversation
4. Tap attachment button (+ icon or similar)
5. Select "相册" (Gallery) or "图片" (Image)
6. **Observe image picker UI**
7. Select a test image
8. **Observe upload progress** (if shown)
9. **Observe message sending**
10. **Verify image appears in chat**

**Expected Behavior**:
- Image picker opens successfully
- Selected image preview shows (if implemented)
- Upload progress indicator appears (if implemented)
- Image message sends successfully
- Image displays in chat as thumbnail or full image
- Image is tappable to view full size (if implemented)
- Console shows: `[Tinode] 图片已发送: <url>`

**Verification Checklist**:
- [ ] Image picker opens without errors
- [ ] Image selection works
- [ ] Upload succeeds
- [ ] Image message sends successfully
- [ ] Image displays in chat
- [ ] Image is viewable (tap to enlarge)
- [ ] No errors in console

**Code Reference**:
- `mobile/src/screens/ChatRoomScreen.tsx:602-630` (launchImageLibrary)
- `mobile/src/services/TinodeService.ts:420-446` (sendImageMessage)

**Troubleshooting**:
- **If picker doesn't open**: Check permissions (iOS: Info.plist, Android: AndroidManifest.xml)
- **If upload fails**: Check network connectivity, backend API status
- **If image doesn't display**: Check image URL format, static file serving

---

### Scenario 5.3: Mobile - Capture Image with Camera

**Objective**: Verify image capture and sending from device camera

**Prerequisites**:
- Mobile app running
- Camera permissions granted
- Physical device OR simulator with camera support

**Steps**:
1. Open Mobile app
2. Login with Account A
3. Navigate to a conversation
4. Tap attachment button
5. Select "拍照" (Camera) or "相机" (Camera)
6. **Observe camera UI**
7. Take a photo
8. Confirm/accept photo
9. **Observe upload and sending**
10. **Verify image appears in chat**

**Expected Behavior**:
- Camera opens successfully
- Photo capture works
- Photo preview/confirmation shows
- Upload and send succeed
- Image displays in chat

**Verification Checklist**:
- [ ] Camera opens without errors
- [ ] Photo capture works
- [ ] Photo confirmation UI works
- [ ] Upload succeeds
- [ ] Image message sends
- [ ] Image displays in chat
- [ ] No errors in console

**Code Reference**:
- `mobile/src/screens/ChatRoomScreen.tsx:574-600` (launchCamera)

**Troubleshooting**:
- **If camera doesn't open**: Check camera permissions
- **If "Camera not available"**: Use physical device or check simulator settings
- **If upload fails**: Same as Scenario 5.2

---

### Scenario 5.4: Receive Image Message

**Objective**: Verify image message reception and display

**Prerequisites**:
- Two devices: Device 1 (Account A), Device 2 (Account B)
- OR: Mobile + Admin panel

**Steps**:
1. Device 1: Account A sends image message (using Scenario 5.2 or 5.3)
2. Device 2: Account B is viewing conversation with Account A
3. **Observe image message arrival on Device 2**

**Expected Behavior**:
- Image message arrives in real-time (<2 seconds)
- Image displays as thumbnail or full image
- Image is tappable to view full size
- Image loads successfully (not broken image icon)
- Sender info is correct
- Timestamp is accurate

**Verification Checklist**:
- [ ] Image message received in real-time
- [ ] Image displays correctly
- [ ] Image is viewable (tap to enlarge)
- [ ] No broken image icons
- [ ] Sender info correct
- [ ] Timestamp accurate

**Troubleshooting**:
- **If image doesn't arrive**: Check WebSocket connection
- **If broken image**: Check image URL, static file serving
- **If image doesn't load**: Check network connectivity, CORS settings

---

### Scenario 5.5: Image Message in Conversation List

**Objective**: Verify image message preview in conversation list

**Steps**:
1. Send an image message in a conversation (Scenario 5.2 or 5.3)
2. Navigate back to conversation list (Messages tab)
3. **Observe the conversation item**

**Expected Behavior**:
- Last message shows: "【图片】" or "[图片]"
- OR: Small image thumbnail preview (if implemented)
- Timestamp is updated
- Unread count updates (if sent from other device)

**Verification Checklist**:
- [ ] Conversation list updates
- [ ] Last message shows image indicator
- [ ] Timestamp updates
- [ ] Unread count correct (if applicable)

**Code Reference**:
- `mobile/src/screens/MessageScreen.tsx:205-226` (image message preview logic)

---

### Scenario 5.6: Multiple Image Messages

**Objective**: Verify handling of multiple image messages

**Steps**:
1. Send 3 image messages in sequence
2. **Observe all images in chat**
3. Verify each image displays correctly
4. Tap each image to view full size

**Expected Behavior**:
- All 3 images send successfully
- All 3 images display in chat
- Images are in correct order
- Each image is independently viewable
- No performance issues (lag, crashes)

**Verification Checklist**:
- [ ] All images send successfully
- [ ] All images display correctly
- [ ] Correct order maintained
- [ ] Each image viewable independently
- [ ] No performance degradation

---

### Scenario 5.7: Large Image Handling

**Objective**: Verify handling of large image files

**Steps**:
1. Select a large image (> 5MB if possible)
2. Attempt to send
3. **Observe upload behavior**

**Expected Behavior**:
- Upload progress indicator shows (if implemented)
- Upload completes successfully (may take longer)
- Image sends and displays correctly
- OR: Size limit error message (if size limit exists)

**Verification Checklist**:
- [ ] Large image upload works OR shows appropriate error
- [ ] Upload progress visible (if implemented)
- [ ] No app crash or freeze
- [ ] Appropriate error handling (if size limit)

**Troubleshooting**:
- **If upload times out**: Check backend timeout settings
- **If upload fails**: Check backend file size limits
- **If app crashes**: Check memory handling

---

## Task 5 Summary Checklist

After completing all 7 scenarios, verify:

- [ ] Backend upload API functional
- [ ] Image selection from gallery works
- [ ] Camera capture works (if tested)
- [ ] Image messages send successfully
- [ ] Image messages receive and display correctly
- [ ] Image preview in conversation list works
- [ ] Multiple images handled correctly
- [ ] Large images handled appropriately
- [ ] No blocking bugs discovered

---

## Code Implementation Notes

### Tinode Image Message Format (Drafty)

```typescript
{
  txt: '[图片]',  // Fallback text
  ent: [{
    tp: 'IM',     // Image type
    data: {
      mime: 'image/jpeg',
      val: '/uploads/chat/202601/xxxxx.jpg',  // Image URL
      width: 1920,   // Optional
      height: 1080   // Optional
    }
  }]
}
```

### Upload Flow

```
1. User selects image → launchImageLibrary() or launchCamera()
2. Get image URI → file:///path/to/image.jpg
3. Call TinodeService.sendImageMessage(topicName, imageUri)
4. TinodeService.uploadFile() → Tinode LargeFileHelper
5. Tinode uploads to server → Returns URL
6. TinodeService publishes Drafty message with image URL
7. Message syncs to all participants
8. Recipients display image from URL
```

### Backend Upload Endpoint

```
POST /api/v1/upload
Authorization: Bearer <token>
Content-Type: multipart/form-data

Body: file=<binary>

Response:
{
  "code": 0,
  "message": "success",
  "data": {
    "url": "/uploads/chat/202601/xxxxx.jpg"
  }
}
```

---

## Recording Test Results

### For Each Scenario
Record in the current test record (recommended: topic doc, issue, or PR comment):

```markdown
### Scenario 5.X: [Name]
- **Status**: ✅ PASSED / ❌ FAILED
- **Tested On**: iOS Simulator 17.0 / Android Emulator API 33
- **Date**: 2026-01-23
- **Image Size**: _____ KB/MB
- **Upload Time**: _____ seconds
- **Notes**: [Any observations, issues, or comments]
```

### For Issues Found
Record in the current issue log (recommended: issue tracker, defect list, or PR comment)

---

## Next Steps

After completing Task 5 image upload testing:
1. Mark checkboxes in plan file
2. Document all findings in the current test record / issue / PR notes
3. If P0 issues found: Proceed to Task 6 (Bug Fixes)
4. If no blocking issues: Proceed to Task 7 (Final Report)

---

**Test Guide Version**: 1.0  
**Last Updated**: 2026-01-23  
**Maintained By**: AI Assistant
