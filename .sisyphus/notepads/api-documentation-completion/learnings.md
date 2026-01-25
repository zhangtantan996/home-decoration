2026-01-25: 初始创建管理后台 API README 导航，遵循 documentation/ README 格式，准备后续 8 个子模块。


2026-01-25: 完成方案模块（用户端）API 文档创建
- 文档化 6 个用户端方案管理端点（列表、待处理数量、版本历史、详情、确认、拒绝）
- 包含方案状态流转说明（pending → confirmed/rejected）
- 包含版本管理说明（v1, v2, v3...，拒绝后商家可重新提交）
- 说明确认方案后创建设计费订单（48小时支付窗口）
- 说明拒绝方案需提供原因（5-500字符），累计拒绝3次进入争议处理
- 遵循认证模块.md的文档格式（概述、API列表、错误码、使用示例、注意事项）
- 所有端点包含完整的请求参数、响应示例、字段说明、业务规则
- 从 business_flow_handler.go 提取实现细节，从 router.go 确认路由路径
- 从 business_flow.go 模型文件提取字段定义和状态枚举



## 订单模块文档化 (2026-01-25)

### 实现细节
- 订单模块包含 5 个核心端点：待支付列表、订单详情、支付订单、取消订单、支付分期
- 待支付列表聚合了意向金订单（Booking）和设计费订单（Order），按创建时间倒序
- 订单状态流转：pending(0) → paid(1) → completed / cancelled(2) / refunded(3)
- 订单类型：intent_fee（意向金）、design（设计费）、construction（施工款）、material（主材费）
- 设计费订单有 48 小时支付期限（expireAt），意向金无过期时间
- 意向金可抵扣设计费，记录在 Order.Discount 字段

### 权限验证逻辑
- GetOrder: 通过 Order → Proposal → Booking → UserID 验证归属权限
- PayOrder/CancelOrder: 在 service 层验证用户权限
- PayPaymentPlan: 验证支付计划归属的订单是否属于当前用户

### 分期支付机制
- PaymentPlan 表记录分期计划，包含期数（seq）、名称（name）、金额（amount）、百分比（percentage）
- 常见分期：开工款（30%）、水电款（20%）、泥木款（20%）、竣工款（30%）
- 支付类型：milestone（里程碑）、onetime（一次性）

### 文档格式遵循
- 参考认证模块文档格式，包含：概述、状态说明、API 列表、错误码、使用示例
- 每个端点包含：接口路径、描述、认证要求、请求参数、响应示例、字段说明、错误响应
- 使用中文文档，包含最后更新日期
- 添加业务规则说明章节，解释订单过期、意向金抵扣、分期支付规则


## 通知模块文档化 (2026-01-25)

### 实现细节
- 通知模块包含 5 个核心端点：通知列表、未读数量、标记已读、全部已读、删除通知
- 三种角色（用户/商家/管理员）共用相同的 handler，通过路径前缀区分：
  - 用户：`/api/v1/notifications`
  - 商家：`/api/v1/merchant/notifications`
  - 管理员：`/api/v1/admin/notifications`
- Handler 通过检查上下文字段自动识别角色：admin_id → provider_id → user_id

### 通知类型系统
- 定义了 17 种通知类型常量（booking、proposal、order、withdraw、audit、case_audit）
- 通知类型格式：`{业务模块}.{事件}`（如 `booking.intent_paid`、`proposal.submitted`）
- 每种通知类型包含：标题、内容、关联对象（relatedId/relatedType）、跳转链接（actionUrl）、扩展数据（extra）

### 数据模型
- Notification 表字段：userId、userType、title、content、type、relatedId、relatedType、isRead、readAt、actionUrl、extra
- userType 枚举：user（普通用户）、provider（商家）、admin（管理员）
- extra 字段为 JSON 字符串，存储业务相关的扩展数据

### 业务触发场景
- 预约流程：意向金支付 → 商家接单 → 意向金退款
- 方案流程：提交方案 → 确认方案 → 拒绝方案（含原因）
- 订单流程：生成订单 → 支付订单 → 订单过期提醒
- 提现流程：审核通过 → 审核拒绝（含原因） → 提现完成
- 审核流程：服务商审核 → 作品审核

### 权限验证逻辑
- 所有操作只能操作属于当前用户的通知
- 通过 `user_id = ? AND user_type = ?` 双重验证确保数据隔离
- 标记已读/删除操作验证 `RowsAffected`，不存在时返回错误

### 文档格式遵循
- 参考认证模块文档格式，包含：概述、路径前缀说明、通知类型枚举、API 列表、错误码、使用示例、注意事项
- 每个端点包含：接口路径、描述、认证要求、请求参数、响应示例、字段说明、错误响应、业务规则
- 使用中文文档，包含最后更新日期
- 添加三种角色的路径前缀对比表，说明共用 handler 的实现机制
- 添加通知类型枚举表，包含类型常量、值、说明、接收角色
- 添加 Extra 字段解析示例，说明不同业务场景的扩展数据结构
- 添加前端集成建议（轮询、WebSocket、本地缓存、跳转处理）
- 添加性能优化和数据清理策略说明


## 2026-01-25: Tinode Chat Integration API Documentation

### Task Completed
Updated `documentation/04-后端开发/API接口/聊天模块.md` with Tinode integration endpoints.

### Endpoints Added
1. **GET /api/v1/tinode/userid/:userId** - Get Tinode user ID for business user
   - Returns format: `usr{id}` (e.g., usr123)
   - Auto-syncs user to Tinode DB (idempotent)
   
2. **DELETE /api/v1/tinode/topic/:topic/messages** - Clear chat history
   - Requires admin permission on the topic
   - Topic formats: `usr{id1}_usr{id2}` (private) or `grp{id}` (group)
   - Error handling: 403 for insufficient permission, 404 for non-member
   
3. **POST /api/v1/tinode/refresh-token** - Refresh Tinode authentication token
   - Token validity: 7 days (604800 seconds)
   - Returns new tinodeToken or error message

### Architecture Notes
- **Primary IM**: Tinode (self-hosted open source, 85% migration complete)
- **Backup IM**: Tencent Cloud IM (maintained until 2026-07-24, security fixes only)
- **User ID Mapping**: Business user ID → Tinode user ID (`usr{id}`)
- **Topic Naming**: Private chat uses smaller ID first (usr123_usr456), groups use grp{id}

### Documentation Structure
- Preserved all existing content (5 original endpoints)
- Added 3 new Tinode management endpoints (sections 6-8)
- Added "Tinode 与腾讯云 IM 的关系" section explaining migration strategy
- Enhanced usage examples with token refresh flow

### Implementation References
- Handler: `server/internal/handler/tinode_handler.go` (GetTinodeUserID, ClearChatHistory)
- Handler: `server/internal/handler/handler.go` (RefreshTinodeToken)
- Backup: `server/internal/handler/im_handler.go` (Tencent Cloud IM - backup only)
- Architecture: `documentation/06-即时通讯/Tinode集成.md`

### Key Learnings
1. **Permission Model**: Clear chat history requires admin role verification in Tinode
2. **Error Handling**: Use `errors.Is()` for specific error types (ErrNotAuthorized, ErrInsufficientPermission)
3. **Idempotency**: User sync operations are idempotent (safe to call multiple times)
4. **Migration Strategy**: Keep backup system code but mark as maintenance-only with sunset date


## Task 6: 公共模块 API 文档 (2026-01-25)

### 完成内容
- 创建 `documentation/04-后端开发/API接口/公共模块.md`
- 文档化 16 个公共端点：
  - 字典 API: 2 个端点（获取字典选项、获取所有分类）
  - 区域 API: 4 个端点（省份、城市、区县、懒加载）
  - 灵感图库 API: 7 个端点（列表、点赞、取消点赞、收藏、取消收藏、评论列表、发表评论）
  - 材料商店收藏: 2 个端点（收藏、取消收藏）
  - 文件上传: 1 个端点（通用上传）

### 技术发现
1. **字典系统设计**:
   - 采用分类-字典值两级结构
   - 支持父子关系（parentValue）
   - 支持扩展数据（extraData JSONB）
   - 常用分类：renovation_type, house_layout, style, budget_range, area_range, service_type

2. **区域三级联动**:
   - Level 1: 省级（省、直辖市、自治区）
   - Level 2: 市级（地级市）
   - Level 3: 区级（区、县）
   - 支持懒加载（GetChildrenByParentCode）
   - 支持启用/禁用状态（enabled 字段）

3. **灵感图库社交功能**:
   - 使用 OptionalJWT 中间件支持未登录浏览
   - 登录用户可查看个人状态（isLiked, isFavorited）
   - 点赞/收藏操作返回最新计数
   - 评论支持回复（parentId）

4. **文件上传限制**:
   - 统一大小限制：50MB
   - 支持格式：图片（jpg/jpeg/png/gif/webp）、文档（pdf/doc/docx/xls/xlsx/ppt/pptx/txt）、压缩包（zip/rar）、视频（mp4/mov/avi）、音频（m4a/aac/mp3/wav/ogg）
   - 文件命名规则：chat_{userId}_{timestamp}{ext}
   - 按月分文件夹存储：./uploads/chat/YYYYMM/

### 文档结构
- 遵循认证模块的格式规范
- 五大模块分别说明
- 包含常用字典分类表
- 包含区域层级说明
- 包含文件格式支持表
- 包含使用流程说明
- 包含注意事项和性能优化建议

### 路由发现
- 字典公开端点：`/api/v1/dictionaries/*`
- 区域公开端点：`/api/v1/regions/*`
- 灵感图库：`/api/v1/inspiration/*`（部分需认证）
- 材料商店收藏：`/api/v1/material-shops/:id/favorite`（需认证）
- 文件上传：`/api/v1/upload`（需认证）

### 最佳实践
1. 字典数据建议前端缓存到 LocalStorage
2. 区域数据使用懒加载方式
3. 文件上传前端预校验格式和大小
4. 灵感列表使用虚拟滚动或分页加载
5. 图片使用 CDN 加速和懒加载

## Task 7: User Module Documentation Update (2026-01-25)

### Endpoints Added
1. **GET /api/v1/user/favorites** - User favorites list
   - Location: Section 1.3 (Personal Profile Management)
   - Supports filtering by type: case, material_shop, provider
   - Pagination support (page, pageSize)
   - Handler: `inspiration_handler.go::GetUserFavorites`
   - Service: `inspiration_service.go::GetUserFavorites`

2. **GET /api/v1/projects/:id/bill** - Get project bill
   - Location: Section 3.5 (Project Management)
   - Returns orders (design, construction) with payment plans
   - Handler: `business_flow_handler.go::GetProjectBill`
   - Service: `order_service.go::GetOrdersByProject`

3. **POST /api/v1/projects/:id/bill** - Generate project bill
   - Location: Section 3.6 (Project Management)
   - Creates design and construction orders
   - Supports milestone-based payment plans
   - Handler: `business_flow_handler.go::GenerateBill`
   - Service: `order_service.go::GenerateBill`

4. **GET /api/v1/projects/:id/files** - Get project files
   - Location: Section 3.7 (Project Management)
   - Requires design fee payment verification
   - Returns design drawings and renderings
   - Handler: `business_flow_handler.go::GetProjectFiles`
   - Service: `order_service.go::CanAccessDesignFiles`

### Documentation Patterns Observed
- Consistent use of markdown tables for parameters
- JSON code blocks for request/response examples
- Clear section numbering (1.1, 1.2, etc.)
- Query parameters documented separately from body parameters
- Error responses included where relevant (403 for files endpoint)
- Business logic notes in descriptions (e.g., intent fee deduction)

### Implementation Details
- Favorites service aggregates case and material_shop types
- Bill generation includes intent fee discount logic
- Payment plans auto-generated with 30-30-40 split for milestone type
- File access gated by design order payment status
- All endpoints use standard response format with code/message/data

### Cross-References
- Favorites handler in `inspiration_handler.go` (not `handler.go`)
- Bill/files handlers in `business_flow_handler.go` (separate from main handler)
- Router registration in `router.go` under user and project groups

## Task 8: Merchant Module Documentation Update (2026-01-25)

### Endpoints Added (13 total)

#### Proposal Management Extensions (6 endpoints)
1. **GET /api/v1/merchant/proposals/:id** - Get proposal details
   - Returns proposal with associated booking and user info
   - Handler: `merchant_handler.go::MerchantGetProposal`
   
2. **PUT /api/v1/merchant/proposals/:id** - Update proposal
   - Only pending(1) or rejected(3) proposals can be updated
   - Status resets to pending after update
   - Handler: `merchant_handler.go::MerchantUpdateProposal`
   
3. **DELETE /api/v1/merchant/proposals/:id** - Cancel proposal
   - Only pending(1) proposals can be cancelled
   - Handler: `merchant_handler.go::MerchantCancelProposal`
   
4. **POST /api/v1/merchant/proposals/:id/reopen** - Reopen cancelled proposal
   - Only cancelled(4) proposals can be reopened
   - Status changes to pending(1)
   - Handler: `business_flow_handler.go::MerchantReopenProposal`
   
5. **POST /api/v1/merchant/proposals/resubmit** - Resubmit with new version
   - Creates new proposal with version++
   - Only rejected(3) proposals can be resubmitted
   - Original proposal remains rejected
   - Handler: `business_flow_handler.go::ResubmitProposal`
   - Service: `proposal_service.go::ResubmitProposal`
   
6. **GET /api/v1/merchant/proposals/:id/rejection-info** - Get rejection details
   - Returns rejection reason, count, and history
   - Shows if resubmission is allowed (count < 3)
   - Handler: `business_flow_handler.go::GetRejectionInfo`
   - Service: `proposal_service.go::GetRejectionInfo`

#### Information Management Extensions (3 endpoints)
1. **PUT /api/v1/merchant/info** - Update merchant profile
   - Updates Provider and User tables in transaction
   - Validates service area codes via RegionService
   - Supports name/companyName/specialty/serviceArea/introduction/teamSize/officeAddress
   - Handler: `merchant_handler.go::MerchantUpdateInfo`
   
2. **POST /api/v1/merchant/avatar** - Upload avatar
   - File size limit: 2MB
   - Formats: jpg, jpeg, png, gif
   - Saves to ./uploads/avatars/
   - Updates User.avatar field
   - Handler: `merchant_handler.go::MerchantUploadAvatar`
   
3. **POST /api/v1/merchant/upload** - Upload general files
   - File size limit: 20MB
   - Formats: images, documents, archives
   - Saves to ./uploads/cases/
   - Handler: `merchant_handler.go::MerchantUploadImage`

#### IM Integration (2 endpoints)
1. **GET /api/v1/merchant/im/usersig** - Get Tencent Cloud IM signature
   - Status: BACKUP SOLUTION (not in production)
   - Auto-syncs merchant to Tencent IM
   - UserSig validity: 7 days
   - Handler: `merchant_im_handler.go::MerchantGetIMUserSig`
   
2. **GET /api/v1/merchant/tinode/userid/:userId** - Get Tinode user ID
   - Returns format: usr{id}
   - Auto-syncs target user to Tinode DB
   - Idempotent operation
   - Handler: `tinode_handler.go::GetTinodeUserID`

#### Case Management Extensions (2 endpoints)
1. **GET /api/v1/merchant/cases/:id** - Get case details
   - Returns pending audit data if exists
   - Falls back to published case data
   - Handler: `merchant_case_handler.go::MerchantCaseGet`
   
2. **DELETE /api/v1/merchant/cases/audit/:auditId** - Cancel audit request
   - Only pending(0) or rejected(2) audits can be cancelled
   - Deletes audit record
   - Handler: `merchant_case_handler.go::MerchantCaseCancelAudit`

### Key Business Logic Discoveries

#### Proposal Version Management
- **Version Increment**: Only `resubmit` creates new version (v1 → v2 → v3)
- **Update vs Resubmit**: 
  - `PUT /:id` updates existing proposal (same version)
  - `POST /resubmit` creates new proposal (version++)
- **Rejection Limit**: Max 3 rejections per booking, then enters dispute resolution
- **Status Flow**: pending(1) → confirmed(2) / rejected(3) / cancelled(4)

#### Case Audit System
- **Dual-Version Mechanism**: Published cases + pending audits
- **Action Types**: create, update, delete
- **Audit Status**: pending(0), approved(1), rejected(2)
- **List Merging**: MerchantCaseList merges published + audit data
- **Detail Priority**: GET /:id returns audit data if pending, else published

#### IM System Architecture
- **Primary**: Tinode (self-hosted, 85% migration complete)
- **Backup**: Tencent Cloud IM (sunset date: 2026-07-24)
- **User ID Mapping**: Business user ID → Tinode usr{id}
- **Topic Naming**: Private chat uses smaller ID first (usr123_usr456)

#### File Upload Strategy
- **Avatar**: 2MB limit, ./uploads/avatars/, updates User table
- **Cases**: 20MB limit, ./uploads/cases/, supports documents/archives
- **Naming**: {type}_{providerId}_{timestamp}{ext}
- **URL Generation**: imgutil.GetFullImageURL() adds CDN prefix

### Documentation Patterns Applied
1. **Section Organization**: Grouped by business function (info, proposals, cases, IM)
2. **Endpoint Details**: Path params, request body, response examples, field descriptions
3. **Business Rules**: Status constraints, version management, rejection limits
4. **Architecture Notes**: IM migration strategy, backup system status
5. **Consistent Format**: Matches existing sections (2.x, 3.x, 4.x, 6.x)

### Implementation References
- Handlers: `merchant_handler.go`, `merchant_case_handler.go`, `merchant_im_handler.go`, `business_flow_handler.go`, `tinode_handler.go`
- Services: `proposal_service.go`, `region_service.go`
- Routes: `router.go` (merchant group)
- Models: `proposal.go`, `provider_case.go`, `case_audit.go`

### Cross-Module Dependencies
- **Region Service**: Validates service area codes in MerchantUpdateInfo
- **Image Util**: Converts relative paths to full CDN URLs
- **Tinode Integration**: Syncs users to Tinode DB for chat functionality
- **Proposal Service**: Handles version management and rejection tracking


## Task 9: Admin User Management Documentation (2026-01-25)

### Endpoints Documented (5 total)
1. **GET /api/v1/admin/users** - User list with pagination and filters
   - Supports keyword search (phone/nickname)
   - Supports userType filter (1-owner, 2-provider, 3-worker, 4-admin)
   - Pagination with max pageSize=100
   - Handler: admin_handler.go::AdminListUsers

2. **GET /api/v1/admin/users/:id** - User details
   - Returns full user profile
   - Handler: admin_handler.go::AdminGetUser

3. **POST /api/v1/admin/users** - Create user
   - Required: phone (11 digits)
   - Optional: nickname, userType, status
   - Default status: 1 (active)
   - No initial password (user sets via SMS login)
   - Handler: admin_handler.go::AdminCreateUser

4. **PUT /api/v1/admin/users/:id** - Update user
   - Updates nickname, userType, status
   - Only updates provided fields
   - Status field always updates (including 0)
   - Handler: admin_handler.go::AdminUpdateUser

5. **PATCH /api/v1/admin/users/:id/status** - Update user status
   - Quick status change endpoint
   - Status values: 1-active, 2-disabled, 3-deleted
   - Handler: admin_handler.go::AdminUpdateUserStatus

### User Type Enumeration
| Value | Type | Description |
|-------|------|-------------|
| 1 | 业主 | Regular user, initiates renovation requests |
| 2 | 服务商 | Service provider (designer/company/foreman) |
| 3 | 工人 | Construction worker |
| 4 | 管理员 | Platform administrator |

### User Status Enumeration
| Value | Status | Description |
|-------|--------|-------------|
| 1 | 正常 | Active, can login and use system |
| 2 | 禁用 | Disabled, cannot login |
| 3 | 已删除 | Soft deleted, data retained |

### Implementation Details
- **Search Logic**: Keyword matches phone OR nickname (LIKE %keyword%)
- **Pagination**: Default page=1, pageSize=10, max pageSize=100
- **Status Management**: 
  - Status 2 blocks login but preserves data
  - Status 3 is soft delete (data retained)
- **Update Strategy**: 
  - PUT endpoint uses selective updates (only non-zero/non-empty fields)
  - PATCH endpoint updates status only
- **Default Values**: 
  - AdminCreateUser sets status=1 if not provided
  - No password set on creation (user must use SMS login)

### Business Rules
1. **Phone Uniqueness**: Phone numbers must be unique across all users
2. **Password Policy**: Admin-created users have no initial password
3. **Status Effects**:
   - Disabled (2): Blocks login, preserves all data
   - Deleted (3): Soft delete, data retained for audit
4. **Type Changes**: Changing userType may affect permissions and feature access
5. **Pagination Limit**: pageSize capped at 100 to prevent DoS

### Documentation Structure
- Followed 认证模块.md format
- Sections: Overview, Type/Status enums, API list, Error codes, Usage examples, Notes
- Each endpoint includes: path, description, auth requirement, parameters, response examples, field descriptions, error responses, business rules
- Added cross-references to related modules (认证模块, 服务商管理, 统计分析)

### Handler Implementation Notes
- **AdminListUsers**: Uses repository.DB directly with GORM query builder
- **AdminGetUser**: Uses First() with error handling for 404
- **AdminCreateUser**: Sets default status=1 if not provided
- **AdminUpdateUser**: Uses map[string]interface{} for selective updates
- **AdminUpdateUserStatus**: Direct Update() call for single field

### Routes Configuration
- All endpoints under  group
- Requires AdminJWT middleware
- Likely requires admin permissions (not explicitly shown in handler)

### Model Reference
- User model in model.go (lines 14-26)
- Fields: ID, Phone, Nickname, Avatar, Password, UserType, Status, LoginFailedCount, LockedUntil, LastFailedLoginAt
- Password field has json:"-" tag (never returned to frontend)
- Status default: 1 (gorm:"default:1")


## Task 9: Admin User Management Documentation (2026-01-25)

### Endpoints Documented (5 total)
1. **GET /api/v1/admin/users** - User list with pagination and filters
   - Supports keyword search (phone/nickname)
   - Supports userType filter (1-owner, 2-provider, 3-worker, 4-admin)
   - Pagination with max pageSize=100
   - Handler: admin_handler.go::AdminListUsers

2. **GET /api/v1/admin/users/:id** - User details
   - Returns full user profile
   - Handler: admin_handler.go::AdminGetUser

3. **POST /api/v1/admin/users** - Create user
   - Required: phone (11 digits)
   - Optional: nickname, userType, status
   - Default status: 1 (active)
   - No initial password (user sets via SMS login)
   - Handler: admin_handler.go::AdminCreateUser

4. **PUT /api/v1/admin/users/:id** - Update user
   - Updates nickname, userType, status
   - Only updates provided fields
   - Status field always updates (including 0)
   - Handler: admin_handler.go::AdminUpdateUser

5. **PATCH /api/v1/admin/users/:id/status** - Update user status
   - Quick status change endpoint
   - Status values: 1-active, 2-disabled, 3-deleted
   - Handler: admin_handler.go::AdminUpdateUserStatus

### User Type Enumeration
| Value | Type | Description |
|-------|------|-------------|
| 1 | 业主 | Regular user, initiates renovation requests |
| 2 | 服务商 | Service provider (designer/company/foreman) |
| 3 | 工人 | Construction worker |
| 4 | 管理员 | Platform administrator |

### User Status Enumeration
| Value | Status | Description |
|-------|--------|-------------|
| 1 | 正常 | Active, can login and use system |
| 2 | 禁用 | Disabled, cannot login |
| 3 | 已删除 | Soft deleted, data retained |

### Implementation Details
- **Search Logic**: Keyword matches phone OR nickname (LIKE %keyword%)
- **Pagination**: Default page=1, pageSize=10, max pageSize=100
- **Status Management**: 
  - Status 2 blocks login but preserves data
  - Status 3 is soft delete (data retained)
- **Update Strategy**: 
  - PUT endpoint uses selective updates (only non-zero/non-empty fields)
  - PATCH endpoint updates status only
- **Default Values**: 
  - AdminCreateUser sets status=1 if not provided
  - No password set on creation (user must use SMS login)

### Business Rules
1. **Phone Uniqueness**: Phone numbers must be unique across all users
2. **Password Policy**: Admin-created users have no initial password
3. **Status Effects**:
   - Disabled (2): Blocks login, preserves all data
   - Deleted (3): Soft delete, data retained for audit
4. **Type Changes**: Changing userType may affect permissions and feature access
5. **Pagination Limit**: pageSize capped at 100 to prevent DoS

### Documentation Structure
- Followed 认证模块.md format
- Sections: Overview, Type/Status enums, API list, Error codes, Usage examples, Notes
- Each endpoint includes: path, description, auth requirement, parameters, response examples, field descriptions, error responses, business rules
- Added cross-references to related modules (认证模块, 服务商管理, 统计分析)

### Handler Implementation Notes
- **AdminListUsers**: Uses repository.DB directly with GORM query builder
- **AdminGetUser**: Uses First() with error handling for 404
- **AdminCreateUser**: Sets default status=1 if not provided
- **AdminUpdateUser**: Uses map[string]interface{} for selective updates
- **AdminUpdateUserStatus**: Direct Update() call for single field

### Routes Configuration
- All endpoints under /api/v1/admin/users group
- Requires AdminJWT middleware
- Likely requires admin permissions (not explicitly shown in handler)

### Model Reference
- User model in model.go (lines 14-26)
- Fields: ID, Phone, Nickname, Avatar, Password, UserType, Status, LoginFailedCount, LockedUntil, LastFailedLoginAt
- Password field has json:"-" tag (never returned to frontend)
- Status default: 1 (gorm:"default:1")
