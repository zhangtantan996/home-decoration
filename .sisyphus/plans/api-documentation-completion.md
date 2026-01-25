# API 文档补全工作计划

**版本**: 1.0  
**日期**: 2026-01-25  
**规划者**: Prometheus  

---

## Context

### Original Request
用户发现项目 API 文档覆盖率严重不足（约 50%），缺失 105+ 个端点的文档，要求制定完整的补全计划。

### Interview Summary
**Key Discussions**:
- 现有 `documentation/04-后端开发/API接口/` 目录有 5 个模块文档
- 缺失关键模块：Tinode 集成、方案管理、订单支付、通知系统、Admin 后台
- 旧文档 `server/docs/API接口文档.md` 有编码损坏（第 183-260 行）

**User Decisions**:
- 输出格式：仅 Markdown（不需要 OpenAPI/Postman）
- Admin 文档：单独目录，按功能拆分多个文件
- 业务流程图：需要（Mermaid 格式）
- 旧文档：修复编码问题并保留
- 文档语言：仅中文

### Metis Review
**Identified Gaps** (addressed):
- 文档维护策略：添加"最后验证日期"字段
- 范围边界：明确排除 Debug 端点和未实现端点
- 流程图数量：限制为 3-5 个核心流程
- 编码修复：手动审核重写（最安全）

---

## Work Objectives

### Core Objective
补全项目 API 文档，将覆盖率从 50% 提升至 100%，让开发者能快速查阅所有接口。

### Concrete Deliverables
- 补充 105+ 个缺失端点的文档
- 创建 `管理后台/` 子目录，包含 8 个功能模块文档
- 3-5 个业务流程图（Mermaid 格式）
- 修复旧文档编码问题

### Definition of Done
- [x] 所有公开 API 端点都有文档
- [x] Admin 文档按功能模块拆分
- [x] 核心业务流程有 Mermaid 图
- [x] 旧文档编码问题已修复
- [x] 所有 Markdown 文件在 GitHub 正常渲染

### Must Have
- 每个端点包含：路径、方法、认证、请求参数、响应格式、错误码
- 遵循现有文档格式（参考认证模块.md）
- 中文文档

### Must NOT Have (Guardrails)
- 不生成 OpenAPI/Swagger 规范
- 不生成 Postman Collection
- 不修改现有 5 个模块文档的结构
- 不文档化 Debug 端点（/debug/*）
- 不文档化未实现的端点
- 不创建英文版本

---

## Verification Strategy

### QA Approach
- **Manual verification**: 人工审核文档完整性
- **Cross-check**: 对比 router.go 确保无遗漏
- **Render test**: 在 VS Code/GitHub 验证 Markdown 渲染

### Acceptance Criteria Template
每个文档任务完成后验证：
- [x] 端点路径与 router.go 一致
- [x] 请求/响应示例可解析为有效 JSON
- [x] Mermaid 图无语法错误
- [x] 文件编码为 UTF-8

---

## Task Flow

```
Phase 1 (准备) ──> Phase 2 (核心模块) ──> Phase 3 (Admin模块) ──> Phase 4 (流程图) ──> Phase 5 (修复旧文档)
```

---

## TODOs

### Task 1: 创建 Admin 文档目录结构

**What to do**:
- 创建 `documentation/04-后端开发/API接口/管理后台/` 目录
- 创建 README.md 作为 Admin API 导航入口

**Must NOT do**:
- 不修改现有目录结构

**Parallelizable**: YES (独立任务)

**References**:
- `documentation/04-后端开发/API接口/` - 现有目录结构
- `documentation/README.md` - 导航格式参考

**Acceptance Criteria**:
- [x] 目录创建成功
- [x] README.md 包含 Admin 模块导航

**Commit**: YES
- Message: `docs: create admin API documentation structure`
- Files: `documentation/04-后端开发/API接口/管理后台/README.md`

---

### Task 2: 补充方案管理模块文档（用户端）

**What to do**:
- 创建 `documentation/04-后端开发/API接口/方案模块.md`
- 文档化 6 个用户端方案管理端点：
  - `GET /api/v1/proposals` - 方案列表
  - `GET /api/v1/proposals/pending-count` - 待处理数量
  - `GET /api/v1/proposals/booking/:bookingId/history` - 版本历史
  - `GET /api/v1/proposals/:id` - 方案详情
  - `POST /api/v1/proposals/:id/confirm` - 确认方案
  - `POST /api/v1/proposals/:id/reject` - 拒绝方案

**Must NOT do**:
- 不包含商家端方案端点（单独文档）

**Parallelizable**: YES (与 Task 3, 4 并行)

**References**:
- `server/internal/handler/business_flow_handler.go` - Handler 实现
- `server/internal/router/router.go:180-200` - 路由定义
- `documentation/04-后端开发/API接口/认证模块.md` - 文档格式参考

**Acceptance Criteria**:
- [x] 6 个端点全部文档化
- [x] 包含方案状态流转说明
- [x] 包含版本管理说明

**Commit**: YES
- Message: `docs: add proposal management API documentation`
- Files: `documentation/04-后端开发/API接口/方案模块.md`

---

### Task 3: 补充订单支付模块文档

**What to do**:
- 创建 `documentation/04-后端开发/API接口/订单模块.md`
- 文档化 5 个订单支付端点：
  - `GET /api/v1/orders/pending-payments` - 待支付列表
  - `GET /api/v1/orders/:id` - 订单详情
  - `POST /api/v1/orders/:id/pay` - 支付订单
  - `DELETE /api/v1/orders/:id` - 取消订单
  - `POST /api/v1/orders/plans/:planId/pay` - 支付分期

**Must NOT do**:
- 不包含支付回调实现细节（属于内部逻辑）

**Parallelizable**: YES (与 Task 2, 4 并行)

**References**:
- `server/internal/handler/order_handler.go` - Handler 实现
- `server/internal/handler/business_flow_handler.go:PayPaymentPlan` - 分期支付
- `server/internal/router/router.go:200-220` - 路由定义

**Acceptance Criteria**:
- [x] 5 个端点全部文档化
- [x] 包含订单状态说明
- [x] 包含支付方式说明

**Commit**: YES
- Message: `docs: add order and payment API documentation`
- Files: `documentation/04-后端开发/API接口/订单模块.md`

---

### Task 4: 补充通知系统模块文档

**What to do**:
- 创建 `documentation/04-后端开发/API接口/通知模块.md`
- 文档化 5 个通知端点（用户/商家/管理员共用）：
  - `GET /notifications` - 通知列表
  - `GET /notifications/unread-count` - 未读数量
  - `PUT /notifications/:id/read` - 标记已读
  - `PUT /notifications/read-all` - 全部已读
  - `DELETE /notifications/:id` - 删除通知
- 说明三种角色的路径前缀差异

**Must NOT do**:
- 不重复文档化相同逻辑

**Parallelizable**: YES (与 Task 2, 3 并行)

**References**:
- `server/internal/handler/notification_handler.go` - Handler 实现
- `server/internal/router/router.go` - 三处路由注册

**Acceptance Criteria**:
- [x] 5 个端点全部文档化
- [x] 说明用户/商家/管理员路径差异
- [x] 包含通知类型枚举

**Commit**: YES
- Message: `docs: add notification system API documentation`
- Files: `documentation/04-后端开发/API接口/通知模块.md`

---

### Task 5: 补充 Tinode 聊天集成文档

**What to do**:
- 更新 `documentation/04-后端开发/API接口/聊天模块.md`
- 添加 Tinode 集成端点：
  - `GET /api/v1/tinode/userid/:userId` - 获取 Tinode 用户 ID
  - `DELETE /api/v1/tinode/topic/:topic/messages` - 清空聊天记录
  - `POST /api/v1/tinode/refresh-token` - 刷新 Tinode Token
- 说明 Tinode 与腾讯云 IM 的关系（Tinode 为主，腾讯云为备用）

**Must NOT do**:
- 不删除现有聊天模块内容

**Parallelizable**: NO (依赖现有文件)

**References**:
- `server/internal/handler/tinode_handler.go` - Tinode Handler
- `server/internal/handler/im_handler.go` - 腾讯云 IM Handler
- `documentation/06-即时通讯/Tinode集成.md` - Tinode 架构说明

**Acceptance Criteria**:
- [x] Tinode 3 个端点文档化
- [x] 腾讯云 IM 备用方案说明
- [x] 包含 Topic 格式说明

**Commit**: YES
- Message: `docs: add Tinode chat integration API documentation`
- Files: `documentation/04-后端开发/API接口/聊天模块.md`

---

### Task 6: 补充公共模块文档（字典、区域、灵感图库）

**What to do**:
- 创建 `documentation/04-后端开发/API接口/公共模块.md`
- 文档化公共端点：
  - 字典 API (2 端点)
  - 区域 API (4 端点)
  - 灵感图库 API (7 端点)
  - 材料商店收藏 (2 端点)
  - 文件上传 (1 端点)

**Must NOT do**:
- 不包含需要认证的端点（放在用户模块）

**Parallelizable**: YES (独立任务)

**References**:
- `server/internal/handler/dictionary_handler.go` - 字典 Handler
- `server/internal/handler/region_handler.go` - 区域 Handler
- `server/internal/handler/inspiration_handler.go` - 灵感图库 Handler
- `server/internal/handler/upload_handler.go` - 上传 Handler

**Acceptance Criteria**:
- [x] 16 个端点全部文档化
- [x] 字典分类说明
- [x] 区域层级说明（省-市-区）
- [x] 文件上传格式/大小限制

**Commit**: YES
- Message: `docs: add public API documentation (dictionary, region, inspiration)`
- Files: `documentation/04-后端开发/API接口/公共模块.md`

---

### Task 7: 更新用户模块文档（补充缺失端点）

**What to do**:
- 更新 `documentation/04-后端开发/API接口/用户模块.md`
- 补充缺失端点：
  - `GET /api/v1/user/favorites` - 用户收藏夹
  - `GET /api/v1/projects/:id/bill` - 项目账单
  - `POST /api/v1/projects/:id/bill` - 生成账单
  - `GET /api/v1/projects/:id/files` - 项目文件

**Must NOT do**:
- 不重构现有内容结构

**Parallelizable**: NO (依赖现有文件)

**References**:
- `server/internal/handler/handler.go` - 用户 Handler
- `server/internal/handler/business_flow_handler.go` - 业务流程 Handler

**Acceptance Criteria**:
- [x] 4 个缺失端点补充完成
- [x] 与现有内容风格一致

**Commit**: YES
- Message: `docs: update user module API documentation`
- Files: `documentation/04-后端开发/API接口/用户模块.md`

---

### Task 8: 更新商家模块文档（补充缺失端点）

**What to do**:
- 更新 `documentation/04-后端开发/API接口/商家模块.md`
- 补充缺失端点：
  - 方案管理扩展 (6 端点)
  - 信息管理扩展 (3 端点)
  - IM 集成 (2 端点)
  - 案例管理扩展 (2 端点)

**Must NOT do**:
- 不重构现有内容结构

**Parallelizable**: NO (依赖现有文件)

**References**:
- `server/internal/handler/merchant_handler.go` - 商家 Handler
- `server/internal/handler/merchant_case_handler.go` - 案例 Handler
- `server/internal/handler/merchant_im_handler.go` - IM Handler

**Acceptance Criteria**:
- [x] 13 个缺失端点补充完成
- [x] 与现有内容风格一致

**Commit**: YES
- Message: `docs: update merchant module API documentation`
- Files: `documentation/04-后端开发/API接口/商家模块.md`

---

### Task 9: Admin 用户管理模块文档

**What to do**:
- 创建 `documentation/04-后端开发/API接口/管理后台/用户管理.md`
- 文档化端点：
  - `GET /api/v1/admin/users` - 用户列表
  - `GET /api/v1/admin/users/:id` - 用户详情
  - `POST /api/v1/admin/users` - 创建用户
  - `PUT /api/v1/admin/users/:id` - 更新用户
  - `PATCH /api/v1/admin/users/:id/status` - 更新状态

**Parallelizable**: YES (与其他 Admin 任务并行)

**References**:
- `server/internal/handler/admin_handler.go:AdminListUsers` - Handler 实现
- `server/internal/router/router.go:300-350` - Admin 路由

**Acceptance Criteria**:
- [x] 5 个端点全部文档化
- [x] 包含用户状态枚举
- [x] 包含筛选参数说明

**Commit**: YES (与 Task 10-16 合并提交)
- Message: `docs: add admin user management API documentation`

---

### Task 10: Admin 商家管理模块文档

**What to do**:
- 创建 `documentation/04-后端开发/API接口/管理后台/商家管理.md`
- 文档化端点：
  - 服务商管理 (5 端点)
  - 商家申请审核 (4 端点)
  - 材料商店管理 (5 端点)

**Parallelizable**: YES (与其他 Admin 任务并行)

**References**:
- `server/internal/handler/admin_handler.go` - 服务商管理
- `server/internal/handler/merchant_apply_handler.go` - 申请审核

**Acceptance Criteria**:
- [x] 14 个端点全部文档化
- [x] 包含审核状态流转

**Commit**: YES (合并提交)

---

### Task 11: Admin 内容审核模块文档

**What to do**:
- 创建 `documentation/04-后端开发/API接口/管理后台/内容审核.md`
- 文档化端点：
  - 案例审核 (4 端点)
  - 评论管理 (2 端点)
  - 敏感词管理 (5 端点)

**Parallelizable**: YES (与其他 Admin 任务并行)

**References**:
- `server/internal/handler/admin_audit_handler.go` - 审核 Handler
- `server/internal/handler/admin_comment_handler.go` - 评论 Handler
- `server/internal/handler/admin_sensitive_word_handler.go` - 敏感词 Handler

**Acceptance Criteria**:
- [x] 11 个端点全部文档化
- [x] 包含审核状态说明
- [x] 包含敏感词导入格式

**Commit**: YES (合并提交)

---

### Task 12: Admin 订单与预约模块文档

**What to do**:
- 创建 `documentation/04-后端开发/API接口/管理后台/订单预约.md`
- 文档化端点：
  - 预约管理 (4 端点)
  - 争议处理 (3 端点)

**Parallelizable**: YES (与其他 Admin 任务并行)

**References**:
- `server/internal/handler/admin_handler.go:AdminListBookings` - 预约管理
- `server/internal/handler/admin_dispute_handler.go` - 争议处理

**Acceptance Criteria**:
- [x] 7 个端点全部文档化
- [x] 包含退款流程说明
- [x] 包含争议处理状态

**Commit**: YES (合并提交)

---

### Task 13: Admin 项目管理模块文档

**What to do**:
- 创建 `documentation/04-后端开发/API接口/管理后台/项目管理.md`
- 文档化端点：
  - 项目列表/详情 (3 端点)
  - 阶段管理 (2 端点)
  - 工作日志 (4 端点)

**Parallelizable**: YES (与其他 Admin 任务并行)

**References**:
- `server/internal/handler/admin_project_handler.go` - 项目 Handler

**Acceptance Criteria**:
- [x] 9 个端点全部文档化
- [x] 包含项目状态枚举
- [x] 包含阶段类型说明

**Commit**: YES (合并提交)

---

### Task 14: Admin 财务管理模块文档

**What to do**:
- 创建 `documentation/04-后端开发/API接口/管理后台/财务管理.md`
- 文档化端点：
  - 托管账户 (3 端点)
  - 提现管理 (4 端点)

**Parallelizable**: YES (与其他 Admin 任务并行)

**References**:
- `server/internal/handler/admin_new_handler.go` - 财务 Handler
- `server/internal/handler/admin_withdraw_handler.go` - 提现 Handler

**Acceptance Criteria**:
- [x] 7 个端点全部文档化
- [x] 包含提现状态流转
- [x] 包含手续费说明

**Commit**: YES (合并提交)

---

### Task 15: Admin 系统配置模块文档

**What to do**:
- 创建 `documentation/04-后端开发/API接口/管理后台/系统配置.md`
- 文档化端点：
  - 系统设置 (2 端点)
  - 系统配置 (3 端点)
  - 字典管理 (8 端点)
  - 区域管理 (3 端点)
  - 操作日志 (1 端点)

**Parallelizable**: YES (与其他 Admin 任务并行)

**References**:
- `server/internal/handler/admin_new_handler.go` - 系统设置
- `server/internal/handler/dictionary_handler.go` - 字典管理

**Acceptance Criteria**:
- [x] 17 个端点全部文档化
- [x] 包含配置项说明
- [x] 包含字典分类管理

**Commit**: YES (合并提交)

---

### Task 16: Admin RBAC 权限模块文档

**What to do**:
- 创建 `documentation/04-后端开发/API接口/管理后台/权限管理.md`
- 文档化端点：
  - 管理员管理 (5 端点)
  - 角色管理 (5 端点)
  - 菜单管理 (4 端点)

**Parallelizable**: YES (与其他 Admin 任务并行)

**References**:
- `server/internal/handler/admin_auth_handler.go` - RBAC Handler
- `server/internal/handler/admin_new_handler.go` - 管理员 Handler

**Acceptance Criteria**:
- [x] 14 个端点全部文档化
- [x] 包含权限分配说明
- [x] 包含菜单树结构

**Commit**: YES
- Message: `docs: add admin API documentation (8 modules)`
- Files: `documentation/04-后端开发/API接口/管理后台/*.md`

---

### Task 17: 创建业务流程图

**What to do**:
- 创建 `documentation/04-后端开发/API接口/00-业务流程图.md`
- 使用 Mermaid 绘制 4 个核心流程：
  1. 用户认证流程（登录/注册/Token刷新）
  2. 预约到订单流程（预约→方案→确认→订单→支付）
  3. 项目进度流程（阶段→验收→资金释放）
  4. 商家入驻流程（申请→审核→开通）

**Must NOT do**:
- 不为简单 CRUD 创建流程图

**Parallelizable**: YES (独立任务)

**References**:
- `documentation/03-产品设计/业务流程.md` - 业务流程说明
- `server/internal/router/router.go` - API 调用顺序

**Acceptance Criteria**:
- [x] 4 个流程图全部完成
- [x] Mermaid 语法正确，可渲染
- [x] 标注关键 API 端点

**Commit**: YES
- Message: `docs: add API business flow diagrams`
- Files: `documentation/04-后端开发/API接口/00-业务流程图.md`

---

### Task 18: 修复旧文档编码问题

**What to do**:
- 修复 `server/docs/API接口文档.md` 第 183-260 行的编码损坏
- 手动重写微信小程序登录部分（参考新文档格式）
- 添加文件头注释说明此文档为历史存档

**Must NOT do**:
- 不使用自动替换（风险高）
- 不删除旧文档

**Parallelizable**: YES (独立任务)

**References**:
- `documentation/04-后端开发/API接口/认证模块.md:141-165` - 微信登录新文档
- `server/internal/handler/wechat_auth_handler.go` - Handler 实现

**Acceptance Criteria**:
- [x] 乱码部分修复完成
- [x] 文件编码为 UTF-8
- [x] 添加存档说明

**Commit**: YES
- Message: `docs: fix encoding issues in legacy API documentation`
- Files: `server/docs/API接口文档.md`

---

### Task 19: 更新文档导航

**What to do**:
- 更新 `documentation/04-后端开发/API接口/` 目录的导航
- 更新 `documentation/README.md` 的 API 文档状态

**Must NOT do**:
- 不修改其他章节

**Parallelizable**: NO (依赖前面任务完成)

**References**:
- `documentation/README.md` - 主导航

**Acceptance Criteria**:
- [x] 所有新文档在导航中可见
- [x] 状态标记为"已完成"

**Commit**: YES
- Message: `docs: update API documentation navigation`
- Files: `documentation/README.md`

---

## Commit Strategy

| After Task | Message | Files |
|------------|---------|-------|
| 1 | `docs: create admin API documentation structure` | 管理后台/README.md |
| 2 | `docs: add proposal management API documentation` | 方案模块.md |
| 3 | `docs: add order and payment API documentation` | 订单模块.md |
| 4 | `docs: add notification system API documentation` | 通知模块.md |
| 5 | `docs: add Tinode chat integration API documentation` | 聊天模块.md |
| 6 | `docs: add public API documentation` | 公共模块.md |
| 7 | `docs: update user module API documentation` | 用户模块.md |
| 8 | `docs: update merchant module API documentation` | 商家模块.md |
| 9-16 | `docs: add admin API documentation (8 modules)` | 管理后台/*.md |
| 17 | `docs: add API business flow diagrams` | 00-业务流程图.md |
| 18 | `docs: fix encoding issues in legacy API documentation` | server/docs/API接口文档.md |
| 19 | `docs: update API documentation navigation` | README.md |

---

## Success Criteria

### Verification Commands
```bash
# 检查所有新文档文件
ls -la documentation/04-后端开发/API接口/
ls -la documentation/04-后端开发/API接口/管理后台/

# 验证 Markdown 语法
npx markdownlint documentation/04-后端开发/API接口/**/*.md

# 统计端点覆盖
grep -c "接口.*:" documentation/04-后端开发/API接口/*.md
```

### Final Checklist
- [x] 105+ 缺失端点全部文档化
- [x] Admin 模块拆分为 8 个文件
- [x] 4 个业务流程图完成
- [x] 旧文档编码问题修复
- [x] 所有文档在 GitHub 正常渲染
- [x] 导航更新完成

---

## Estimated Effort

| Phase | Tasks | Estimated Time |
|-------|-------|----------------|
| Phase 1 (准备) | Task 1 | 0.5h |
| Phase 2 (核心模块) | Task 2-8 | 8h |
| Phase 3 (Admin模块) | Task 9-16 | 10h |
| Phase 4 (流程图) | Task 17 | 2h |
| Phase 5 (修复/导航) | Task 18-19 | 1.5h |
| **Total** | 19 Tasks | **~22h** |
