# Admin 管理后台端到端测试执行指南

> **创建日期**: 2026-01-23  
> **目的**: Tinode IM 集成在 Admin 管理后台中的手动测试指南  
> **前置条件**: 任务1（环境验证）已成功完成

---

## 前置条件

### 环境准备
- ✅ Tinode 服务器运行中（任务1已验证）
- ✅ 后端 API 正常运行（任务1已验证）
- ✅ 数据库已连接（任务1已验证）
- ✅ Chrome 浏览器（或现代浏览器）
- ✅ Admin 开发服务器准备就绪

### 测试账号
- **商家账号**: 手机号=`13900139001`，验证码=`123456`

### 启动 Admin 管理后台
```bash
# 终端: 启动 Admin 开发服务器
cd admin
npm run dev

# 预期输出:
# VITE v5.x.x  ready in xxx ms
# ➜  Local:   http://localhost:5173/
# ➜  Network: use --host to expose
```

**打开浏览器**: 访问 `http://localhost:5173`

---

## 测试场景

### 场景 3.1: 商家登录

**目标**: 验证商家登录流程和 Tinode 初始化

**步骤**:
1. 打开 Chrome 浏览器
2. 访问 `http://localhost:5173`
3. **如果不在登录页**: 点击"退出登录"或清除 localStorage
4. 输入手机号: `13900139001`
5. 输入验证码: `123456`
6. 点击"登录"按钮
7. **观察浏览器控制台**（F12 → Console 标签）
8. **观察页面跳转**

**预期的控制台日志**:
```
[Tinode] Initializing...
[Tinode] Connected
[Tinode] Logged in
```
（注意: 实际日志格式可能略有不同）

**预期的界面行为**:
- 登录表单消失
- 页面重定向到商家仪表板或聊天页面
- 无错误提示或弹窗
- 导航菜单出现（如适用）

**预期的网络活动**（F12 → Network 标签）:
- POST 请求到 `/api/v1/auth/login` → 状态 200
- 响应包含 `tinodeToken` 字段
- WebSocket 连接到 `ws://localhost:6060`（或配置的 Tinode 主机）

**验收清单**:
- [ ] 登录成功，无错误
- [ ] 页面跳转到商家区域
- [ ] tinodeToken 存储在 localStorage（检查: `localStorage.getItem('merchant_tinode_token')`）
- [ ] Tinode WebSocket 连接已建立
- [ ] 控制台无错误消息
- [ ] 界面无错误提示

**代码参考**:
- `admin/src/pages/merchant/MerchantLogin.tsx` (登录流程)
- `admin/src/services/TinodeService.ts:67-131` (init 方法)
- `admin/src/pages/merchant/MerchantChat.tsx:52-123` (token 获取和初始化)

**故障排除**:
- **如果出现"缺少 Tinode 登录凭证"错误**: 检查登录 API 是否返回 tinodeToken
- **如果 WebSocket 连接失败**: 验证 Tinode 容器正在运行 (`docker ps | grep tinode`)
- **如果出现"Tinode 初始化失败"错误**: 检查浏览器控制台的详细错误消息
- **如果页面不跳转**: 检查 React Router 配置

---

### 场景 3.2: 查看会话列表

**目标**: 验证会话列表加载和显示

**步骤**:
1. 登录成功后（场景 3.1）
2. 导航到聊天页面（通常是 `/merchant/chat` 或类似路径）
3. 等待会话列表加载（左侧边栏）
4. **观察界面**
5. **观察浏览器控制台**

**预期的界面元素**:

**头部/状态区域**:
- 连接状态指示器（如已实现）
- 页面标题: "商家聊天"或类似

**会话列表（左侧边栏）**:
- 显示会话列表
- 每个会话卡片显示:
  - 头像（圆形图片或占位符）
  - 联系人名称
  - 最后一条消息预览
  - 时间戳（格式: "HH:mm"、"昨天"、"M月D日"）
  - 未读数角标（如果 > 0）
- 会话按最近活跃时间排序

**空状态**（如果没有会话）:
- 空图标或插图
- 消息: "暂无会话"或类似

**预期的控制台日志**:
```
[Tinode] Loading conversations...
[Tinode] Conversations loaded: <数量>
```

**验收清单**:
- [ ] 会话列表加载成功
- [ ] 每个会话显示完整信息
- [ ] 头像正确渲染（或显示占位符）
- [ ] 最后消息预览显示正确
- [ ] 时间戳格式正确
- [ ] 未读数角标显示正确（如适用）
- [ ] 列表按最近活跃时间排序
- [ ] 无加载动画卡住
- [ ] 无错误消息

**代码参考**:
- `admin/src/services/TinodeService.ts:136-152` (getConversationList)
- `admin/src/pages/merchant/MerchantChat.tsx:125-157` (loadConversations)

**故障排除**:
- **如果列表为空**: 检查数据库中是否有现有会话
- **如果加载动画永不停止**: 检查浏览器控制台的错误
- **如果出现"Tinode not initialized"错误**: 刷新页面并重新登录
- **如果头像不加载**: 检查网络标签中失败的图片请求

---

### 场景 3.3: 发送和接收消息

**目标**: 验证消息发送和接收功能

#### 部分 A: 发送消息

**步骤**:
1. 从会话列表（场景 3.2）
2. 点击任意会话打开聊天
3. 等待消息历史加载（右侧面板）
4. **观察现有消息**（如果有）
5. 在消息输入框输入文本: "您好，我是设计师"
6. 点击"发送"按钮或按 Enter
7. **观察消息显示**

**预期的界面行为**:
- 消息立即显示在聊天区域
- 消息显示在右侧（发送方 = 商家）
- 消息显示时间戳
- 消息有适当的样式（背景色、内边距等）
- 发送后输入框清空
- 发送按钮短暂显示加载状态（如已实现）
- 聊天自动滚动到底部

**预期的控制台日志**:
```
[Tinode] Sending message: 您好，我是设计师
[Tinode] Message sent successfully
```

**验收清单**:
- [ ] 消息发送成功
- [ ] 消息立即显示在界面
- [ ] 消息显示在右侧（商家/发送方）
- [ ] 时间戳显示正确
- [ ] 输入框清空
- [ ] 无错误消息
- [ ] 聊天自动滚动到底部

#### 部分 B: 接收消息（实时）

**前置条件**:
- Mobile 应用运行，客户账号已登录
- 或另一个浏览器标签，不同账号

**步骤**:
1. 保持 Admin 管理后台打开，会话处于活跃状态
2. 从 Mobile 应用（或其他浏览器）: 向商家发送消息
3. **观察 Admin 管理后台**实时消息到达

**预期行为**:
- 消息在 2 秒内到达
- 消息显示在左侧（客户/发送方）
- 发送者名称/头像显示正确
- 消息内容完整正确
- 时间戳准确
- 聊天自动滚动显示新消息

**预期的控制台日志**:
```
[Tinode] Message received: {...}
```

**验收清单**:
- [ ] 消息实时接收（<2 秒）
- [ ] 消息内容完整正确
- [ ] 消息显示在左侧（客户/发送方）
- [ ] 发送者信息显示正确
- [ ] 时间戳准确
- [ ] 聊天自动滚动到新消息

**代码参考**:
- `admin/src/services/TinodeService.ts:200-207` (sendText)
- `admin/src/pages/merchant/MerchantChat.tsx` (消息发送处理)
- `admin/src/services/TinodeService.ts:91-93` (onMessage 回调)

**故障排除**:
- **如果消息不发送**: 检查控制台中的 topic 订阅状态
- **如果消息显示但无确认**: 检查 Tinode 服务器日志
- **如果消息不到达**: 检查 WebSocket 连接状态
- **如果延迟 > 2 秒**: 检查网络延迟、Tinode 服务器负载

---

## 任务 3 总验收清单

完成所有 3 个场景后，验证:

- [ ] 所有 3 个场景测试通过
- [ ] 商家端聊天功能正常
- [ ] 无阻塞性 Bug

---

## 记录测试结果

### 每个场景
记录到当前测试记录中（建议写入专题文档、issue 或 PR 评论）:

```markdown
### 场景 3.X: [名称]
- **状态**: ✅ 通过 / ❌ 失败
- **测试浏览器**: Chrome 120.x / Firefox 121.x
- **日期**: 2026-01-23
- **备注**: [任何观察、问题或评论]
```

### 发现的问题
记录到当前缺陷记录中（建议写入 issue、缺陷清单或 PR 评论）:

```markdown
## 问题X: [简要描述]
- **场景**: 3.X
- **严重程度**: P0（阻塞）/ P1（重要）/ P2（次要）
- **描述**: [详细描述]
- **重现步骤**: [步骤]
- **预期**: [预期行为]
- **实际**: [实际行为]
- **截图**: [如适用]
```

---

## 浏览器开发者工具提示

### Console 标签
- 过滤日志: 在过滤框输入"Tinode"
- 保留日志: 勾选"Preserve log"以在页面重新加载时保留日志
- 显示时间戳: 设置 → 首选项 → Console → 显示时间戳

### Network 标签
- 过滤 WebSocket: 在过滤框输入"WS"
- 查看 WebSocket 帧: 点击 WebSocket 连接 → Messages 标签
- 监控 API 调用: 按"XHR"或"Fetch"过滤

### Application 标签
- 查看 localStorage: Application → Local Storage → http://localhost:5173
- 检查 merchant_tinode_token: 登录后应该存在
- 清除存储: 右键点击 → Clear 以重置状态

---

## 下一步

完成任务 3 手动测试后:
1. 更新当前执行清单或测试 checklist
2. 在当前测试记录、issue 或 PR 备注中记录所有发现
3. 如果发现 P0 问题: 继续任务 6（Bug 修复）
4. 如果无阻塞问题: 继续任务 4（跨平台消息同步测试）

---

## Playwright 自动化备注（未来）

为了未来的自动化，考虑添加这些 data-testid 属性:

```tsx
// 登录表单
<input data-testid="merchant-phone-input" />
<input data-testid="merchant-code-input" />
<button data-testid="merchant-login-button" />

// 会话列表
<div data-testid="conversation-list" />
<div data-testid="conversation-item-{topicName}" />

// 聊天界面
<div data-testid="message-list" />
<input data-testid="message-input" />
<button data-testid="send-button" />
<div data-testid="message-{seqId}" />
```

这将启用可靠的 Playwright 自动化:
```typescript
await page.fill('[data-testid="merchant-phone-input"]', '13900139001');
await page.fill('[data-testid="merchant-code-input"]', '123456');
await page.click('[data-testid="merchant-login-button"]');
```

---

**测试指南版本**: 1.0  
**最后更新**: 2026-01-23  
**维护者**: AI 助手
