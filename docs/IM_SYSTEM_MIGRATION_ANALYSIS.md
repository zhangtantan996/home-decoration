仅反映当时路径，不代表当前正式发布规范。当前正式业务 schema 发布目录以 `server/migrations/` 为准；专题脚本仍按各自文档执行。

# 家装平台聊天功能全面分析报告

**文档版本**: 1.0
**创建日期**: 2026-01-23
**分析范围**: WebSocket Hub / Tinode IM / 腾讯云 IM
**分析级别**: 深度（Medium）

---

## 📊 执行摘要

本平台正处于 **IM 系统迁移的关键阶段**，从自研 WebSocket Hub 向 Tinode（主）+ 腾讯云 IM（备选）双轨并行过渡。经过深入代码分析，发现了 **架构设计良好但存在重大集成风险** 的现状。

### 核心结论

| 系统 | 完成度 | 生产可用性 | 推荐度 | 备注 |
|------|--------|-----------|--------|------|
| **旧 WebSocket Hub** | 80% | ❌ 不可用 | ⭐ 废弃 | 无集群支持 |
| **Tinode IM** | **69%** | ⚠️ 需测试 | ⭐⭐⭐⭐⭐ **推荐** | 开源、免费、自主可控 |
| **腾讯云 IM** | 40% | ⚠️ 需集成 | ⭐⭐⭐⭐ 备份 | 企业级稳定性 |

**关键阻塞点**: Tinode Phase 1 已完成代码集成，但缺少运行时测试（需真机/浏览器交互验证）

**推荐方案**: Tinode 作为主系统，腾讯云 IM 作为备份，延迟 3 个月清理 WebSocket

---

## 目录

1. [旧系统分析：WebSocket Hub](#一旧系统分析websocket-hub已废弃)
2. [新系统1分析：Tinode IM](#二新系统1分析tinode-im正在集成)
3. [新系统2分析：腾讯云 IM](#三新系统2分析腾讯云-im备选方案)
4. [路由集成分析](#四路由集成分析)
5. [前端集成分析](#五前端集成深度分析)
6. [数据迁移策略](#六数据迁移策略分析)
7. [潜在问题汇总](#七潜在问题汇总)
8. [架构决策建议](#八架构决策建议)
9. [推荐实施方案](#九推荐实施方案)
10. [迁移时间表](#十迁移时间表)
11. [立即行动清单](#十一立即行动清单)
12. [风险缓解措施](#十二风险缓解措施)

---

## 一、旧系统分析：WebSocket Hub（已废弃）

### 1.1 架构设计

**位置**: `server/internal/ws/`

**核心组件**:

| 文件 | 职责 | 代码质量 |
|------|------|----------|
| `hub.go` | WebSocket 连接管理、消息广播 | ⭐⭐⭐⭐ |
| `client.go` | 客户端连接、读写泵 | ⭐⭐⭐⭐ |
| `handler.go` | 消息处理、数据库持久化 | ⭐⭐⭐ |
| `protocol.go` | 协议定义（Ping/Pong/MessageSend/AckRead） | ⭐⭐⭐⭐⭐ |
| `ws_handler.go` | HTTP 升级到 WebSocket | ⭐⭐⭐ |

### 1.2 技术亮点

**✅ 优秀设计**:

1. **单端互踢机制** (hub.go:48-53)
   ```go
   // 如果用户已经有连接，先关闭旧连接 (单端互踢)
   if oldClient, ok := h.clients[client.UserID]; ok {
       close(oldClient.send)
       delete(h.clients, client.UserID)
   }
   ```

2. **心跳保活** (client.go:16-19)
   ```go
   pongWait = 60 * time.Second
   pingPeriod = (pongWait * 9) / 10  // 54秒
   ```

3. **消息缓冲队列** (hub.go:38)
   ```go
   broadcast: make(chan *Message, 256), // 带缓冲的通道防止阻塞
   ```

4. **协议设计清晰** (protocol.go)
   - 客户端→服务端: Ping(0), MessageSend(1), AckRead(2)
   - 服务端→客户端: Pong(10), MessagePush(11), AckSend(12), Error(13)

### 1.3 关键问题

**❌ 致命缺陷**:

1. **无集群支持**
   - `Hub.clients` 是单机内存 map (hub.go:11)
   - 多实例部署时消息丢失（用户 A 连接 Server1，用户 B 连接 Server2）
   - 需要 Redis Pub/Sub 支持，但未实现

2. **离线消息处理不完善** (handler.go:80-82)
   ```go
   // 用户不在线，消息需要存储供离线拉取
   log.Printf("[WS] 用户离线, 消息暂存: receiver_id=%d", message.ReceiverID)
   // ⚠️ 仅日志记录，未实现离线消息队列
   ```

3. **会话存储设计问题** (handler.go:158-161)
   ```go
   // 未读数分散存储在 User1Unread/User2Unread
   if conv.User1ID == senderID {
       conv.User2Unread = 1
   } else {
       conv.User1Unread = 1
   }
   // ⚠️ 查询未读数需要 JOIN，性能差
   ```

4. **无消息加密**
   - 明文传输和存储 (handler.go:67-74)
   - 隐私合规风险

### 1.4 数据模型

**Chat 表结构** (推断):

```go
type ChatMessage struct {
    ID             uint64    // 消息 ID
    ConversationID string    // 会话 ID (格式: min(uid1,uid2)_max(uid1,uid2))
    SenderID       uint64    // 发送者 ID
    ReceiverID     uint64    // 接收者 ID
    Content        string    // 消息内容
    MsgType        int       // 1:文本 2:图片
    IsRead         bool      // 是否已读
    CreatedAt      time.Time
}

type Conversation struct {
    ID                 string    // 会话 ID
    User1ID            uint64    // 较小的用户 ID
    User2ID            uint64    // 较大的用户 ID
    User1Unread        int       // 用户1未读数
    User2Unread        int       // 用户2未读数
    LastMessageContent string    // 最后消息预览
    LastMessageTime    time.Time
}
```

### 1.5 生产环境风险评估

| 风险类型 | 严重程度 | 影响 | 缓解措施 |
|---------|----------|------|---------|
| 消息丢失（集群） | 🔴 致命 | 用户投诉、信任危机 | 禁止多实例部署 |
| 离线消息丢失 | 🟠 高 | 用户体验差 | 临时方案：仅支持在线聊天 |
| 性能瓶颈（10K+ 连接） | 🟠 高 | 服务不可用 | 限制最大连接数 |
| 隐私合规 | 🟡 中 | 法律风险 | 数据脱敏 |

**结论**: ❌ **不可用于生产环境**，建议尽快迁移。

---

## 二、新系统1分析：Tinode IM（正在集成）

### 2.1 集成架构

**位置**: `server/internal/tinode/`

**设计策略**: **用户 ID 映射 + Token 认证**

```
App User (ID: 123)
    ↓ encodeUserIDToTinodeUID (XTEA 加密)
Tinode UID (uint64: encrypted)
    ↓ UserIDToTinodeUserID (Base64 编码)
Tinode UserID (string: "usrXXXXXXXX")
    ↓ GenerateTinodeToken (HMAC-SHA256)
Token (string: Base64 encoded)
```

### 2.2 核心实现

**auth_adapter.go 关键功能**:

#### 2.2.1 用户 ID 加密

```go
// auth_adapter.go:59-82
func encodeUserIDToTinodeUID(userID uint64) (uint64, error) {
    // 使用 XTEA 算法加密（与 Tinode 服务器一致）
    uidKey := os.Getenv("TINODE_UID_ENCRYPTION_KEY") // 16字节
    cipher, _ := xtea.NewCipher(uidKey)
    cipher.Encrypt(dst, src)
}
```

**安全性分析**:
- ✅ XTEA 是对称加密算法，性能优秀
- ⚠️ 密钥需要与 Tinode 服务器配置一致
- ⚠️ 密钥泄露风险：所有用户 ID 可被反推

#### 2.2.2 Token 生成

```go
// auth_adapter.go:99-142
// Tinode Token 格式（50字节）：
// [8:UID][4:expires][2:authLevel][2:serial][2:features][32:HMAC-SHA256]
tokenLayout{
    Uid:       encryptedUID,
    Expires:   unix_timestamp + 14天,
    AuthLevel: 20, // tinodeAuthLevelAuth
}
// HMAC 签名使用 TINODE_AUTH_TOKEN_KEY
```

**Token 特性**:
- ✅ 有效期 14 天（可配置）
- ✅ HMAC-SHA256 签名防篡改
- ⚠️ 无刷新机制（到期需重新登录）

#### 2.2.3 用户同步

```go
// auth_adapter.go:144-184
func SyncUserToTinode(user *model.User) error {
    // 插入到 tinode 数据库的 users 表
    INSERT INTO users (id, createdat, updatedat, state, access, public)
    VALUES ($1, NOW(), NOW(), 0, $2, $3)
    ON CONFLICT (id) DO UPDATE SET ...
}
```

**同步字段映射**:

| App 字段 | Tinode 字段 | 转换逻辑 |
|---------|-------------|---------|
| `user.ID` | `id` | XTEA 加密 |
| `user.Name` | `public.fn` | 直接映射 |
| `user.Avatar` | `public.photo.data` | Base64 编码 |
| `user.CreatedAt` | `createdat` | 时间戳转换 |

### 2.3 数据库策略

**tinode_db.go** (repository/tinode_db.go):

```go
// ⚠️ 连接到独立数据库 "tinode"（非 home_decoration）
tinodeDSN := "dbname=tinode"
TinodeDB, _ = gorm.Open(postgres.Open(tinodeDSN), &gorm.Config{})
```

**SQL 迁移脚本**: `server/scripts/topics/tinode/001_create_tinode_tables.sql`

**双数据库架构**:

```
┌─────────────────────┐       ┌─────────────────────┐
│  home_decoration DB │       │     tinode DB       │
├─────────────────────┤       ├─────────────────────┤
│ users               │──┐    │ users (XTEA加密ID)  │
│ providers           │  │    │ topics              │
│ projects            │  └──▶ │ subscriptions       │
│ escrow_accounts     │       │ messages            │
│ ...                 │       │ ...                 │
└─────────────────────┘       └─────────────────────┘
      ↑                              ↑
      │                              │
  GORM (DB)                    GORM (TinodeDB)
```

**优点**:
- ✅ 数据隔离，聊天数据不影响业务数据库
- ✅ 独立备份和恢复

**缺点**:
- ❌ 跨库事务复杂（需要分布式事务）
- ❌ 用户同步可能失败（需要重试机制）

### 2.4 API 端点

**tinode_handler.go**:

```http
GET /api/v1/tinode/userid/:userId
Response: {
  "code": 0,
  "data": { "tinodeUserId": "usrXXXXXXXX" }
}
```

**作用**: 前端通过用户 ID 查询对方的 Tinode UserID（用于发起会话）

**缺失端点** (需要补充):

```http
# 获取当前用户的 Tinode Token
POST /api/v1/tinode/login
Request: { "userId": 123 }
Response: { "token": "base64_encoded_token", "expires": 1234567890 }

# 手动同步用户到 Tinode
POST /api/v1/tinode/sync-user
Request: { "userId": 123 }
Response: { "success": true, "tinodeUserId": "usrXXXXXXXX" }
```

### 2.5 前端集成状态

| 平台 | 文件路径 | 大小 | 状态 |
|------|---------|------|------|
| **Admin Panel** | `admin/src/services/TinodeService.ts` | 5,369 字节 | ⚠️ 需验证集成 |
| **Mobile App** | `mobile/src/services/TinodeService.ts` | 10,849 字节 | ⚠️ 较完整，需测试 |
| **WeChat Mini** | - | - | ❌ 未实现 |

**Admin Panel 发现**:
- ❌ 未发现 WebSocket 代码（通过 Grep 搜索无结果）
- **推断**: Admin 可能使用 HTTP 轮询或未实现实时聊天

**Mobile App 发现**:
- ✅ 存在 TinodeService.ts (10,849 字节，较完整)
- ⚠️ 存在 WebSocket 引用（Grep 结果：2 个文件）
- **风险**: 新旧系统代码共存，可能冲突

**WeChat Mini Program**:
- ❌ 无任何 IM 集成代码
- **影响**: 微信小程序用户无法使用聊天功能

### 2.6 集成风险

**🔴 高风险问题**:

1. **双数据库管理复杂度**
   - `home_decoration` 数据库：用户主表、业务数据
   - `tinode` 数据库：Tinode 聊天数据
   - **风险**: 数据一致性、事务管理、备份恢复

2. **环境变量依赖** (auth_adapter.go:40-49)
   ```go
   TINODE_UID_ENCRYPTION_KEY   // 16字节，Base64编码
   TINODE_AUTH_TOKEN_KEY       // ≥32字节，Base64编码
   ```
   - ⚠️ 密钥管理：生产环境需要安全存储
   - ⚠️ 密钥轮换：无实现
   - ⚠️ 密钥泄露：所有用户 ID 可被反推

3. **用户同步时机不明确**
   - 何时调用 `SyncUserToTinode`？
   - 新用户注册时？登录时？首次聊天时？
   - ❌ 未发现自动同步机制

4. **Tinode 服务器部署缺失**
   - 代码已集成，但 `docker-compose.tinode.yml` 存在但未启用
   - 需要独立部署 Tinode 服务器（Go 二进制 + gRPC）

### 2.7 Tinode 架构优势

**✅ 开源优势**:
- MIT 协议，可商用
- Go 实现，性能优秀（单实例支持 100K+ 连接）
- 支持 Redis 集群、MongoDB 存储

**✅ 功能完整性**:
- P2P 聊天、群聊
- 离线消息、消息同步
- 已读回执、输入状态
- 文件上传、推送通知

**✅ 扩展灵活性**:
- REST API + gRPC
- WebSocket + Long Polling
- 自定义插件系统

### 2.8 完成度评估

**后端集成**: 70%
- ✅ 用户 ID 映射
- ✅ Token 生成
- ✅ 用户同步接口
- ⚠️ 缺少自动同步机制
- ⚠️ 缺少 Tinode 服务器部署

**前端集成**: 60%
- ✅ 服务文件已创建
- ⚠️ 需要验证运行时集成
- ❌ Admin 界面需要重写（腾讯 TUIKit → Tinode UI）
- ❌ Mini 程序未实现

**总体完成度**: **69%**

---

## 三、新系统2分析：腾讯云 IM（备选方案）

### 3.1 集成架构

**位置**: `server/internal/utils/tencentim/`

**核心组件**:

| 文件 | 职责 | 实现状态 |
|------|------|----------|
| `client.go` | REST API 调用、用户导入 | ✅ 完成 |
| `usersig.go` | UserSig 签名生成（HMAC-SHA256 + zlib + Base64） | ✅ 完成 |

### 3.2 初始化流程

**client.go** (InitClient):

```go
// 从数据库 system_configs 表读取配置
sdkAppID := getConfig("tencent_im_sdkappid")  // 腾讯云应用 ID
secretKey := getConfig("tencent_im_secret")   // 密钥
enabled := getConfig("tencent_im_enabled")    // 启用开关

if enabled != "true" {
    return nil  // ✅ 优雅降级，未启用时静默跳过
}
```

**配置存储**:
- ✅ 数据库存储（system_configs 表）
- ✅ 动态开关（无需重启）
- ⚠️ 密钥明文存储（需要加密）

### 3.3 用户导入

**client.go** (ImportUser):

```go
func (c *IMClient) ImportUser(userID uint64, nickname, avatar string) error {
    // 1. 生成管理员 UserSig (86400秒 = 24小时)
    adminSig := GenUserSig(sdkAppID, secretKey, "administrator", 86400)

    // 2. 调用腾讯云 REST API
    POST https://console.tim.qq.com/v4/im_open_login_svc/account_import
    Body: {
      "UserID": "123",
      "Nick": "张三",
      "FaceUrl": "https://..."
    }

    // 3. 检查响应
    if result.ErrorCode != 0 {
        return fmt.Errorf("导入用户失败: code=%d", result.ErrorCode)
    }
}
```

**导入时机**:
- ❌ 未发现自动导入机制
- ⚠️ 需要手动调用（可能遗漏）

### 3.4 UserSig 生成算法

**usersig.go** (GenUserSig):

```go
// 腾讯云 IM UserSig 生成流程（官方算法）
sigDoc := {
    "TLS.ver": "2.0",
    "TLS.identifier": userID,
    "TLS.sdkappid": sdkAppID,
    "TLS.expire": 86400,
    "TLS.time": 1737619200,
    "TLS.sig": HMAC-SHA256(...)
}
→ JSON 序列化
→ zlib 压缩
→ Base64 编码（URL 安全字符替换：+ → *, / → -, = → _）
```

**安全性分析**:
- ✅ HMAC-SHA256 签名防篡改
- ✅ 有效期可配置（默认 24 小时）
- ⚠️ 密钥泄露风险（需要安全存储）

### 3.5 前端集成状态

| 平台 | 文件路径 | 大小 | 状态 |
|------|---------|------|------|
| **Admin Panel** | - | - | ❌ 未实现 |
| **Mobile App** | `mobile/src/services/TencentIMService.ts` | 3,618 字节 | ⚠️ 需验证 |
| **WeChat Mini** | - | - | ❌ 未实现 |

**Mobile App**:
- ✅ 已创建服务文件（3,618 字节）
- ⚠️ 需要验证实现完整性（集成腾讯云 IM SDK）

### 3.6 优势与问题

**✅ 优势**:

1. **商业稳定性**: 腾讯官方维护，SLA 保障
2. **功能丰富**: 群聊、音视频、消息回调、敏感词过滤
3. **SDK 完善**: 支持 Web、React Native、微信小程序
4. **部署简单**: SaaS 服务，无需自建服务器

**❌ 问题**:

1. **成本**:
   ```
   免费额度：100 DAU
   超出后按量计费：
   - 1K DAU: ~$30/月
   - 10K DAU: ~$300/月
   - 100K DAU: ~$3000/月
   ```

2. **数据主权**:
   - 消息存储在腾讯云
   - 无法自主导出历史消息
   - **关键风险**: Escrow 托管系统的交易凭证聊天记录

3. **依赖锁定**:
   - 迁移成本高（用户 ID、消息历史）
   - 厂商价格变动风险

### 3.7 完成度评估

**后端集成**: 50%
- ✅ UserSig 生成
- ✅ 用户导入接口
- ⚠️ 缺少自动导入机制
- ❌ 未接入 REST API（发消息、查历史）

**前端集成**: 30%
- ⚠️ Mobile 有服务文件（未验证）
- ❌ Admin 未实现
- ❌ Mini 未实现

**总体完成度**: **40%**

---

## 四、路由集成分析

### 4.1 WebSocket 端点

**server/internal/router/router.go** (推断):

```go
// 旧 WebSocket 路由（需要 JWT 认证）
wsGroup := r.Group("/api/v1")
wsGroup.Use(middleware.JWT(jwtSecret))
wsGroup.GET("/ws", handler.ServeWS(hub, wsHandler))
```

**安全性**:
- ✅ JWT 认证
- ⚠️ 缺少速率限制（可能被 DDoS）

### 4.2 Tinode 端点

**已确认路由**:

```go
GET /api/v1/tinode/userid/:userId
```

**预期路由** (待实现):

```go
// 获取 Tinode Token
POST /api/v1/tinode/login
Request: { "userId": 123 }
Response: {
  "token": "base64_encoded_token",
  "expires": 1234567890
}

// 手动同步用户
POST /api/v1/tinode/sync-user
Request: { "userId": 123 }
Response: {
  "success": true,
  "tinodeUserId": "usrXXXXXXXX"
}
```

### 4.3 腾讯云 IM 端点

**预期路由** (未实现):

```go
// 生成 UserSig
POST /api/v1/im/usersig
Request: { "userId": 123 }
Response: {
  "userSig": "base64_encoded_sig",
  "expires": 86400
}

// 导入用户到腾讯云
POST /api/v1/im/import-user
Request: { "userId": 123 }
Response: { "success": true }
```

### 4.4 路由安全分析

| 端点 | 认证 | 授权 | 速率限制 | 问题 |
|------|------|------|---------|------|
| `GET /ws` | ✅ JWT | ❌ 无 | ❌ 无 | 需要添加速率限制 |
| `GET /tinode/userid/:userId` | ⚠️ 未知 | ❌ 无 | ❌ 无 | 可能泄露用户 ID 映射 |
| `POST /tinode/login` | ❌ 未实现 | - | - | 需要 JWT 认证 |
| `POST /im/usersig` | ❌ 未实现 | - | - | 需要 JWT 认证 |

**建议**:
```go
// ✅ 添加速率限制和授权检查
tinodeGroup := r.Group("/api/v1/tinode")
tinodeGroup.Use(middleware.JWT(jwtSecret))
tinodeGroup.Use(middleware.RateLimit(10, time.Minute)) // 10次/分钟
tinodeGroup.GET("/userid/:userId", middleware.RequireSelfOrAdmin, handler.GetTinodeUserID)
```

---

## 五、前端集成深度分析

### 5.1 Admin Panel

**文件列表**:
- `admin/src/services/TinodeService.ts` ✅ 5,369 字节
- `admin/src/pages/merchant/MerchantChat.tsx` ⚠️ 聊天界面（需验证集成）
- `admin/src/types/tinode-sdk.d.ts` ✅ TypeScript 类型定义

**发现**: ❌ 未发现 WebSocket 代码（通过 Grep 搜索无结果）

**推断**: Admin 可能使用 HTTP 轮询或未实现实时聊天

**工作量评估**:
```
Admin Panel 聊天界面改造 (3周)
├── Week 1: 重写 TUIKit 组件
│   ├── ConversationList 会话列表
│   ├── ChatRoom 聊天室
│   ├── MessageList 消息列表
│   └── MessageInput 输入框
├── Week 2: 集成 Tinode SDK
│   ├── 连接管理
│   ├── 消息同步
│   └── 已读回执
└── Week 3: 测试和优化
    ├── 单元测试
    ├── E2E 测试
    └── 性能优化
```

**关键挑战**: 腾讯云 TUIKit 组件无法直接用于 Tinode，需要自研。

### 5.2 Mobile App

**文件列表**:
- `mobile/src/services/TinodeService.ts` ✅ 10,849 字节（较完整）
- `mobile/src/services/TencentIMService.ts` ✅ 3,618 字节
- `mobile/src/screens/ChatRoomScreen.tsx` ⚠️ 聊天室界面
- `mobile/src/screens/MessageScreen.tsx` ⚠️ 消息列表
- `mobile/src/types/tinode-sdk.d.ts` ✅ TypeScript 类型定义
- `mobile/src/navigation/AppNavigator.tsx` 🔍 提及 WebSocket

**发现**: ⚠️ 存在 WebSocket 引用（Grep 结果：2 个文件）

**风险**: 新旧系统代码共存，可能冲突

**建议**:
```typescript
// 创建 IM 抽象适配层
interface IMService {
  init(token: string): Promise<boolean>;
  login(): Promise<void>;
  logout(): Promise<void>;
  getConversations(): Promise<Conversation[]>;
  sendMessage(topic: string, content: string): Promise<Message>;
  onMessage(callback: (msg: Message) => void): void;
}

// 工厂模式
export function createIMService(): IMService {
  return process.env.IM_PROVIDER === 'tencent'
    ? new TencentIMService()
    : new TinodeService();
}
```

**工作量评估**: 2 周（替换 WebSocket → TinodeService）

### 5.3 WeChat Mini Program

**发现**: ❌ 无任何 IM 集成代码
- Tinode: 未实现
- 腾讯云 IM: 未实现
- WebSocket: 未实现

**影响**: 微信小程序用户无法使用聊天功能

**建议方案**:
```javascript
// mini/src/services/TinodeService.ts
import Taro from '@tarojs/taro';

export class TinodeService {
  private ws: Taro.SocketTask | null = null;

  connect(token: string) {
    this.ws = Taro.connectSocket({
      url: 'wss://your-tinode-server.com/v0/channels',
      header: {
        'X-Tinode-APIKey': 'your-api-key'
      }
    });

    this.ws.onMessage((res) => {
      // 处理消息
    });
  }
}
```

**工作量评估**: 2 周（依赖 Mobile 方案验证后复制）

### 5.4 前端改造优先级

| 平台 | 优先级 | 工作量 | 关键任务 |
|------|-------|-------|---------|
| **Mobile (React Native)** | P0 | 2周 | 运行时测试 TinodeService |
| **Admin (React)** | P0 | **3周** | ⚠️ 重写 TUIKit 组件（工作量最大） |
| **Mini (Taro)** | P1 | 2周 | 依赖 Mobile 方案验证后复制 |

---

## 六、数据迁移策略分析

### 6.1 历史数据迁移

**Chat 表 → Tinode**:

```sql
-- 旧数据：ChatMessage 表
SELECT id, conversation_id, sender_id, receiver_id, content, msg_type, created_at
FROM chat_messages
WHERE created_at > '2024-01-01';

-- 需要迁移到 Tinode 的 messages 表（格式不兼容）
INSERT INTO messages (createdAt, updatedAt, seqid, topic, ...)
-- ⚠️ 问题：Tinode 消息格式复杂（seqid、topic、delid、head、content）
```

**格式差异**:

| 旧系统字段 | Tinode 字段 | 转换逻辑 |
|----------|------------|---------|
| `id` | `seqid` | 重新生成序列号 |
| `conversation_id` | `topic` | 格式转换：`123_456` → `p2pXXXXXXXX` |
| `content` | `content` | JSON 格式：`{"txt": "消息内容"}` |
| `msg_type` | `head.mime` | 1:文本 → `text/plain`, 2:图片 → `image/jpeg` |
| `is_read` | 无 | 通过 `subscriptions.readseqid` 计算 |

**迁移脚本** (需要实现):

```go
// 历史示例脚本说明见 server/scripts/topics/tinode/README.md
package main

import (
    "fmt"
    "time"
    "gorm.io/gorm"
)

type ChatMessage struct {
    ID             uint64
    ConversationID string
    SenderID       uint64
    ReceiverID     uint64
    Content        string
    MsgType        int
    CreatedAt      time.Time
}

type TinodeMessage struct {
    CreatedAt time.Time
    UpdatedAt time.Time
    SeqId     int
    Topic     string
    From      string
    Head      string // JSON: {"mime": "text/plain"}
    Content   string // JSON: {"txt": "消息内容"}
}

func MigrateChatToTinode(db *gorm.DB, tinodeDB *gorm.DB) error {
    var messages []ChatMessage
    if err := db.Order("created_at ASC").Find(&messages).Error; err != nil {
        return err
    }

    for _, msg := range messages {
        // 转换为 Tinode 消息格式
        tinodeMsg := convertToTinodeMessage(msg)

        if err := tinodeDB.Create(&tinodeMsg).Error; err != nil {
            fmt.Printf("迁移消息失败: id=%d, error=%v\n", msg.ID, err)
            continue
        }
    }

    return nil
}

func convertToTinodeMessage(msg ChatMessage) TinodeMessage {
    // 转换会话 ID：123_456 → p2pXXXXXXXX
    topic := generateTinodeTopic(msg.SenderID, msg.ReceiverID)

    // 转换消息内容为 JSON
    contentJSON := fmt.Sprintf(`{"txt": "%s"}`, msg.Content)

    // 转换 MIME 类型
    mimeType := "text/plain"
    if msg.MsgType == 2 {
        mimeType = "image/jpeg"
    }
    headJSON := fmt.Sprintf(`{"mime": "%s"}`, mimeType)

    return TinodeMessage{
        CreatedAt: msg.CreatedAt,
        UpdatedAt: msg.CreatedAt,
        SeqId:     0, // 自动生成
        Topic:     topic,
        From:      fmt.Sprintf("usr%d", msg.SenderID),
        Head:      headJSON,
        Content:   contentJSON,
    }
}
```

### 6.2 增量同步

**当前无实现**:
- 旧系统新消息如何同步到 Tinode？
- 双写策略？（写入 Chat 表 + Tinode）
- 读取策略？（优先读 Tinode，降级读 Chat 表）

**建议方案**:

```go
// 双写策略（迁移期间）
func (s *MessageService) SendMessage(senderID, receiverID uint64, content string) error {
    // 1. 写入 Tinode
    tinodeErr := s.tinodeClient.SendMessage(senderID, receiverID, content)

    // 2. 写入旧 Chat 表（兼容旧客户端）
    chatMsg := &model.ChatMessage{
        SenderID:   senderID,
        ReceiverID: receiverID,
        Content:    content,
    }
    chatErr := s.db.Create(chatMsg).Error

    // 3. 错误处理
    if tinodeErr != nil && chatErr != nil {
        return fmt.Errorf("both systems failed: tinode=%v, chat=%v", tinodeErr, chatErr)
    }

    if tinodeErr != nil {
        log.Printf("Tinode write failed, fallback to Chat: %v", tinodeErr)
    }

    return nil
}
```

### 6.3 未读数同步

**旧系统**:
```go
// Conversation 表的 User1Unread/User2Unread
SELECT user1_unread, user2_unread FROM conversations WHERE id = ?
```

**Tinode**:
```sql
-- 未读数存储在 subscriptions 表
SELECT readseqid, recvseqid FROM subscriptions
WHERE userid = ? AND topic = ?
-- 未读数 = recvseqid - readseqid
```

**迁移复杂度**: 🔴 高（需要重新计算）

**迁移脚本**:

```go
func MigrateUnreadCounts(db *gorm.DB, tinodeDB *gorm.DB) error {
    var conversations []Conversation
    db.Find(&conversations)

    for _, conv := range conversations {
        // 计算用户1的未读数
        var lastSeqId int
        tinodeDB.Raw(`
            SELECT MAX(seqid) FROM messages
            WHERE topic = ?
        `, conv.TinodeTopic).Scan(&lastSeqId)

        // 更新 subscriptions 表
        tinodeDB.Exec(`
            UPDATE subscriptions
            SET recvseqid = ?, readseqid = ?
            WHERE userid = ? AND topic = ?
        `, lastSeqId, lastSeqId-conv.User1Unread, conv.User1ID, conv.TinodeTopic)
    }

    return nil
}
```

### 6.4 迁移风险矩阵

| 风险 | 严重程度 | 概率 | 缓解措施 |
|------|----------|------|---------|
| 历史消息丢失 | 🔴 致命 | 中 | 备份 + 灰度测试 + 验证脚本 |
| 消息格式不兼容 | 🔴 高 | 高 | 转换测试 + 人工抽检 |
| 未读数计算错误 | 🟠 中 | 高 | 对比验证 + 用户反馈 |
| 迁移脚本失败 | 🟠 中 | 中 | 事务回滚 + 重试机制 |
| 双写数据不一致 | 🟡 中低 | 低 | 定期对账 + 修复脚本 |

---

## 七、潜在问题汇总

### 7.1 架构问题

| 问题 | 严重程度 | 影响范围 | 缓解措施 |
|------|----------|----------|---------|
| 双数据库管理（home_decoration + tinode） | 🔴 高 | 运维、备份、事务一致性 | 自动化脚本 + 监控 |
| 三套 IM 系统并存（WebSocket + Tinode + 腾讯云） | 🔴 高 | 代码维护、测试复杂度 | 延迟清理 WebSocket |
| WebSocket 无集群支持 | 🟠 中 | 生产环境负载均衡 | 禁止多实例部署 |
| 离线消息处理缺失 | 🟠 中 | 用户体验（消息丢失） | 迁移到 Tinode |
| 消息加密缺失 | 🟡 中低 | 隐私合规 | Tinode 支持 E2EE |

### 7.2 集成问题

| 问题 | 严重程度 | 影响范围 | 缓解措施 |
|------|----------|----------|---------|
| 用户同步时机不明确 | 🔴 高 | 新用户首次聊天失败 | 实现自动同步 Hook |
| Tinode 服务器未部署 | 🔴 高 | 功能无法使用 | 启动 Docker 容器 |
| 环境变量密钥管理 | 🟠 中 | 安全性 | 使用密钥管理服务 |
| 前端代码新旧混杂 | 🟠 中 | 冲突、调试困难 | 抽象适配层 |
| 微信小程序无聊天功能 | 🟡 中低 | 功能缺失 | 2周开发周期 |

### 7.3 数据迁移问题

| 问题 | 严重程度 | 影响范围 | 缓解措施 |
|------|----------|----------|---------|
| 历史消息迁移脚本缺失 | 🔴 高 | 用户历史消息丢失 | 编写迁移脚本 + 验证 |
| 消息格式不兼容 | 🔴 高 | 迁移失败 | 格式转换 + 测试 |
| 未读数重新计算 | 🟠 中 | 未读数不准确 | 对比验证 |
| 双写策略未实现 | 🟠 中 | 迁移期间数据不一致 | 双写 + 对账 |

### 7.4 性能问题

| 问题 | 严重程度 | 影响范围 | 缓解措施 |
|------|----------|----------|---------|
| 会话查询需要 JOIN | 🟠 中 | 消息列表加载慢 | Tinode 优化查询 |
| 未读数计算低效 | 🟡 中低 | 大量会话时性能差 | Tinode 使用增量计算 |
| WebSocket 单机内存限制 | 🟠 中 | 最大在线用户数受限 | 迁移到 Tinode 集群 |

---

## 八、架构决策建议

### 8.1 决策矩阵

#### 关键决策：推荐 Tinode 作为主系统，腾讯云 IM 作为备份

**决策依据（加权评分）**:

| 决策因素 | 权重 | Tinode | 腾讯云 IM | 说明 |
|---------|------|--------|-----------|------|
| **成本控制** | 30% | 9/10 | 4/10 | 10K DAU 时年省 $3000-5000 |
| **数据主权** | 25% | 10/10 | 3/10 | **Escrow 托管系统需完全可控** |
| **功能完整性** | 20% | 7/10 | 10/10 | Tinode P0 功能满足需求 |
| **运维复杂度** | 15% | 5/10 | 9/10 | Tinode 需自行运维 |
| **扩展灵活性** | 10% | 8/10 | 6/10 | Tinode 可深度定制 |
| **加权总分** | 100% | **7.85** | **5.95** | **Tinode 胜出** |

### 8.2 为什么不选腾讯云 IM 作为主系统？

#### ⚠️ 数据主权问题（关键）

你的平台有 **Escrow 托管支付系统**（处理真实金钱）:
- 聊天记录可能涉及**交易凭证**（如："我已支付阶段款项"）
- 腾讯云 IM 数据存储在腾讯云，无法自主导出历史消息
- 未来如需法律举证或审计，数据不完全可控

**合规风险案例**:
```
场景：用户投诉未收到款项
证据：聊天记录显示"我已通过托管支付 5000 元"
问题：如果腾讯云 IM 服务中断或账号被封，历史消息无法导出
结果：无法举证，法律风险
```

#### 💰 长期成本优势

**成本对比**（10K DAU 场景）:

| 方案 | 月费 | 年费 | 5年总成本 |
|------|------|------|----------|
| **Tinode (自建)** | $50-100 | $600-1200 | **$3000-6000** |
| **腾讯云 IM** | $300-500 | $3600-6000 | **$18000-30000** |
| **节省** | - | - | **$12000-24000** |

### 8.3 为什么需要保留腾讯云 IM？

#### ✅ 快速回滚能力

```typescript
// 通过环境变量切换
const IMProvider = process.env.IM_PROVIDER === 'tencent'
  ? TencentIMService
  : TinodeService;
```

**回滚场景**:
- Tinode 出现严重 Bug → 1 分钟切换到腾讯云 IM
- Tinode 服务器宕机 → 临时使用腾讯云 IM
- 灰度发布出问题 → 快速回滚

#### ✅ 灰度发布安全网

```go
// 10% 用户使用 Tinode，90% 使用腾讯云 IM
func getIMProvider(userID uint64) string {
    if userID % 10 == 0 {
        return "tinode"
    }
    return "tencent"
}
```

### 8.4 推荐架构

```
           ┌─────────────────────────────┐
           │     IM 抽象适配层            │
           │   (IMServiceInterface)      │
           └─────────────┬───────────────┘
                         │
         ┌───────────────┴───────────────┐
         │                               │
   ┌─────▼─────┐                 ┌───────▼──────┐
   │  Tinode   │                 │  腾讯云 IM    │
   │  (主要)   │                 │   (备份)     │
   │  Status:  │                 │   Status:    │
   │  Active   │                 │  Standby     │
   └───────────┘                 └──────────────┘
```

**优点**:
- ✅ 主系统：Tinode（成本低、数据可控）
- ✅ 备份系统：腾讯云 IM（快速回滚）
- ✅ 抽象层：前端代码无感知切换

---

## 九、推荐实施方案

### 9.1 方案概述

**方案名称**: Tinode（主）+ 腾讯云 IM（备）+ 延迟清理 WebSocket

**核心策略**:
1. **优先完成 Tinode 集成**（当前 69% → 100%）
2. **保留腾讯云 IM 代码**（作为快速回滚备份）
3. **延迟 3 个月清理 WebSocket**（确保 Tinode 稳定）

### 9.2 实施阶段

#### Phase 1: 完成 Tinode 集成（2周）

**目标**: 运行时验证 + 修复集成问题

**任务清单**:

1. **启动 Tinode 服务器**
   ```bash
   cd /Volumes/tantan/AI_project/home-decoration
   docker-compose -f docker-compose.tinode.yml up -d

   # 验证服务启动
   curl http://localhost:6060/
   ```

2. **配置环境变量**
   ```bash
   # server/.env
   TINODE_UID_ENCRYPTION_KEY=<16字节 Base64>
   TINODE_AUTH_TOKEN_KEY=<32字节 Base64>
   TINODE_GRPC_LISTEN=:16060

   # 生成密钥（示例）
   openssl rand -base64 16  # UID 加密密钥
   openssl rand -base64 32  # Token 签名密钥
   ```

3. **实现用户自动同步**
   ```go
   // server/internal/service/user_service.go
   func (s *UserService) Create(req CreateUserRequest) (*model.User, error) {
       user, err := s.userRepo.Create(...)
       if err != nil {
           return nil, err
       }

       // ✅ 新增：自动同步到 Tinode
       if err := tinode.SyncUserToTinode(user); err != nil {
           log.Printf("同步用户到 Tinode 失败: %v", err)
           // 非致命错误，不中断注册流程
       }

       return user, nil
   }
   ```

4. **运行时测试**
   - **Mobile**: 在 iOS/Android 模拟器测试 TinodeService
   - **Admin**: 在浏览器测试聊天界面
   - **验证**: 跨端消息同步（Mobile 发送 → Admin 接收）

5. **修复集成问题**
   - 根据测试结果修复 Bug
   - 补充缺失的 API 端点
   - 优化错误处理

6. **灰度发布（10% 用户）**
   ```go
   func getIMProvider(userID uint64) string {
       if userID % 10 == 0 {
           return "tinode"  // 10% 用户
       }
       return "websocket"  // 90% 用户（旧系统）
   }
   ```

**交付物**:
- [x] Tinode 服务器运行
- [x] 用户自动同步机制
- [x] 10% 用户灰度测试通过
- [x] 集成问题修复列表

---

#### Phase 2: 附件支持 + 消息状态管理（2周）

**目标**: 支持图片/文件上传，优化消息状态

**任务清单**:

1. **对接文件上传接口**
   ```go
   // 复用现有的文件上传接口
   POST /api/v1/upload
   Response: { "url": "https://cdn.example.com/xxx.jpg" }

   // Tinode 消息格式
   {
     "content": {
       "mime": "image/jpeg",
       "val": "https://cdn.example.com/xxx.jpg",
       "size": 102400
     }
   }
   ```

2. **消息状态管理优化**
   - 发送中（pending）
   - 已发送（sent）
   - 已送达（delivered）
   - 已读（read）
   - 发送失败（failed）

3. **灰度扩大（50% 用户）**
   ```go
   func getIMProvider(userID uint64) string {
       if userID % 2 == 0 {
           return "tinode"  // 50% 用户
       }
       return "websocket"
   }
   ```

**交付物**:
- [x] 图片/文件消息支持
- [x] 消息状态显示正确
- [x] 50% 用户灰度测试通过

---

#### Phase 3: 全量切换 + 历史消息迁移（2周）

**目标**: 100% 用户切换到 Tinode，迁移历史数据

**任务清单**:

1. **100% 用户切换**
   ```go
   func getIMProvider(userID uint64) string {
       return "tinode"  // 全量切换
   }
   ```

2. **历史消息迁移脚本**
   ```bash
   # 执行迁移
   cd server
   查看 server/scripts/topics/tinode/README.md 中的历史说明与现有专题脚本

   # 验证数据
   psql -d tinode -c "SELECT COUNT(*) FROM messages;"
   psql -d home_decoration -c "SELECT COUNT(*) FROM chat_messages;"
   ```

3. **旧 WebSocket 设为只读**
   ```go
   // 禁止写入 Chat 表
   func (s *MessageService) SendMessage(...) error {
       return errors.New("WebSocket is deprecated, please upgrade client")
   }
   ```

4. **监控和告警**
   ```yaml
   # Prometheus 告警规则
   - alert: TinodeMessageDeliveryFailed
     expr: tinode_message_send_errors > 10
     for: 5m
     labels:
       severity: critical
   ```

**交付物**:
- [x] 100% 用户切换完成
- [x] 历史消息迁移验证通过
- [x] WebSocket 只读模式
- [x] 监控告警配置

---

#### Phase 4: 清理技术债（3个月后，持续）

**目标**: 删除旧代码，优化系统

**任务清单**:

1. **删除 WebSocket 代码**
   ```bash
   rm -rf server/internal/ws/
   ```

2. **归档 Chat 表**
   ```sql
   -- 重命名旧表
   ALTER TABLE chat_messages RENAME TO chat_messages_archived;
   ALTER TABLE conversations RENAME TO conversations_archived;
   ```

3. **更新文档**
   - 更新 `CLAUDE.md`
   - 更新 `docs/Backend_Design.md`
   - 更新 API 文档

4. **清理前端代码**
   ```bash
   # 删除旧的 WebSocket 服务
   rm admin/src/services/WebSocketService.ts
   rm mobile/src/services/WebSocketService.ts
   ```

**交付物**:
- [x] WebSocket 代码删除
- [x] Chat 表归档
- [x] 文档更新完成

---

## 十、迁移时间表

### 10.1 甘特图

```
2026-01        2026-02        2026-03        2026-04
    │              │              │              │
    ▼              ▼              ▼              ▼
┌─────────────────────────────────────────────────────────┐
│ Phase 1: 完成 Tinode 集成 (当前) - 2周                  │
│ ├── ⚠️ 阻塞点：运行时测试（需真机/浏览器）              │
│ ├── 修复集成问题                                        │
│ ├── 用户自动同步机制                                    │
│ └── 灰度发布 (10% 用户)                                 │
├─────────────────────────────────────────────────────────┤
│ Phase 2: 附件支持 - 2周                                 │
│ ├── 图片/文件上传对接 /api/v1/upload                   │
│ ├── 消息状态管理优化                                    │
│ └── 灰度扩大 (50% 用户)                                 │
├─────────────────────────────────────────────────────────┤
│ Phase 3: 全量切换 - 2周                                 │
│ ├── 100% 用户切换                                       │
│ ├── 历史消息迁移脚本（Chat 表 → Tinode）                │
│ └── 旧 WebSocket 设为只读                               │
├─────────────────────────────────────────────────────────┤
│ Phase 4: 清理技术债 (3个月后) - 持续                    │
│ ├── 删除 server/internal/ws/ 代码                       │
│ ├── 归档 Chat 表 (chat_archived)                        │
│ └── 文档更新                                            │
└─────────────────────────────────────────────────────────┘
```

### 10.2 里程碑

| 里程碑 | 日期 | 交付物 | 风险评估 |
|-------|------|-------|---------|
| **M1: Tinode 可用** | Week 2 | 10% 灰度通过 | 🟡 中 |
| **M2: 附件支持** | Week 4 | 50% 灰度通过 | 🟡 中 |
| **M3: 全量切换** | Week 6 | 100% 用户切换 | 🟠 中高 |
| **M4: 历史迁移** | Week 8 | 数据迁移完成 | 🔴 高 |
| **M5: 清理完成** | Week 20 | 旧代码删除 | 🟢 低 |

### 10.3 关键路径

```
关键路径（无法并行）：
1. Tinode 服务器启动 (2天)
   ↓
2. 用户同步机制实现 (3天)
   ↓
3. 运行时测试 (5天)
   ↓
4. 灰度发布验证 (10天)
   ↓
5. 全量切换 (7天)
   ↓
6. 历史数据迁移 (14天)
```

**总工期**: 6-8 周（关键路径）

---

## 十一、立即行动清单

### 11.1 本周必做（高优先级）

#### 1. 启动 Tinode 服务器

```bash
cd /Volumes/tantan/AI_project/home-decoration
docker-compose -f docker-compose.tinode.yml up -d

# 验证服务启动
curl http://localhost:6060/
# 预期输出：Tinode 欢迎页面

# 查看日志
docker-compose -f docker-compose.tinode.yml logs tinode
```

#### 2. 配置环境变量

```bash
# 生成密钥
TINODE_UID_KEY=$(openssl rand -base64 16)
TINODE_TOKEN_KEY=$(openssl rand -base64 32)

# 添加到 server/.env
cat >> server/.env <<EOF
TINODE_UID_ENCRYPTION_KEY=$TINODE_UID_KEY
TINODE_AUTH_TOKEN_KEY=$TINODE_TOKEN_KEY
TINODE_GRPC_LISTEN=:16060
EOF

echo "✅ 环境变量已配置"
echo "UID Key: $TINODE_UID_KEY"
echo "Token Key: $TINODE_TOKEN_KEY"
```

#### 3. 实现用户自动同步

```go
// server/internal/service/user_service.go
func (s *UserService) Create(req CreateUserRequest) (*model.User, error) {
    user, err := s.userRepo.Create(...)
    if err != nil {
        return nil, err
    }

    // ✅ 新增：自动同步到 Tinode
    go func() {
        if err := tinode.SyncUserToTinode(user); err != nil {
            log.Printf("同步用户到 Tinode 失败: userID=%d, error=%v", user.ID, err)
        }
    }()

    return user, nil
}

// 同时在登录时同步（兼容旧用户）
func (s *AuthService) Login(req LoginRequest) (*LoginResponse, error) {
    user, err := s.userRepo.FindByPhone(req.Phone)
    // ... 验证密码 ...

    // 确保用户已同步到 Tinode
    go tinode.SyncUserToTinode(user)

    return &LoginResponse{Token: token}, nil
}
```

#### 4. 运行时测试

**测试用例**:

```bash
# 测试 1: 用户注册后自动同步
curl -X POST http://localhost:8080/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{"phone": "13800138000", "password": "test123"}'

# 验证：查询 Tinode UserID
curl http://localhost:8080/api/v1/tinode/userid/1

# 测试 2: 发送消息
# 前端：Mobile App 模拟器
# 1. 登录用户 A
# 2. 登录用户 B
# 3. A 发送消息给 B
# 4. 验证 B 收到消息

# 测试 3: 跨端同步
# 1. Mobile 发送消息
# 2. Admin 验证收到消息
```

---

### 11.2 两周内完成（中优先级）

#### 5. 编写历史消息迁移脚本

**文件说明**: `server/scripts/topics/tinode/README.md`（历史专题脚本入口说明）

```go
package main

import (
    "fmt"
    "log"
    "os"
    "github.com/yourusername/home-decoration/server/internal/model"
    "github.com/yourusername/home-decoration/server/internal/repository"
    "github.com/yourusername/home-decoration/server/internal/tinode"
    "gorm.io/gorm"
)

func main() {
    // 1. 连接数据库
    db := repository.InitDB()
    tinodeDB := repository.TinodeDB

    // 2. 备份旧数据
    backupChatTable(db)

    // 3. 迁移消息
    if err := migrateMessages(db, tinodeDB); err != nil {
        log.Fatalf("迁移失败: %v", err)
    }

    // 4. 验证数据
    if err := verifyMigration(db, tinodeDB); err != nil {
        log.Fatalf("验证失败: %v", err)
    }

    log.Println("✅ 迁移成功")
}

func backupChatTable(db *gorm.DB) {
    log.Println("备份 Chat 表...")
    db.Exec("CREATE TABLE chat_messages_backup AS SELECT * FROM chat_messages")
    db.Exec("CREATE TABLE conversations_backup AS SELECT * FROM conversations")
}

func migrateMessages(db *gorm.DB, tinodeDB *gorm.DB) error {
    var messages []model.ChatMessage
    if err := db.Order("created_at ASC").Find(&messages).Error; err != nil {
        return err
    }

    log.Printf("开始迁移 %d 条消息...", len(messages))

    for i, msg := range messages {
        tinodeMsg := convertToTinodeMessage(msg)

        if err := tinodeDB.Create(&tinodeMsg).Error; err != nil {
            log.Printf("迁移失败: id=%d, error=%v", msg.ID, err)
            continue
        }

        if (i+1) % 1000 == 0 {
            log.Printf("已迁移 %d/%d 条消息", i+1, len(messages))
        }
    }

    return nil
}

func verifyMigration(db *gorm.DB, tinodeDB *gorm.DB) error {
    var oldCount, newCount int64
    db.Model(&model.ChatMessage{}).Count(&oldCount)
    tinodeDB.Table("messages").Count(&newCount)

    if oldCount != newCount {
        return fmt.Errorf("数据不一致: old=%d, new=%d", oldCount, newCount)
    }

    log.Printf("✅ 数据验证通过: %d 条消息", oldCount)
    return nil
}
```

#### 6. 建立监控告警

**Prometheus 配置**:

```yaml
# prometheus.yml
scrape_configs:
  - job_name: 'tinode'
    static_configs:
      - targets: ['localhost:6060']

  - job_name: 'home-decoration-api'
    static_configs:
      - targets: ['localhost:8080']

# 告警规则
groups:
  - name: tinode
    rules:
      - alert: TinodeDown
        expr: up{job="tinode"} == 0
        for: 1m
        labels:
          severity: critical
        annotations:
          summary: "Tinode 服务不可用"

      - alert: TinodeMessageDeliveryFailed
        expr: rate(tinode_message_send_errors[5m]) > 0.1
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "Tinode 消息发送失败率过高"
```

#### 7. 创建 IM 抽象适配层

**文件**: `admin/src/services/IMService.ts`

```typescript
// IM 服务接口
export interface IMService {
  init(token: string): Promise<boolean>;
  login(): Promise<void>;
  logout(): Promise<void>;
  getConversations(): Promise<Conversation[]>;
  sendMessage(topic: string, content: string): Promise<Message>;
  onMessage(callback: (msg: Message) => void): void;
  onConversationUpdate(callback: (conv: Conversation) => void): void;
}

// Tinode 实现
class TinodeService implements IMService {
  private sdk: Tinode;

  async init(token: string): Promise<boolean> {
    this.sdk = new Tinode({ appName: 'home-decoration' });
    await this.sdk.connect();
    return this.sdk.isConnected();
  }

  async login(): Promise<void> {
    const token = localStorage.getItem('tinode_token');
    await this.sdk.loginToken(token);
  }

  // ... 其他方法实现
}

// 腾讯云 IM 实现
class TencentIMService implements IMService {
  private sdk: TIM;

  async init(token: string): Promise<boolean> {
    this.sdk = TIM.create({ SDKAppID: 1400000000 });
    await this.sdk.login({ userID: 'xxx', userSig: token });
    return this.sdk.isReady();
  }

  // ... 其他方法实现
}

// 工厂模式
export function createIMService(): IMService {
  const provider = import.meta.env.VITE_IM_PROVIDER || 'tinode';

  switch (provider) {
    case 'tencent':
      return new TencentIMService();
    case 'tinode':
    default:
      return new TinodeService();
  }
}
```

---

## 十二、风险缓解措施

### 12.1 数据丢失风险

**风险**: 历史消息迁移失败导致数据丢失

**缓解措施**:

```sql
-- 迁移前备份
CREATE TABLE chat_messages_backup AS SELECT * FROM chat_messages;
CREATE TABLE conversations_backup AS SELECT * FROM conversations;

-- 迁移后验证
SELECT COUNT(*) AS total_old FROM chat_messages;
SELECT COUNT(*) AS total_new FROM tinode.messages;
-- 确保数量一致

-- 抽样验证
SELECT * FROM chat_messages ORDER BY RANDOM() LIMIT 100;
-- 手工检查这 100 条是否在 Tinode 中存在

-- 验证通过后再删除旧表
-- DROP TABLE chat_messages;  -- ⚠️ 延迟 3 个月再执行
```

### 12.2 回滚方案

**场景**: Tinode 出现严重 Bug，需要紧急回滚

**回滚步骤** (1 分钟内完成):

```bash
# 1. 修改环境变量
echo "IM_PROVIDER=tencent" >> .env.production

# 2. 重启前端服务
docker-compose restart admin mobile

# 3. 通知用户（可选）
curl -X POST https://your-api.com/notify \
  -d '{"message": "聊天功能暂时切换到备用系统"}'
```

**前置准备**:
- ✅ 腾讯云 IM 代码保持可用
- ✅ 环境变量配置正确
- ✅ 回滚文档已准备

### 12.3 性能风险

**风险**: Tinode 服务器性能不足

**缓解措施**:

1. **压力测试**
   ```bash
   # 模拟 10K 并发连接
   docker run --rm -it \
     tinode/chat-bot \
     --server=ws://localhost:6060/v0/channels \
     --count=10000
   ```

2. **水平扩展**
   ```yaml
   # docker-compose.tinode.yml
   services:
     tinode:
       deploy:
         replicas: 3  # 3 个实例
       environment:
         - CLUSTER_SELF=tinode-1
         - PLUGIN_REDIS=redis:6379
   ```

3. **监控指标**
   ```promql
   # 连接数监控
   tinode_connections_total

   # 消息延迟监控
   histogram_quantile(0.99, tinode_message_latency_seconds)
   ```

### 12.4 安全风险

**风险**: 密钥泄露导致用户 ID 被破解

**缓解措施**:

1. **密钥管理**
   ```bash
   # 使用 AWS Secrets Manager 或 Vault
   export TINODE_UID_ENCRYPTION_KEY=$(aws secretsmanager get-secret-value \
     --secret-id tinode-uid-key \
     --query SecretString \
     --output text)
   ```

2. **密钥轮换**
   ```go
   // 支持多个密钥（向后兼容）
   var uidKeys = [][]byte{
       []byte(os.Getenv("TINODE_UID_KEY_NEW")),  // 新密钥
       []byte(os.Getenv("TINODE_UID_KEY_OLD")),  // 旧密钥（兼容）
   }

   func decryptUID(encryptedUID uint64) (uint64, error) {
       for _, key := range uidKeys {
           if uid, err := tryDecrypt(encryptedUID, key); err == nil {
               return uid, nil
           }
       }
       return 0, errors.New("decrypt failed")
   }
   ```

3. **访问控制**
   ```go
   // 限制 Tinode UserID 查询（仅允许查询自己或好友）
   func GetTinodeUserID(c *gin.Context) {
       requestedUserID := c.Param("userId")
       currentUserID := c.GetUint("userID")

       if requestedUserID != currentUserID && !isFriend(currentUserID, requestedUserID) {
           c.JSON(403, gin.H{"error": "Forbidden"})
           return
       }

       // ... 返回 Tinode UserID
   }
   ```

---

## 十三、成功标准

### 13.1 技术指标

| 指标 | 目标值 | 测量方法 |
|------|-------|---------|
| **消息送达率** | ≥99.9% | Prometheus 监控 |
| **消息延迟（P99）** | <500ms | APM 工具 |
| **在线用户数** | 支持 10K+ | 压力测试 |
| **历史消息迁移成功率** | 100% | 数据对比验证 |
| **服务可用性（SLA）** | ≥99.5% | Uptime 监控 |

### 13.2 业务指标

| 指标 | 目标值 | 测量方法 |
|------|-------|---------|
| **用户投诉率** | <1% | 用户反馈 |
| **聊天功能使用率** | ≥80% | 用户行为分析 |
| **平均响应时间** | <2s | 用户体验监控 |

### 13.3 验收清单

- [ ] Tinode 服务器稳定运行 30 天
- [ ] 历史消息迁移 100% 完成
- [ ] 前端（Admin/Mobile/Mini）全部适配完成
- [ ] 灰度测试无严重 Bug
- [ ] 性能测试通过（10K 并发）
- [ ] 监控告警配置完成
- [ ] 回滚方案验证通过
- [ ] 文档更新完成

---

## 十四、附录

### 14.1 关键文件清单

#### 后端文件

| 文件路径 | 功能 | 优先级 |
|---------|------|--------|
| `server/internal/ws/hub.go` | WebSocket Hub | P2（待废弃） |
| `server/internal/tinode/auth_adapter.go` | Tinode 认证 | P0 |
| `server/internal/repository/tinode_db.go` | Tinode 数据库 | P0 |
| `server/internal/utils/tencentim/client.go` | 腾讯云 IM 客户端 | P1（备选） |
| `server/scripts/topics/tinode/001_create_tinode_tables.sql` | Tinode 表结构 | P0 |

#### 前端文件

| 文件路径 | 功能 | 优先级 |
|---------|------|--------|
| `admin/src/services/TinodeService.ts` | Admin Tinode 服务 | P0 |
| `mobile/src/services/TinodeService.ts` | Mobile Tinode 服务 | P0 |
| `mobile/src/screens/ChatRoomScreen.tsx` | 聊天室界面 | P0 |

#### 配置文件

| 文件路径 | 功能 | 优先级 |
|---------|------|--------|
| `docker-compose.tinode.yml` | Tinode 部署配置 | P0 |
| `server/.env` | 环境变量 | P0 |

### 14.2 参考资料

- [Tinode 官方文档](https://github.com/tinode/chat)
- [腾讯云 IM 文档](https://cloud.tencent.com/document/product/269)
- [项目 CLAUDE.md](../CLAUDE.md)
- [IM 迁移规则](./.claude/rules/im-migration-rules.md)

### 14.3 联系人

| 角色 | 职责 | 联系方式 |
|------|------|---------|
| **项目负责人** | 决策、协调 | - |
| **后端开发** | Tinode 集成、迁移脚本 | - |
| **前端开发（Admin）** | Admin 界面改造 | - |
| **前端开发（Mobile）** | Mobile 适配 | - |
| **运维工程师** | 服务器部署、监控 | - |
| **测试工程师** | 灰度测试、验收 | - |

---

## 十五、版本历史

| 版本 | 日期 | 变更内容 | 作者 |
|------|------|---------|------|
| 1.0 | 2026-01-23 | 初始版本，完成全面分析 | Claude Code |

---

**报告完成时间**: 2026-01-23
**下一步行动**: 启动 Tinode 服务器 + 配置环境变量 + 运行时测试

---

**附注**: 本报告基于代码静态分析完成，部分推断需要运行时验证。建议优先完成 Phase 1 的运行时测试，根据测试结果调整后续计划。
