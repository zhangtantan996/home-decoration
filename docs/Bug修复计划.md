# Bug 修复计划

**日期**: 2026-01-23  
**基于**: 用户手动测试发现的问题

---

## 修复计划

### P0 问题修复（立即执行）

#### 1. 图片发送失败（问题4）
**错误**: `TypeError: _e16.set is not a function`  
**原因**: Tinode SDK 的 LargeFileHelper 可能不支持 React Native 的 FormData 格式  
**解决方案**: 改用后端上传 API (`/api/v1/upload`) 而不是 Tinode 内置上传  

**修改文件**: `mobile/src/services/TinodeService.ts`
- 修改 `uploadFile` 方法使用后端 API
- 使用 axios 上传到 `/api/v1/upload`
- 获取返回的 URL 后发送 Drafty 消息

#### 2. 认证失败错误（问题3）
**错误**: `CommError:authentication required (401)`  
**原因**: Token 可能过期或 Tinode 会话失效  
**解决方案**: 
- 在订阅 topic 前检查连接状态
- 如果未连接，重新初始化 Tinode
- 添加 token 刷新逻辑

**修改文件**: `mobile/src/screens/ChatRoomScreen.tsx`
- 在 `loadMessages` 中添加连接检查
- 添加重新初始化逻辑

#### 3. 离线消息不显示（问题1）
**原因**: 可能是消息加载逻辑问题或 UI 渲染问题  
**解决方案**:
- 检查 `subscribeToConversation` 的消息加载
- 确保消息正确解析和显示
- 添加调试日志

**修改文件**: `mobile/src/screens/ChatRoomScreen.tsx`

#### 4. 断线重连后消息不同步（问题2）
**原因**: 重连后未重新订阅 topic 或未拉取消息  
**解决方案**:
- 在 `onConnect` 回调中重新订阅 me topic
- 添加消息同步逻辑
- 添加完整的日志

**修改文件**: `mobile/src/services/TinodeService.ts`

#### 5. 相机权限错误（问题5）
**错误**: Android 相机权限配置问题  
**解决方案**: 修改 AndroidManifest.xml，移除或正确配置 CAMERA 权限

**修改文件**: `mobile/android/app/src/main/AndroidManifest.xml`

---

### P1 问题修复（尽快执行）

#### 6. 切换会话导致内容消失（问题6）
**错误**: `Tinode history timeout`  
**原因**: 超时时间太短或网络慢  
**解决方案**: 增加超时时间，添加重试逻辑

**修改文件**: `admin/src/services/TinodeService.ts`

#### 7. 发送消息后光标丢失（问题7）
**原因**: 发送后未重新聚焦输入框  
**解决方案**: 发送成功后调用 `inputRef.current?.focus()`

**修改文件**: `admin/src/pages/merchant/MerchantChat.tsx`

#### 8. iOS 输入框无法弹出键盘（问题8）
**原因**: TextInput 配置问题  
**解决方案**: 添加 `autoFocus` 或确保 `editable={true}`

**修改文件**: `mobile/src/screens/ChatRoomScreen.tsx`

#### 9. Android 键盘收起后布局错位（问题9）
**原因**: `KeyboardAvoidingView` 或 `android:windowSoftInputMode` 配置问题  
**解决方案**: 
- 使用 `KeyboardAvoidingView` 的 `behavior="padding"`
- 或在 AndroidManifest.xml 中设置 `android:windowSoftInputMode="adjustResize"`

**修改文件**: 
- `mobile/src/screens/ChatRoomScreen.tsx`
- `mobile/android/app/src/main/AndroidManifest.xml`

---

## 修复顺序

1. ✅ 问题4: 图片发送（最高优先级，阻塞所有图片测试）
2. ✅ 问题3: 认证失败（阻塞聊天加载）
3. ✅ 问题5: 相机权限（快速修复）
4. ✅ 问题1: 离线消息
5. ✅ 问题2: 断线重连
6. ✅ 问题6: 切换会话
7. ✅ 问题7: 光标丢失
8. ✅ 问题8: iOS 键盘
9. ✅ 问题9: Android 布局

---

## 测试后端上传 API

用户要求测试场景 5.1，我会先测试后端 API 是否正常工作。
