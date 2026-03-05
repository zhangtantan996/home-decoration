# Tinode 功能对照表

本文档对比当前腾讯云 IM 实现与 Tinode 的功能对应关系，用于评估迁移可行性。

## 移动端功能（React Native）

基于 `mobile/src/services/TencentIMService.ts`、`mobile/src/screens/MessageScreen.tsx`、`mobile/src/screens/ChatRoomScreen.tsx` 的分析。

| 功能 | 腾讯云 IM API | Tinode API | 优先级 | 状态 |
|------|--------------|-----------|--------|------|
| SDK 初始化 | `TencentCloudChat.create()` | `Tinode.connect()` | P0 | ✅ |
| 用户登录 | `chat.login({ userID, userSig })` | `tinode.loginToken()` / `tinode.loginBasic()` | P0 | ✅ |
| 用户登出 | `chat.logout()` | `tinode.disconnect()` | P0 | ✅ |
| 获取会话列表 | `chat.getConversationList()` | `tinode.getMeta('me', { what: 'sub' })` | P0 | ✅ |
| 获取历史消息 | `chat.getMessageList({ conversationID })` | `tinode.getMeta(topic, { what: 'data' })` | P0 | ✅ |
| 发送文本消息 | `chat.createTextMessage()` + `chat.sendMessage()` | `tinode.publish(topic, content)` | P0 | ✅ |
| 发送图片消息 | `chat.createImageMessage()` + `chat.sendMessage()` | `tinode.publish()` + 自定义附件上传 | P0 | ⚠️ |
| 发送文件消息 | `chat.createFileMessage()` + `chat.sendMessage()` | `tinode.publish()` + 自定义附件上传 | P1 | ⚠️ |
| 接收新消息 | `chat.on(TIM.EVENT.MESSAGE_RECEIVED)` | `tinode.onData` 回调 | P0 | ✅ |
| 标记消息已读 | `chat.setMessageRead({ conversationID })` | `tinode.noteRead(topic, seq)` | P0 | ✅ |
| 未读消息计数 | `conversation.unreadCount` | `sub.unread` (来自 getMeta) | P0 | ✅ |
| 会话排序（按时间） | SDK 自动排序 | 客户端手动排序 `sub.updated` | P1 | ✅ |
| 在线状态显示 | 需自定义字段或额外 API | `sub.online` (presence) | P2 | ✅ |
| 消息时间格式化 | 客户端实现 | 客户端实现 | P1 | ✅ |
| Emoji 解析 | 客户端实现 (`parseEmojiText`) | 客户端实现 | P2 | ✅ |
| 快捷回复 | 客户端 UI 实现 | 客户端 UI 实现 | P2 | ✅ |
| 拍照/相册选择 | 客户端 + `createImageMessage` | 客户端 + 自定义上传 | P1 | ⚠️ |
| 文件选择 | 客户端 + `createFileMessage` | 客户端 + 自定义上传 | P1 | ⚠️ |
| 消息发送状态 | SDK 自动管理 | 客户端手动管理 | P1 | ⚠️ |
| 消息重发 | SDK 支持 | 需客户端实现 | P2 | ❌ |
| 清空聊天记录 | `chat.deleteConversation()` | `tinode.delMessages(topic, ranges)` | P2 | ✅ |
| 举报功能 | 业务层实现 | 业务层实现 | P2 | ✅ |

**说明：**
- ✅ = Tinode 原生支持或可直接实现
- ⚠️ = 需要额外开发（如自定义附件服务器）
- ❌ = Tinode 不直接支持，需完全自行实现

## 管理后台功能（TUIKit）

基于 `admin/src/pages/merchant/MerchantChat.tsx` 的分析。

| 功能 | 腾讯云 TUIKit | Tinode 方案 | 优先级 | 状态 |
|------|--------------|------------|--------|------|
| SDK 初始化 | `TUILogin.login()` + `TUIChatEngine.login()` | `Tinode.connect()` + `loginToken()` | P0 | ✅ |
| 会话列表组件 | `<ConversationList />` | 自定义 React 组件 + `getMeta('me')` | P0 | ⚠️ |
| 聊天窗口组件 | `<Chat />` + `<ChatHeader />` + `<MessageList />` + `<MessageInput />` | 自定义 React 组件 + Tinode API | P0 | ⚠️ |
| 会话切换 | `TUIConversationService.switchConversation()` | 客户端状态管理 + `subscribe(topic)` | P0 | ✅ |
| 消息接收事件 | `chat.on(TIM.EVENT.MESSAGE_RECEIVED)` | `tinode.onData` | P0 | ✅ |
| SDK 就绪事件 | `chat.on(TIM.EVENT.SDK_READY)` | `tinode.onConnect` | P0 | ✅ |
| 主题样式定制 | `tuikit-theme.css` | 自定义 CSS | P1 | ✅ |
| 多语言支持 | `language="zh-CN"` | 客户端 i18n 实现 | P2 | ✅ |
| 空状态占位符 | `PlaceholderEmpty` prop | 自定义 React 组件 | P2 | ✅ |
| 会话列表实时更新 | TUIKit 自动处理 | 手动监听 `onMeta` / `onPres` | P1 | ⚠️ |
| 消息列表实时更新 | TUIKit 自动处理 | 手动监听 `onData` | P1 | ⚠️ |

**说明：**
- ⚠️ = 需要从零开发 UI 组件（TUIKit 是腾讯云提供的现成 UI 库，Tinode 无官方 React UI 库）

## 后端支持

基于当前后端 API 和 IM 服务集成分析。

| 功能 | 当前实现 | Tinode 方案 |
|------|---------|------------|
| 获取 IM 凭证 | `GET /im/usersig` 返回 `{ sdkAppId, userId, userSig }` | `GET /im/token` 返回 Tinode JWT token |
| UserSig 生成 | 腾讯云 SDK 生成（基于 SecretKey） | JWT 签名（基于 Tinode 密钥） |
| 用户 ID 映射 | 业务 userId → IM userId (字符串) | 业务 userId → Tinode userId (usrXXX 格式) |
| 消息推送 | 腾讯云推送服务 | 需集成第三方推送（FCM/APNs） |
| 消息存储 | 腾讯云服务器 | Tinode 服务器（自托管） |
| 文件/图片存储 | 腾讯云 COS（SDK 自动上传） | 需自建文件服务器或对象存储 |
| 敏感词过滤 | 腾讯云内置 | 需自行实现 |
| 消息审核 | 腾讯云内置 | 需自行实现 |
| 历史消息导出 | 腾讯云控制台 | Tinode 数据库直接导出 |
| 统计分析 | 腾讯云控制台 | 需自行实现 |

## 关键差异总结

### Tinode 优势
1. **开源免费**：无消息量/用户数限制
2. **自主可控**：数据完全自托管
3. **协议简洁**：基于 WebSocket + JSON，易于调试
4. **跨平台**：官方支持 Web/iOS/Android SDK

### Tinode 劣势
1. **无现成 UI 组件**：需从零开发聊天界面（移动端和管理后台）
2. **附件处理**：需自建文件上传/下载服务
3. **推送服务**：需自行集成 FCM/APNs
4. **运维成本**：需自行部署、监控、备份 Tinode 服务器
5. **功能缺失**：无内置敏感词过滤、消息审核、统计分析

## 迁移建议

### 阶段 1：核心功能验证（P0）
- [ ] 搭建 Tinode 测试环境
- [ ] 实现后端 JWT token 生成接口
- [ ] 移动端实现基础消息收发（文本）
- [ ] 管理后台实现基础会话列表和聊天窗口

### 阶段 2：附件支持（P1）
- [ ] 搭建文件上传服务（基于现有 `/upload` 接口）
- [ ] 移动端实现图片/文件发送
- [ ] 管理后台实现附件预览

### 阶段 3：完善体验（P2）
- [ ] 实现消息重发机制
- [ ] 优化在线状态显示
- [ ] 集成推送服务（FCM/APNs）
- [ ] 实现敏感词过滤（可选）

### 风险评估
- **开发工作量**：预计需要 **4-6 周**（2 名全职开发）
- **UI 组件开发**：管理后台 TUIKit 替换工作量最大
- **运维复杂度**：需增加 Tinode 服务器监控和备份
- **功能降级**：短期内无法实现消息审核、统计分析等高级功能
