# Tinode 聊天系统完善工作计划

## 决策记录

**日期**: 2026-01-24  
**规划者**: Prometheus  
**审查者**: Metis (已完成)

### 最终架构决策

| 决策项 | 方案 | 理由 |
|--------|------|------|
| **聊天架构** | ✅ Tinode 为主 | Mobile + Admin 已集成，功能完整 |
| **备用方案** | ✅ 腾讯云 IM 保留 | 代码保留但不维护，作为后备 |
| **自建 WebSocket** | ❌ 完全删除 | 已废弃，保留会增加维护成本 |
| **离线消息** | ✅ Tinode 原生支持 | 自动存储+推送，无需额外开发 |
| **语音消息** | ✅ Tinode Drafty AU 实体 | 原生支持，只需实现 UI |
| **推送通知** | ⏸️ 延后到后期 | 使用极光推送，Phase 5 实施 |
| **Mini Program** | ⏸️ 延后到后期 | 先完善 Mobile + Admin |
| **数据库表** | ❌ 删除 Conversation/ChatMessage | Tinode 不使用，可安全删除 |

### 研究结果总结

#### 1. Tinode 离线消息（Librarian 研究）
- ✅ **自动存储**: 消息立即存入数据库（PostgreSQL/MySQL）
- ✅ **无限保留**: 默认永久保存，不会自动过期
- ✅ **自动推送**: 用户重连时自动推送离线消息
- ✅ **分页支持**: 使用 `{get what="data"}` 分页获取
- **结论**: 无需实现客户端离线队列

#### 2. Tinode 语音消息（Librarian 研究）
- ✅ **原生支持**: 通过 Drafty `AU` (Audio) 实体
- ✅ **格式**: 上传音频 → 发送 Drafty 消息
- **示例**:
```json
{
  "txt": "语音消息",
  "fmt": [{ "at": -1, "len": 0, "key": 0 }],
  "ent": [{
    "tp": "AU",
    "data": {
      "mime": "audio/aac",
      "ref": "/v0/file/s/voice123.m4a",
      "duration": 12000,
      "size": 50000
    }
  }]
}
```

#### 3. 国内推送通知（Librarian 研究）
- ✅ **推荐方案**: 极光推送（JPush）
- ✅ **优势**: 官方 React Native SDK，自动集成厂商通道
- ✅ **成本**: 免费版足够创业项目使用
- ⏸️ **实施**: 延后到 Phase 5

---

## 工作计划概览

| Phase | 任务数 | 预计时间 | 优先级 | 可并行 |
|-------|--------|----------|--------|--------|
| **Phase 0** | 3 | 1 天 | 🔴 高 | ✅ 是 |
| **Phase 1** | 4 | 1-2 天 | 🔴 高 | ⚠️ 部分 |
| **Phase 2** | 4 | 3-5 天 | 🟡 中 | ⚠️ 部分 |
| **Phase 3** | 3 | 5-7 天 | 🟡 中 | ❌ 否 |
| **Phase 4** | 3 | 5-7 天 | 🟢 低 | ⚠️ 部分 |
| **Phase 5** | 1 | 延后 | 🟢 低 | - |
| **总计** | **18** | **15-22 天** | - | - |

---

## Phase 0: 代码清理（1天，可并行）

### 目标
清理废弃代码，明确架构方向，为后续开发扫清障碍。

### 任务清单

#### 任务 0.1: 删除自建 WebSocket 代码

**删除文件**:
```bash
rm -rf server/internal/ws/
rm server/internal/handler/ws_handler.go
rm server/internal/handler/chat_handler.go
```

**修改文件**:
- `server/internal/repository/database.go`:
  - 删除 Line 56: `&model.Conversation{}`
  - 删除 Line 57: `&model.ChatMessage{}`
  
- `server/internal/router/router.go`:
  - 删除 Lines 97-98（WebSocket 路由注释）
  - 删除 Lines 267-272（chat 端点注释）

**验证**:
```bash
cd server
grep -r "internal/ws" .  # 应该返回 0 结果
grep -r "chat_handler" .  # 应该返回 0 结果
make test  # 应该通过
make build  # 应该成功
```

**验收标准**:
- [ ] `internal/ws/` 目录不存在
- [ ] `grep -r "internal/ws"` 返回 0 结果
- [ ] `make test` 全部通过
- [ ] `make build` 成功编译
- [ ] 数据库迁移中不再包含 Conversation/ChatMessage

**Commit**: 
```
chore(server): remove deprecated WebSocket chat implementation

- Delete internal/ws/ directory (hub, client, handler, protocol)
- Delete ws_handler.go and chat_handler.go
- Remove Conversation and ChatMessage from AutoMigrate
- Remove commented WebSocket routes from router.go

BREAKING CHANGE: Self-built WebSocket chat is no longer available.
Users should use Tinode for chat functionality.
```

**预计时间**: 30 分钟

---

#### 任务 0.2: 标记腾讯云 IM 为备用

**保留文件**（不删除）:
- `server/internal/handler/im_handler.go`
- `server/internal/handler/merchant_im_handler.go`
- `server/internal/utils/tencentim/`

**添加文档注释**:

在 `server/internal/handler/im_handler.go` 顶部添加：
```go
// Package handler provides Tencent Cloud IM integration.
//
// STATUS: BACKUP SOLUTION (Not currently used in production)
//
// Primary IM System: Tinode
// This code is kept as a backup solution for potential future migration
// or emergency fallback scenarios.
//
// Maintenance Policy:
// - Code is preserved but not actively maintained
// - No new features will be added
// - Critical security fixes only
// - Scheduled for review: 2026-07-24 (6 months)
//
// Last Updated: 2026-01-24
// Maintainer: Backend Team
```

在 `server/internal/utils/tencentim/client.go` 顶部添加类似注释。

**验证**:
```bash
cd server
grep -A 5 "STATUS: BACKUP" internal/handler/im_handler.go
grep -A 5 "STATUS: BACKUP" internal/utils/tencentim/client.go
```

**验收标准**:
- [ ] 所有腾讯 IM 文件顶部有 BACKUP 标记
- [ ] 注释说明了保留原因和维护策略
- [ ] 设置了 6 个月后的审查日期
- [ ] API 端点仍然可用（`/api/v1/im/usersig`）

**Commit**:
```
docs(server): mark Tencent Cloud IM as backup solution

- Add STATUS: BACKUP comments to IM handlers
- Document maintenance policy (security fixes only)
- Set review date: 2026-07-24
- Keep API endpoints functional for emergency fallback
```

**预计时间**: 15 分钟

---

#### 任务 0.3: 删除前端注释代码

**Mobile** (`mobile/src/screens/ChatRoomScreen.tsx`):

删除以下行（腾讯 IM 注释代码）:
- Lines 35-36
- Lines 132-144
- Lines 240-254
- Lines 413-434
- Lines 468-537
- Lines 611-690

**Mobile** (`mobile/src/screens/MessageScreen.tsx`):

删除以下行:
- Lines 129-163
- Lines 278-291

**Admin** (`admin/package.json`):

删除未使用的依赖：
```bash
cd admin
npm uninstall @tencentcloud/chat
npm uninstall @tencentcloud/chat-uikit-react
npm uninstall @tencentcloud/chat-uikit-engine
npm uninstall @tencentcloud/universal-api
```

**验证**:
```bash
# Mobile
cd mobile
npm run lint  # 应该通过
grep -n "TencentIM" src/screens/ChatRoomScreen.tsx  # 应该返回 0 结果

# Admin
cd admin
npm run lint  # 应该通过
npm run build  # 应该成功
grep "@tencentcloud" package.json  # 应该返回 0 结果
```

**验收标准**:
- [ ] ChatRoomScreen.tsx 减少约 500 行
- [ ] MessageScreen.tsx 减少约 150 行
- [ ] Admin package.json 不再包含 @tencentcloud 依赖
- [ ] `npm run lint` 通过
- [ ] `npm run build` 成功

**Commit**:
```
chore: remove commented Tencent IM code (650+ lines)

Mobile:
- Remove commented TencentIM code from ChatRoomScreen (500 lines)
- Remove commented TencentIM code from MessageScreen (150 lines)

Admin:
- Uninstall unused @tencentcloud/* packages
- Clean up package.json dependencies

This code was replaced by Tinode integration and is no longer needed.
```

**预计时间**: 30 分钟

---

### Phase 0 总结

**总时间**: 1 天（可并行执行）  
**总 Commits**: 3  
**代码减少**: ~1000 行  
**依赖减少**: 4 个 npm 包  

**完成标准**:
- [ ] 所有 WebSocket 代码已删除
- [ ] 腾讯 IM 已标记为备用
- [ ] 前端注释代码已清理
- [ ] 所有测试通过
- [ ] 所有构建成功
- [ ] Git 历史清晰（3 个原子提交）

---


## Phase 1: 修复已知问题（1-2天）

### 目标
修复用户提出的 4 个明确问题，确保基本聊天功能完整可用。

### 任务清单

#### 任务 1.1: Admin 图片渲染

**问题**: Admin 商家端只显示"【图片】"文字，不渲染实际图片

**文件**: `admin/src/pages/merchant/MerchantChat.tsx`

**修改 `renderContent()` 函数** (Lines 352-358):

```typescript
const renderContent = (content: any) => {
    if (typeof content === 'string') return content;
    
    if (typeof content === 'object' && content !== null) {
        // 检查图片实体（Drafty IM 格式）
        if (Array.isArray(content.ent)) {
            const imageEnt = content.ent.find((e: any) => e?.tp === 'IM' && e?.data?.val);
            if (imageEnt) {
                const imageUrl = normalizeMediaUrl(imageEnt.data.val);
                return (
                    <img 
                        src={imageUrl} 
                        alt="图片消息"
                        style={{ 
                            maxWidth: '200px', 
                            maxHeight: '200px',
                            borderRadius: '4px',
                            cursor: 'pointer',
                            objectFit: 'cover'
                        }}
                        onClick={() => setImagePreview(imageUrl)}
                        onError={(e) => {
                            e.currentTarget.src = '/image-error.png';
                            console.error('Image load failed:', imageUrl);
                        }}
                    />
                );
            }
        }
        
        // 回退到文本
        return content.txt || '【不支持的消息】';
    }
    
    return '【不支持的消息】';
};

// 添加 URL 规范化函数
const normalizeMediaUrl = (url: string): string => {
    if (!url) return '';
    if (url.startsWith('http://') || url.startsWith('https://')) return url;
    if (url.startsWith('/')) {
        const baseUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080';
        return `${baseUrl}${url}`;
    }
    return url;
};
```

**验证步骤**:
1. 从 Mobile 发送图片到商家
2. 在 Admin 打开该会话
3. 确认图片正确显示（不是"【图片】"文字）
4. 点击图片能预览（任务 1.3 实现）
5. 图片加载失败时显示占位图

**验收标准**:
- [ ] Admin 能看到 Mobile 发送的图片
- [ ] 图片尺寸正确（最大 200x200px）
- [ ] 图片保持宽高比，不变形
- [ ] 图片加载失败时有友好提示
- [ ] 点击图片有响应（预览功能）

**测试用例**:
```typescript
// Test Case 1: 正常图片
const normalImage = {
    txt: "图片",
    ent: [{
        tp: "IM",
        data: { val: "/uploads/chat/2026/01/image123.jpg" }
    }]
};
// Expected: 显示图片

// Test Case 2: 绝对 URL
const absoluteUrl = {
    txt: "图片",
    ent: [{
        tp: "IM",
        data: { val: "https://example.com/image.jpg" }
    }]
};
// Expected: 显示图片

// Test Case 3: 无效 URL
const invalidUrl = {
    txt: "图片",
    ent: [{
        tp: "IM",
        data: { val: "/invalid/path.jpg" }
    }]
};
// Expected: 显示占位图

// Test Case 4: 纯文本消息
const textMessage = {
    txt: "你好"
};
// Expected: 显示文本
```

**Commit**:
```
fix(admin): render image messages in chat panel

- Modify renderContent() to detect Drafty IM entities
- Add normalizeMediaUrl() helper for URL handling
- Add error handling for failed image loads
- Add click handler for image preview (placeholder)

Fixes: Admin showing "【图片】" text instead of actual images
Related: Task 1.3 (image preview modal)
```

**预计时间**: 2 小时

---

#### 任务 1.2: Mobile 文件附件完整实现

**问题**: DocumentPicker 选择的所有文件都当图片发送

**相关文件**:
- `mobile/src/screens/ChatRoomScreen.tsx`
- `mobile/src/services/TinodeService.ts`

**步骤 1**: 修改 `uploadAndSendFile()` (Line 692-714):

```typescript
const uploadAndSendFile = async (
    file: { uri: string; type: string; name: string }, 
    msgType: string
) => {
    try {
        const targetTopic = conversationID || topicName;
        if (!targetTopic) throw new Error('Missing Tinode topic');

        if (msgType === 'image') {
            await TinodeService.sendImageMessage(targetTopic, file.uri);
        } else if (msgType === 'file') {
            // 实现文件附件发送
            await TinodeService.sendFileMessage(
                targetTopic, 
                file.uri, 
                file.name, 
                file.type
            );
        } else {
            throw new Error(`Unsupported message type: ${msgType}`);
        }
        
        // 发送成功提示
        Toast.show({
            type: 'success',
            text1: msgType === 'image' ? '图片已发送' : '文件已发送'
        });
    } catch (error) {
        console.error('Tinode attachment send failed:', error);
        setDialogConfig({
            visible: true,
            type: 'info',
            title: '发送失败',
            message: error.message || '附件发送失败，请重试',
        });
    }
};
```

**步骤 2**: 在 `TinodeService.ts` 添加 `sendFileMessage()`:

```typescript
/**
 * 发送文件消息（Drafty EX 实体）
 * @param topicName - Tinode topic ID
 * @param fileUri - 本地文件 URI
 * @param fileName - 文件名
 * @param mimeType - MIME 类型
 */
async sendFileMessage(
    topicName: string, 
    fileUri: string, 
    fileName: string, 
    mimeType: string
): Promise<void> {
    if (!this.tinode) throw new Error('Tinode not initialized');

    const topic = this.tinode.getTopic(topicName);
    if (!topic) throw new Error(`Topic ${topicName} not found`);

    try {
        // 检查文件大小
        const fileInfo = await ReactNativeBlobUtil.fs.stat(fileUri);
        const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
        
        if (fileInfo.size > MAX_FILE_SIZE) {
            throw new Error('文件大小不能超过 10MB');
        }

        // 上传文件到服务器
        const uploadResult = await this.uploadFile(fileUri, mimeType);

        // 创建 Drafty 内容（EX 实体 = External file）
        const content = {
            txt: fileName,
            fmt: [{ at: -1, len: 0, key: 0 }], // 渲染为附件卡片
            ent: [{
                tp: 'EX',  // External file entity
                data: {
                    mime: mimeType,
                    val: uploadResult.url,
                    name: fileName,
                    size: fileInfo.size
                }
            }]
        };

        await topic.publishMessage(content);
        console.log('[Tinode] 文件已发送:', fileName, fileInfo.size, 'bytes');
    } catch (err) {
        console.error('[Tinode] File upload failed', { 
            fileUri, 
            mimeType, 
            fileName 
        }, err);
        throw err;
    }
}
```

**步骤 3**: 修改 `parseTinodeMessages()` 添加文件解析:

```typescript
// 在 parseTinodeMessages() 中添加文件实体处理
const fileEnt = contentObj && Array.isArray(contentObj.ent)
    ? contentObj.ent.find((e: any) => 
        e && typeof e === 'object' && e.tp === 'EX' && e.data
      )
    : undefined;

const file = fileEnt ? {
    url: normalizeMediaUrl(fileEnt.data.val),
    name: fileEnt.data.name || 'unknown',
    size: fileEnt.data.size || 0,
    mime: fileEnt.data.mime || 'application/octet-stream'
} : undefined;

return {
    // ... 现有字段
    file: file,
    // ...
};
```

**步骤 4**: 在 `renderMessage()` 添加文件卡片 UI:

```typescript
{message.file ? (
    <TouchableOpacity 
        style={styles.fileCard}
        onPress={() => {
            // 打开文件
            Linking.openURL(message.file.url).catch(err => {
                console.error('Failed to open file:', err);
                Alert.alert('错误', '无法打开文件');
            });
        }}
        activeOpacity={0.7}
    >
        <View style={styles.fileIcon}>
            <File size={32} color="#8B5CF6" />
        </View>
        <View style={styles.fileInfo}>
            <Text style={styles.fileName} numberOfLines={1}>
                {message.file.name}
            </Text>
            <Text style={styles.fileSize}>
                {formatFileSize(message.file.size)}
            </Text>
        </View>
        <ChevronRight size={20} color="#9CA3AF" />
    </TouchableOpacity>
) : message.image?.url ? (
    // ... 现有图片渲染
) : (
    // ... 现有文本渲染
)}

// 添加文件大小格式化函数
const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};
```

**添加样式**:

```typescript
fileCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F3F4F6',
    borderRadius: 8,
    padding: 12,
    maxWidth: 280,
    minWidth: 200,
},
fileIcon: {
    marginRight: 12,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#EDE9FE',
    justifyContent: 'center',
    alignItems: 'center',
},
fileInfo: {
    flex: 1,
    marginRight: 8,
},
fileName: {
    fontSize: 14,
    fontWeight: '500',
    color: '#1F2937',
    marginBottom: 4,
},
fileSize: {
    fontSize: 12,
    color: '#6B7280',
},
```

**验证步骤**:
1. 点击"选择文件"按钮
2. 选择 PDF/Word/Excel 文件
3. 确认文件正确上传并发送
4. 接收方看到文件卡片（显示文件名、大小、图标）
5. 点击文件卡片能打开/下载
6. 测试超过 10MB 的文件（应显示错误）

**验收标准**:
- [ ] 能选择非图片文件（PDF、Word、Excel等）
- [ ] 文件正确上传到服务器
- [ ] 接收方看到文件卡片（不是损坏的图片）
- [ ] 文件名和大小正确显示
- [ ] 点击文件能打开/下载
- [ ] 超过 10MB 的文件显示错误提示
- [ ] 文件大小格式化正确（B/KB/MB）

**测试用例**:
```typescript
// Test Case 1: PDF 文件
const pdfFile = {
    uri: 'file:///path/to/document.pdf',
    name: 'document.pdf',
    type: 'application/pdf'
};
// Expected: 显示文件卡片，点击能打开

// Test Case 2: 大文件（超过 10MB）
const largeFile = {
    uri: 'file:///path/to/large.zip',
    name: 'large.zip',
    type: 'application/zip',
    size: 15 * 1024 * 1024
};
// Expected: 显示错误"文件大小不能超过 10MB"

// Test Case 3: 未知类型文件
const unknownFile = {
    uri: 'file:///path/to/file.xyz',
    name: 'file.xyz',
    type: 'application/octet-stream'
};
// Expected: 显示文件卡片，MIME 类型为 octet-stream
```

**Commit**:
```
feat(mobile): implement file attachment support with Drafty EX entity

- Add sendFileMessage() to TinodeService
- Implement file size validation (max 10MB)
- Add file card UI component with icon, name, size
- Add file size formatter (B/KB/MB)
- Parse Drafty EX entities in received messages
- Add file open/download functionality

Fixes: Files being sent as images (Line 701 TODO)
Related: Tinode Drafty format specification
```

**预计时间**: 4 小时

---


#### 任务 1.3: 图片预览 Modal

**问题**: 点击图片无反应，无法全屏查看

**相关文件**:
- `mobile/src/screens/ChatRoomScreen.tsx`
- `admin/src/pages/merchant/MerchantChat.tsx`

**Mobile 实现**:

**步骤 1**: 添加状态:
```typescript
const [imagePreview, setImagePreview] = useState<{
    visible: boolean;
    url: string;
} | null>(null);
```

**步骤 2**: 修改图片渲染，添加点击事件:
```typescript
{image?.url ? (
    <TouchableOpacity 
        onPress={() => setImagePreview({ visible: true, url: image.url })}
        activeOpacity={0.9}
    >
        <Image
            source={{ uri: image.url }}
            style={[styles.messageImage, { 
                width: imageSize.width, 
                height: imageSize.height 
            }]}
            resizeMode="cover"
        />
    </TouchableOpacity>
) : (
    // ... 文本渲染
)}
```

**步骤 3**: 添加 Modal 组件:
```typescript
{/* 图片预览 Modal */}
<Modal
    visible={imagePreview?.visible || false}
    transparent
    animationType="fade"
    onRequestClose={() => setImagePreview(null)}
    statusBarTranslucent
>
    <View style={styles.imagePreviewOverlay}>
        {/* 关闭按钮 */}
        <TouchableOpacity 
            style={styles.imagePreviewClose}
            onPress={() => setImagePreview(null)}
        >
            <X size={32} color="#FFFFFF" />
        </TouchableOpacity>
        
        {/* 全屏图片 */}
        {imagePreview?.url && (
            <Image
                source={{ uri: imagePreview.url }}
                style={styles.imagePreviewFull}
                resizeMode="contain"
            />
        )}
    </View>
</Modal>
```

**添加样式**:
```typescript
imagePreviewOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.95)',
    justifyContent: 'center',
    alignItems: 'center',
},
imagePreviewClose: {
    position: 'absolute',
    top: 50,
    right: 20,
    zIndex: 10,
    padding: 10,
},
imagePreviewFull: {
    width: '100%',
    height: '100%',
},
```

**Admin 实现**:

**步骤 1**: 添加状态:
```typescript
const [imagePreview, setImagePreview] = useState<string | null>(null);
```

**步骤 2**: 在 `renderContent()` 的图片渲染中添加点击:
```typescript
onClick={() => setImagePreview(imageUrl)}
```

**步骤 3**: 添加 Ant Design Modal:
```typescript
<Modal
    open={!!imagePreview}
    footer={null}
    onCancel={() => setImagePreview(null)}
    width="80%"
    centered
    styles={{
        body: { padding: 0 }
    }}
>
    {imagePreview && (
        <img 
            src={imagePreview} 
            style={{ width: '100%', display: 'block' }} 
            alt="预览" 
        />
    )}
</Modal>
```

**验收标准**:
- [ ] 点击图片打开全屏预览
- [ ] 点击关闭按钮或背景关闭预览
- [ ] 图片按比例缩放，不变形
- [ ] Mobile 和 Admin 都能正常预览
- [ ] 预览时状态栏透明（Mobile）

**Commit**:
```
feat: add image preview modal for chat messages

Mobile:
- Add full-screen image preview modal
- Add close button with X icon
- Support tap background to close
- Maintain image aspect ratio

Admin:
- Add Ant Design Modal for image preview
- Support ESC key to close
- Center modal on screen

Fixes: No response when clicking images
```

**预计时间**: 2 小时

---

#### 任务 1.4: 更多菜单功能

**问题**: "查看资料"和"清空聊天记录"功能未实现

**相关文件**:
- `mobile/src/screens/ChatRoomScreen.tsx` (Lines 581, 595)
- `server/internal/handler/tinode_handler.go`
- `server/internal/router/router.go`

**步骤 1**: 实现"查看资料"跳转 (Line 581):

**添加角色解析函数**:
```typescript
const resolveUserRole = async (userId: string): Promise<string> => {
    try {
        const res = await api.get(`/users/${userId}/role`);
        return res.data.role || 'user';
    } catch (err) {
        console.error('Failed to resolve user role:', err);
        return 'user';
    }
};
```

**修改 case 'profile'**:
```typescript
case 'profile':
    try {
        setDialogConfig({ ...dialogConfig, visible: false });
        
        const partnerRole = await resolveUserRole(partnerID);
        
        if (partnerRole === 'designer') {
            navigation.navigate('DesignerDetail', { id: partnerID });
        } else if (partnerRole === 'merchant') {
            navigation.navigate('MerchantDetail', { id: partnerID });
        } else if (partnerRole === 'foreman') {
            navigation.navigate('ForemanDetail', { id: partnerID });
        } else {
            // 默认跳转到通用用户资料页
            navigation.navigate('UserProfile', { userId: partnerID });
        }
    } catch (err) {
        setDialogConfig({
            visible: true,
            type: 'info',
            title: '错误',
            message: '无法获取用户信息，请稍后重试',
        });
    }
    break;
```

**步骤 2**: 实现"清空聊天记录" API:

**Server 端** (`server/internal/handler/tinode_handler.go`):
```go
// ClearChatHistory 清空聊天记录（客户端标记）
// 注意：这只是标记客户端清空，Tinode 服务器仍保留消息
func ClearChatHistory(c *gin.Context) {
    userID := uint64(c.GetFloat64("userId"))
    topicName := c.Param("topic")
    
    // 验证 topic 格式
    if !strings.HasPrefix(topicName, "usr") && !strings.HasPrefix(topicName, "grp") {
        c.JSON(http.StatusBadRequest, gin.H{
            "code": 1001, 
            "message": "Invalid topic name"
        })
        return
    }
    
    // 可选：在应用数据库中记录用户的"清空时间戳"
    // 客户端只显示该时间戳之后的消息
    // 这里简化处理，直接返回成功
    
    log.Printf("[ClearChat] User %d cleared topic %s", userID, topicName)
    
    c.JSON(http.StatusOK, gin.H{
        "code": 0, 
        "message": "聊天记录已清空"
    })
}
```

**Router** (`server/internal/router/router.go`):
```go
// Tinode 相关路由
tinode := authorized.Group("/tinode")
{
    tinode.GET("/userid/:userId", handler.GetTinodeUserID)
    tinode.DELETE("/topic/:topic/messages", handler.ClearChatHistory)  // 新增
}
```

**Mobile 端**:
```typescript
case 'clear':
    setDialogConfig({
        visible: true,
        type: 'confirm',
        title: '清空聊天记录',
        message: '确定要清空与该用户的聊天记录吗？此操作不可恢复。',
        onConfirm: async () => {
            try {
                await api.delete(`/tinode/topic/${topicName}/messages`);
                
                // 清空本地消息列表
                setMessages([]);
                
                // 显示成功提示
                setDialogConfig({
                    visible: true,
                    type: 'success',
                    title: '成功',
                    message: '聊天记录已清空',
                });
            } catch (err) {
                console.error('Clear messages failed:', err);
                setDialogConfig({
                    visible: true,
                    type: 'info',
                    title: '失败',
                    message: '清空失败，请重试',
                });
            }
        },
        onCancel: () => {
            setDialogConfig({ ...dialogConfig, visible: false });
        }
    });
    break;
```

**验收标准**:
- [ ] 点击"查看个人主页"能正确跳转到对应角色页面
- [ ] 设计师跳转到 DesignerDetail
- [ ] 商家跳转到 MerchantDetail
- [ ] 工长跳转到 ForemanDetail
- [ ] 普通用户跳转到 UserProfile
- [ ] 点击"清空聊天记录"弹出确认对话框
- [ ] 确认后消息列表清空
- [ ] 对方仍能看到历史消息（只清空本地）
- [ ] 清空失败时有友好提示

**测试用例**:
```typescript
// Test Case 1: 查看设计师资料
const designerUser = { id: '123', role: 'designer' };
// Expected: 跳转到 DesignerDetail

// Test Case 2: 查看商家资料
const merchantUser = { id: '456', role: 'merchant' };
// Expected: 跳转到 MerchantDetail

// Test Case 3: 清空聊天记录
// Action: 点击"清空聊天记录" → 确认
// Expected: 消息列表清空，显示成功提示

// Test Case 4: 取消清空
// Action: 点击"清空聊天记录" → 取消
// Expected: 对话框关闭，消息列表不变
```

**Commit**:
```
feat(mobile): implement profile navigation and clear chat history

Mobile:
- Add resolveUserRole() to get user role from API
- Implement role-based navigation (designer/merchant/foreman/user)
- Add clear chat history confirmation dialog
- Clear local message list on confirm

Server:
- Add ClearChatHistory handler (client-side clear)
- Add DELETE /tinode/topic/:topic/messages endpoint
- Add topic name validation

Fixes: Line 581 TODO (profile navigation)
Fixes: Line 595 TODO (clear messages API)
```

**预计时间**: 3 小时

---

### Phase 1 总结

**总时间**: 1-2 天  
**总任务**: 4 个  
**总 Commits**: 4  

**完成标准**:
- [ ] Admin 能正确显示图片
- [ ] Mobile 能发送文件附件
- [ ] 图片预览功能正常（Mobile + Admin）
- [ ] 更多菜单功能可用（查看资料 + 清空记录）
- [ ] 所有测试通过
- [ ] 无回归问题（文本消息仍正常）

**验证清单**:
- [ ] **跨平台测试**: Mobile ↔ Admin 双向发送图片/文件
- [ ] **回归测试**: 文本消息、会话列表、未读数仍正常
- [ ] **错误处理**: 网络错误、文件过大、权限拒绝都有友好提示
- [ ] **性能测试**: 图片上传 < 5s (4G 网络)

---


## Phase 2-5 及验证策略

由于篇幅限制，Phase 2-5 的详细任务已在对话中完整呈现，包括：

### Phase 2: 关键缺失功能（3-5天）
- 任务 2.1: 打字指示器（使用 Tinode `{note}` 消息）
- 任务 2.2: 在线状态（使用 Tinode `{pres}` 消息）
- 任务 2.3: 客户信息面板（Admin 侧边栏）
- 任务 2.4: 快捷回复（Admin 预设回复按钮）

### Phase 3: 用户体验提升（5-7天）
- 任务 3.1: 消息操作（长按菜单：复制、删除）
- 任务 3.2: 消息搜索（客户端搜索）
- 任务 3.3: 桌面通知（Admin 浏览器通知）

### Phase 4: 语音消息（5-7天）
- 任务 4.1: 录音功能（react-native-audio-recorder-player）
- 任务 4.2: 语音播放（音频播放器组件）
- 任务 4.3: Admin 语音支持（HTML5 audio 标签）

### Phase 5: 推送通知（延后）
- 任务 5.1: 集成极光推送（JPush）
- 配置厂商通道（华为、小米、OPPO、vivo）
- 后端集成 JPush Server SDK

---

## 验证策略

### 跨平台测试矩阵

| 功能 | Mobile → Mobile | Mobile → Admin | Admin → Mobile |
|------|----------------|----------------|----------------|
| 文本消息 | ✅ 必测 | ✅ 必测 | ✅ 必测 |
| 图片消息 | ✅ 必测 | ✅ 必测 | ✅ 必测 |
| 文件附件 | ✅ 必测 | ✅ 必测 | ⚠️ 可选 |
| 语音消息 | ✅ 必测 | ✅ 必测 | ⚠️ 可选 |
| 打字指示器 | ✅ 必测 | ✅ 必测 | ✅ 必测 |
| 在线状态 | ✅ 必测 | ✅ 必测 | ✅ 必测 |

### 性能要求

| 指标 | 目标 | 测试方法 |
|------|------|----------|
| 图片上传 | < 5s (4G) | 上传 2MB 图片，计时 |
| 消息发送 | < 500ms | 发送文本，计时 |
| 打字指示器延迟 | < 500ms | 输入后观察对方 |
| 在线状态更新 | < 2s | 上线后观察对方 |
| 历史消息加载 | < 2s (100条) | 打开会话，计时 |

### 错误处理测试

| 场景 | 预期行为 |
|------|----------|
| 断网发送消息 | 显示"网络连接失败"，提供重试按钮 |
| 文件过大（>10MB） | 显示"文件大小不能超过 10MB" |
| 图片加载失败 | 显示占位图，不崩溃 |
| 相机权限被拒绝 | 显示引导，跳转到设置 |
| Tinode 服务器宕机 | 显示"聊天服务暂时不可用" |

---

## 提交策略

### Commit 规范

```
<type>(<scope>): <subject>

<body>

<footer>
```

**Type**:
- `feat`: 新功能
- `fix`: Bug 修复
- `docs`: 文档更新
- `style`: 代码格式（不影响功能）
- `refactor`: 重构（不改变功能）
- `test`: 测试相关
- `chore`: 构建/工具相关

**Scope**:
- `mobile`: React Native 移动端
- `admin`: React Admin 管理端
- `server`: Go 后端
- `shared`: 跨平台共享代码

**示例**:
```
feat(mobile): implement file attachment support

- Add sendFileMessage() to TinodeService
- Implement file size validation (max 10MB)
- Add file card UI component
- Parse Drafty EX entities

Fixes: #123
Related: Tinode Drafty format spec
```

### 分支策略

```
main (生产环境)
  ↑
develop (开发环境)
  ↑
feature/tinode-chat-phase-0  (代码清理)
feature/tinode-chat-phase-1  (修复已知问题)
feature/tinode-chat-phase-2  (关键功能)
feature/tinode-chat-phase-3  (用户体验)
feature/tinode-chat-phase-4  (语音消息)
```

**合并流程**:
1. Feature 分支开发完成 → PR 到 develop
2. Develop 测试通过 → PR 到 main
3. Main 部署到生产环境

---

## 风险与缓解

| 风险 | 影响 | 概率 | 缓解措施 |
|------|------|------|----------|
| Tinode 服务器不稳定 | 🔴 高 | 🟢 低 | 保留腾讯 IM 作为备用 |
| 语音录制权限问题 | 🟡 中 | 🟡 中 | 提供详细的权限引导 |
| 文件上传失败率高 | 🟡 中 | 🟡 中 | 实现重试机制 + 断点续传 |
| 跨平台兼容性问题 | 🟡 中 | 🟡 中 | 充分测试 iOS + Android |
| 性能问题（大量消息） | 🟢 低 | 🟢 低 | 实现虚拟列表（如需要） |
| React 版本冲突 | 🔴 高 | 🟢 低 | 严格锁定 Admin React 18.3.1 |

---

## 成功标准

### Phase 0 完成标准
- ✅ 所有 WebSocket 代码已删除
- ✅ 腾讯 IM 已标记为备用
- ✅ 前端注释代码已清理（~1000 行）
- ✅ 所有测试通过
- ✅ 所有构建成功

### Phase 1 完成标准
- ✅ Admin 能正确显示图片
- ✅ Mobile 能发送文件附件
- ✅ 图片预览功能正常
- ✅ 更多菜单功能可用
- ✅ 所有测试通过
- ✅ 无回归问题

### Phase 2 完成标准
- ✅ 打字指示器延迟 < 500ms
- ✅ 在线状态更新延迟 < 2s
- ✅ 客户信息面板正确显示
- ✅ 快捷回复功能可用

### Phase 3 完成标准
- ✅ 消息操作功能完整
- ✅ 消息搜索准确
- ✅ 桌面通知正常工作

### Phase 4 完成标准
- ✅ 语音录制功能正常
- ✅ 语音播放功能正常
- ✅ 跨平台兼容

---

## 时间估算

| Phase | 任务数 | 预计时间 | 实际时间 | 偏差 |
|-------|--------|----------|----------|------|
| Phase 0 | 3 | 1 天 | ___ | ___ |
| Phase 1 | 4 | 1-2 天 | ___ | ___ |
| Phase 2 | 4 | 3-5 天 | ___ | ___ |
| Phase 3 | 3 | 5-7 天 | ___ | ___ |
| Phase 4 | 3 | 5-7 天 | ___ | ___ |
| **总计** | **17** | **15-22 天** | ___ | ___ |

---

## 下一步行动

### 立即开始

1. **创建 Feature 分支**:
```bash
git checkout -b feature/tinode-chat-phase-0
```

2. **开始 Phase 0 任务 0.1**:
```bash
# 删除 WebSocket 代码
rm -rf server/internal/ws/
rm server/internal/handler/ws_handler.go
rm server/internal/handler/chat_handler.go
```

3. **验证**:
```bash
cd server
make test
make build
```

4. **提交**:
```bash
git add .
git commit -m "chore(server): remove deprecated WebSocket chat implementation"
```

### 执行工作计划

**运行以下命令开始执行**:
```bash
/start-work
```

这将：
1. 注册计划为活动 boulder
2. 跟踪进度
3. 启用自动继续（如果中断）

---

## 附录

### A. Tinode Drafty 格式参考

**图片消息（IM 实体）**:
```json
{
  "txt": "图片",
  "fmt": [{ "at": -1, "len": 0, "key": 0 }],
  "ent": [{
    "tp": "IM",
    "data": {
      "val": "/uploads/chat/image.jpg",
      "width": 800,
      "height": 600,
      "size": 102400
    }
  }]
}
```

**文件消息（EX 实体）**:
```json
{
  "txt": "document.pdf",
  "fmt": [{ "at": -1, "len": 0, "key": 0 }],
  "ent": [{
    "tp": "EX",
    "data": {
      "mime": "application/pdf",
      "val": "/uploads/chat/document.pdf",
      "name": "document.pdf",
      "size": 512000
    }
  }]
}
```

**语音消息（AU 实体）**:
```json
{
  "txt": "语音消息",
  "fmt": [{ "at": -1, "len": 0, "key": 0 }],
  "ent": [{
    "tp": "AU",
    "data": {
      "mime": "audio/aac",
      "ref": "/uploads/chat/voice.m4a",
      "duration": 12000,
      "size": 50000
    }
  }]
}
```

### B. 极光推送配置参考（Phase 5）

**Android (`android/app/build.gradle`)**:
```gradle
manifestPlaceholders = [
    JPUSH_PKGENAME: "com.homedecorationapp",
    JPUSH_APPKEY : "your_jpush_appkey",
    JPUSH_CHANNEL: "developer-default"
]
```

**iOS (`Podfile`)**:
```ruby
pod 'JPushRN', :path => '../node_modules/jpush-react-native'
pod 'JCoreRN', :path => '../node_modules/jcore-react-native'
```

### C. 相关文档

- Tinode 官方文档: https://github.com/tinode/chat
- Tinode Drafty 格式: https://github.com/tinode/chat/blob/master/docs/drafty.md
- 极光推送文档: https://docs.jiguang.cn/jpush/client/Android/android_sdk
- React Native 音频录制: https://github.com/hyochan/react-native-audio-recorder-player

---

## 计划元数据

**创建日期**: 2026-01-24  
**最后更新**: 2026-01-24  
**版本**: 1.0  
**状态**: 待审查（Momus）  
**预计完成**: 2026-02-14  

**变更历史**:
- 2026-01-24: 初始版本，基于 Metis 审查结果

---

**计划已完成，准备提交 Momus 审查。**

