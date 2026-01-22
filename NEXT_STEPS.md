# 灵感图库社交功能 - 后续实施指南

## 当前状态
✅ **后端开发 100% 完成** (Tasks 1-14)
- 所有 API 接口已实现并通过编译测试
- 数据库迁移脚本已就绪
- 移动端 API 层已封装完成

🚧 **前端开发待启动** (Tasks 15-28)
- 9 个移动端 UI 任务
- 4 个管理后台 UI 任务  
- 1 个数据准备任务

---

## 快速启动指南

### 1. 运行数据库迁移
```bash
cd server
# 执行迁移 SQL
psql -U postgres -d home_decoration < migrations/20260121_add_social_features.sql
```

### 2. 启动后端服务
```bash
cd server
make dev  # 或 go run ./cmd/api
```

### 3. 测试 API 接口
```bash
# 获取灵感列表（无需登录）
curl http://localhost:8080/api/v1/inspiration

# 点赞（需要登录 token）
curl -X POST http://localhost:8080/api/v1/inspiration/1/like \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### 4. 移动端集成
```bash
cd mobile
npm install
npm run android  # 或 npm run ios
```

在 `mobile/src/screens/InspirationScreen.tsx` 中：
```typescript
import { inspirationApi } from '../services/api';

// 替换 mock 数据为真实 API 调用
const fetchData = async () => {
  const res = await inspirationApi.list({ page: 1 });
  setData(res.data.list);
};
```

---

## 前端任务清单

### 移动端 (React Native)

#### 阶段 1：基础功能 (Tasks 15-17)
- [ ] **Task 15**: 修复 InspirationScreen 顶部颜色断层
  - 文件：`mobile/src/screens/InspirationScreen.tsx`
  - 工作量：30 分钟
  - 修改 SafeAreaView backgroundColor

- [ ] **Task 16**: 切换数据源为后端接口
  - 文件：`mobile/src/screens/InspirationScreen.tsx`
  - 工作量：1 小时
  - 替换 mock 数据，添加加载状态

- [ ] **Task 17**: 卡片爱心可点击（乐观更新）
  - 文件：`mobile/src/screens/InspirationScreen.tsx`
  - 工作量：2 小时
  - 实现点赞交互 + 乐观更新 + 错误回滚

#### 阶段 2：详情页重构 (Tasks 18-20)
- [ ] **Task 18**: InspirationDetails 视差布局
  - 文件：`mobile/src/screens/InspirationDetails.tsx`
  - 工作量：4 小时
  - 参考 CaseDetailScreen 实现

- [ ] **Task 19**: 新增评论区模块
  - 文件：`mobile/src/components/CommentSection.tsx`
  - 工作量：3 小时
  - 评论列表 + 输入框 + 提交

- [ ] **Task 20**: 底部 action bar
  - 文件：`mobile/src/screens/InspirationDetails.tsx`
  - 工作量：2 小时
  - 点赞/评论/收藏三个按钮

#### 阶段 3：收藏功能 (Tasks 21-23)
- [ ] **Task 21**: 新增 FavoritesScreen
  - 文件：`mobile/src/screens/FavoritesScreen.tsx`
  - 工作量：3 小时
  - Tab 导航 + 两个列表

- [ ] **Task 22**: ProfileScreen 跳转改造
  - 文件：`mobile/src/screens/ProfileScreen.tsx`
  - 工作量：15 分钟
  - 添加导航跳转

- [ ] **Task 23**: MaterialShopDetailScreen 收藏对接
  - 文件：`mobile/src/screens/MaterialShopDetailScreen.tsx`
  - 工作量：1 小时
  - 替换 mock 为真实 API

**移动端总工作量：约 16.75 小时**

---

### 管理后台 (React + Ant Design)

#### 阶段 4：作品管理增强 (Tasks 24-25)
- [ ] **Task 24**: 新增展示开关列
  - 文件：`admin/src/pages/cases/CaseManagement.tsx`
  - 工作量：1 小时
  - 添加 Switch 列 + 快捷切换

- [ ] **Task 25**: 批量删除功能
  - 文件：`admin/src/pages/cases/CaseManagement.tsx`
  - 工作量：2 小时
  - 选择框 + 确认弹窗 + DELETE 输入验证

#### 阶段 5：新增管理页面 (Tasks 26-27)
- [ ] **Task 26**: CommentManagement 页面
  - 文件：`admin/src/pages/comments/CommentManagement.tsx`
  - 工作量：4 小时
  - 列表 + 筛选 + 状态切换

- [ ] **Task 27**: SensitiveWords 页面
  - 文件：`admin/src/pages/settings/SensitiveWords.tsx`
  - 工作量：3 小时
  - CRUD 表单 + 列表

**管理后台总工作量：约 10 小时**

---

### 数据准备 (Task 28)

- [ ] **Task 28**: 敏感词初始数据
  - 工作量：2 小时
  - 下载词库 + 编写导入脚本 + 执行导入

---

## 总工作量估算

| 模块 | 任务数 | 预估工时 |
|------|--------|----------|
| 移动端 UI | 9 | 16.75h |
| 管理后台 UI | 4 | 10h |
| 数据准备 | 1 | 2h |
| **总计** | **14** | **28.75h** |

按 1 人全职开发，约需 **4 个工作日**完成。

---

## 技术要点

### 移动端开发注意事项
1. **乐观更新模式**：点赞/收藏操作先更新 UI，失败后回滚
2. **错误处理**：网络失败时显示 Toast 提示
3. **分页加载**：列表使用 FlatList 的 onEndReached
4. **图片优化**：使用 FastImage 替代 Image 组件

### 管理后台开发注意事项
1. **权限控制**：确保路由已配置 AdminJWT 中间件
2. **表单验证**：使用 Ant Design Form 的 rules
3. **操作确认**：危险操作（删除）必须二次确认
4. **审计日志**：所有操作自动记录（后端已实现）

---

## 测试检查清单

### 移动端测试
- [ ] 未登录用户可浏览灵感列表
- [ ] 登录用户可点赞/收藏/评论
- [ ] 点赞数实时更新
- [ ] 评论提交后立即显示
- [ ] 敏感词评论被拒绝
- [ ] 收藏列表正确显示两种类型
- [ ] 网络错误时有友好提示

### 管理后台测试
- [ ] 作品列表显示 showInInspiration 状态
- [ ] 快捷切换开关生效
- [ ] 批量删除需要输入 DELETE 确认
- [ ] 评论管理可切换状态
- [ ] 敏感词 CRUD 正常工作
- [ ] 操作日志正确记录

---

## 部署清单

### 生产环境准备
1. [ ] 执行数据库迁移
2. [ ] 导入敏感词初始数据
3. [ ] 配置 CDN 图片域名
4. [ ] 设置 Redis 缓存（可选）
5. [ ] 配置监控告警

### 性能优化建议
- 灵感列表接口添加 Redis 缓存（5 分钟）
- 点赞数/评论数使用 Redis 计数器
- 图片使用 WebP 格式 + CDN 加速
- 评论列表分页大小限制为 20

---

## 联系与支持

如有问题，请参考：
- API 文档：`IMPLEMENTATION_STATUS.md`
- 后端代码：`server/internal/handler/inspiration_handler.go`
- 移动端 API：`mobile/src/services/api.ts`

**后端 API 已完全就绪，可立即开始前端开发！** 🚀
