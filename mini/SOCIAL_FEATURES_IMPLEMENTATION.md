# 小程序社交功能前端实现说明

## 已完成功能

### 1. 敏感词错误提示 ✅
**文件**: `mini/src/pages/inspiration/detail/index.tsx`

**实现内容**:
- 在 `handleSubmitComment` 函数中捕获敏感词错误
- 当后端返回包含"敏感词"的错误消息时，显示友好提示："评论包含敏感词，请修改后重试"
- 使用 `Taro.showToast` 显示提示，持续时间2.5秒

**测试方法**:
1. 在灵感详情页发布包含敏感词的评论
2. 应该看到友好的错误提示

---

### 2. 评论操作菜单（删除/举报） ✅
**文件**: `mini/src/pages/inspiration/detail/index.tsx`

**实现内容**:
- 在评论卡片右上角添加"···"操作按钮
- 点击后使用 `Taro.showActionSheet` 显示操作菜单
- 如果是自己的评论：显示"删除评论"选项
- 如果是别人的评论：显示"举报评论"选项

**删除功能**:
- 弹出确认对话框（`Taro.showModal`）
- 调用 `inspirationService.deleteComment(commentId)` API
- 删除成功后刷新评论列表

**举报功能**:
- 弹出举报原因选择对话框（`Taro.showActionSheet`）
- 举报原因：垃圾广告、色情低俗、政治敏感、人身攻击、其他
- 调用 `inspirationService.reportComment(commentId, reason)` API
- 提示举报成功

**样式**:
- 添加了 `__comment-actions` 和 `__comment-actions-icon` 样式
- 添加了 `__comment-footer` 和 `__comment-reply-btn` 样式

---

### 3. 评论回复功能 ✅
**新增文件**:
- `mini/src/pages/inspiration/comment-detail/index.tsx` - 评论详情页组件
- `mini/src/pages/inspiration/comment-detail/index.scss` - 评论详情页样式

**功能需求**:
- 展示原评论（评论内容、作者、时间）
- 展示该评论的所有回复列表
- 支持回复该评论
- 支持回复其他人的回复（@某人）
- 支持下拉加载更多回复

**UI设计**:
- 顶部显示原评论（白色卡片，圆角阴影）
- 下方显示回复列表（白色卡片）
- 底部固定"发布回复"按钮（渐变紫色，圆角）
- 使用 Taro 原生组件

**API调用**:
- `inspirationService.getCommentDetail(commentId)` - 获取评论详情
- `inspirationService.getCommentReplies(commentId, query)` - 获取回复列表
- `inspirationService.replyComment(commentId, data)` - 提交回复

**路由配置**:
- 已在 `mini/src/app.config.ts` 中注册页面路径

---

### 4. API接口定义 ✅
**文件**: `mini/src/services/inspiration.ts`

**新增接口**:
```typescript
// 删除评论
deleteComment: (commentId: number) => Promise<{ message: string }>

// 举报评论
reportComment: (commentId: number, reason: string) => Promise<{ message: string }>

// 获取评论详情
getCommentDetail: (commentId: number) => Promise<InspirationCommentDTO>

// 获取评论回复列表
getCommentReplies: (commentId: number, query: InspirationCommentQuery) => Promise<PageData<InspirationCommentDTO>>

// 回复评论
replyComment: (commentId: number, data: { content: string; replyToUserId?: number }) => Promise<InspirationCommentDTO>
```

---

## 待后端实现的API

### 1. 评论回复相关
**数据库模型修改**:
- `CaseComment` 模型需要添加 `ParentID` 字段（支持回复功能）
- `CaseComment` 模型需要添加 `ReplyToUserID` 字段（支持@某人）

**后端接口**:
```
GET    /api/v1/inspiration/comments/:id              - 获取评论详情
GET    /api/v1/inspiration/comments/:id/replies      - 获取评论回复列表
POST   /api/v1/inspiration/comments/:id/replies      - 回复评论
DELETE /api/v1/inspiration/comments/:id              - 删除评论
POST   /api/v1/inspiration/comments/:id/report       - 举报评论
```

**数据库表结构建议**:
```sql
-- 修改 case_comments 表
ALTER TABLE case_comments ADD COLUMN parent_id BIGINT DEFAULT NULL;
ALTER TABLE case_comments ADD COLUMN reply_to_user_id BIGINT DEFAULT NULL;
ALTER TABLE case_comments ADD INDEX idx_parent_id (parent_id);

-- 创建举报表
CREATE TABLE comment_reports (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  comment_id BIGINT NOT NULL,
  user_id BIGINT NOT NULL,
  reason VARCHAR(50) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_comment_id (comment_id),
  INDEX idx_user_id (user_id)
);
```

---

## 验收标准

### 已完成 ✅
- [x] 敏感词错误有友好提示
- [x] 评论卡片有操作菜单（删除/举报）
- [x] 用户可以点击"回复"按钮跳转到评论详情页
- [x] 评论详情页UI完整（原评论、回复列表、发布回复按钮）
- [x] 所有功能响应式布局，适配不同屏幕
- [x] 错误处理完整，用户体验流畅
- [x] 所有文本使用中文
- [x] 遵循项目的TypeScript规范

### 待后端完成后测试 ⏳
- [ ] 用户可以删除自己的评论
- [ ] 用户可以举报不当评论
- [ ] 用户可以回复评论
- [ ] 用户可以回复其他人的回复（@某人）
- [ ] 回复列表支持分页加载

---

## 使用说明

### 开发环境运行
```bash
cd mini
npm install
npm run dev:weapp
```

### 测试流程
1. 打开微信开发者工具，导入 `mini/dist` 目录
2. 进入灵感详情页
3. 测试敏感词提示：发布包含敏感词的评论
4. 测试操作菜单：点击评论右上角"···"按钮
5. 测试回复功能：点击评论下方"回复"按钮（需要后端API支持）

---

## 注意事项

1. **后端API未实现**：评论回复、删除、举报功能的API调用已经写好，但后端接口尚未实现。前端代码会在调用时返回404错误。

2. **数据模型需要修改**：`CaseComment` 模型需要添加 `ParentID` 和 `ReplyToUserID` 字段才能支持回复功能。

3. **权限控制**：删除评论时需要验证用户是否是评论作者（前端已实现判断，后端也需要验证）。

4. **敏感词检测**：回复评论时也需要进行敏感词检测（前端已实现错误提示）。

5. **通知功能**：当用户被@回复时，可以考虑发送通知（后端功能）。

---

## 后续优化建议

1. **评论点赞功能**：可以为评论添加点赞功能
2. **评论排序**：支持按时间/热度排序
3. **评论搜索**：支持搜索评论内容
4. **评论图片**：支持评论中上传图片
5. **评论表情**：支持评论中使用表情
6. **评论草稿**：支持评论草稿自动保存（已实现）

---

## 文件清单

### 修改的文件
- `mini/src/pages/inspiration/detail/index.tsx` - 灵感详情页（添加敏感词提示、操作菜单、回复按钮）
- `mini/src/pages/inspiration/detail/index.scss` - 灵感详情页样式（添加操作按钮样式）
- `mini/src/services/inspiration.ts` - API服务（添加评论相关接口）
- `mini/src/app.config.ts` - 应用配置（注册评论详情页）

### 新增的文件
- `mini/src/pages/inspiration/comment-detail/index.tsx` - 评论详情页组件
- `mini/src/pages/inspiration/comment-detail/index.scss` - 评论详情页样式
- `mini/SOCIAL_FEATURES_IMPLEMENTATION.md` - 本说明文档

---

**实现时间**: 2026-04-20
**实现者**: Claude Sonnet 4.6
**状态**: 前端UI完成，等待后端API实现
