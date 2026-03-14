# MVP 可信交易闭环 — 全面项目方案

## Context

项目目标是构建一个**可信交易闭环 MVP**（trusted transaction-loop MVP），验证三件事：
1. 用户愿意在平台提交真实需求
2. 商家愿意在平台规则下运营
3. 项目能在系统内端到端运行

当前项目已有大量基础设施（用户浏览、商家入驻、预约、方案、报价、项目管理），但**交易闭环的核心链路尚未打通**。

---

## 一、现状总览

| 层面 | 已有 | 交易闭环缺口 |
|------|------|-------------|
| **User Web** | 22页（首页、服务商、预约、方案、项目、灵感、消息、个人中心） | 需求提交、需求管理、报价对比、合同确认、验收、变更单、投诉、评价 |
| **Merchant Web** | 21页（入驻、工作台、预约、方案、报价、订单、财务、作品集、聊天） | 分配需求/线索、里程碑交付、变更单处理、投诉/售后响应 |
| **Admin Web** | 20+页（仪表盘、用户、服务商、审核、项目、预约、财务、风险、权限） | 需求审核/分配、匹配指派、合同/里程碑管理、验收管理、变更单管理、投诉/争议处理、付款监管、商家评分/处罚 |
| **Backend API** | 100+端点（认证、服务商、预约、项目、方案、订单、托管、报价、IM） | 需求CRUD、匹配/分配、合同/里程碑确认、变更单、投诉/争议、评价、商家评分 |
| **Database** | 25+表（用户、服务商、项目、阶段、预约、方案、订单、托管、案例等） | 需求表、匹配/分配表、合同表、变更单表、投诉/争议表、评价表、商家评分表 |
| **测试** | 部分E2E（商家入驻、财务、聊天） | User Web测试、交易闭环E2E、单元测试 |

---

## 二、交易闭环核心链路（必须打通）

```
用户提交需求 → 平台审核 → 商家匹配/分配 → 商家报价/方案 → 用户对比选择
→ 合同/里程碑确认 → 项目执行 → 里程碑交付 → 用户验收
→ 变更单处理 → 投诉/争议 → 付款节奏 → 项目完成评价
```

---

## 三、分阶段实施计划

### Phase 1：运营骨架（Operational Backbone）— 约4-6周

**目标**：用户能提交需求，平台能审核分配，商家能接单报价，用户能浏览对比。

#### 1.1 数据库新增表

| 表名 | 用途 | 关键字段 |
|------|------|---------|
| `demands` | 用户需求 | user_id, type, city, district, area, budget, timeline, description, attachments, status(draft/submitted/reviewing/approved/matched/closed), reviewer_id |
| `demand_matches` | 需求-商家匹配 | demand_id, provider_id, status(pending/accepted/declined/quoted), assigned_by, assigned_at, response_deadline |
| `contracts` | 合同 | project_id, demand_id, provider_id, user_id, total_amount, payment_plan(JSON), attachment_url, status(draft/confirmed/active/completed/terminated), confirmed_at |

迁移文件：`server/migrations/v1.8.0_add_demand_system.sql`

#### 1.2 Backend API 新增

| 端点 | 方法 | 说明 |
|------|------|------|
| `/api/v1/demands` | POST | 用户提交需求 |
| `/api/v1/demands` | GET | 用户需求列表 |
| `/api/v1/demands/:id` | GET | 需求详情 |
| `/api/v1/demands/:id` | PUT | 更新需求（补充信息） |
| `/api/v1/demands/:id/submit` | POST | 提交草稿 |
| `/api/v1/admin/demands` | GET | 管理端需求列表 |
| `/api/v1/admin/demands/:id/review` | POST | 审核需求 |
| `/api/v1/admin/demands/:id/assign` | POST | 分配商家 |
| `/api/v1/admin/demands/:id/matches` | GET | 查看匹配候选 |
| `/api/v1/merchant/leads` | GET | 商家收到的分配线索 |
| `/api/v1/merchant/leads/:id/accept` | POST | 接受线索 |
| `/api/v1/merchant/leads/:id/decline` | POST | 拒绝线索 |

新增服务文件：
- `server/internal/service/demand_service.go`
- `server/internal/handler/demand_handler.go`
- `server/internal/handler/admin_demand_handler.go`
- `server/internal/handler/merchant_lead_handler.go`

#### 1.3 User Web 新增页面

| 页面 | 路由 | 对应MVP Page Map |
|------|------|-----------------|
| 需求提交页 | `/demands/new` | P0 #2 Demand submission |
| 我的需求列表 | `/me/demands` | P0 #3 My demands list |
| 需求详情页 | `/demands/:id` | P0 #4 Demand detail |
| 报价/方案对比页 | `/demands/:id/compare` | P0 #7 Quote comparison |

修改现有页面：
- 首页 (`web/src/pages/HomePage.tsx`) — 增加需求提交CTA入口
- 个人中心 (`web/src/pages/profile/ProfileHomePage.tsx`) — 增加"我的需求"入口

#### 1.4 Merchant Web 新增页面

| 页面 | 路由 | 对应MVP Page Map |
|------|------|-----------------|
| 分配线索页 | `/leads` | P0 #8 Assigned demand/lead |

修改现有页面：
- 工作台 (`merchant/src/pages/merchant/MerchantDashboard.tsx`) — 增加"新分配需求"模块

#### 1.5 Admin Web 新增页面

| 页面 | 路由 | 对应MVP Page Map |
|------|------|-----------------|
| 需求管理页 | `/demands/list` | P0 #4 Demand management |
| 匹配/分配页 | `/demands/:id/assign` | P0 #5 Matching/assignment |

---

### Phase 2：交易信任闭环（Transaction Trust Loop）— 约4-6周

**目标**：合同确认、里程碑管理、验收、变更单、投诉/争议、付款节奏全部打通。

#### 2.1 数据库新增表

| 表名 | 用途 | 关键字段 |
|------|------|---------|
| `change_orders` | 变更单 | project_id, initiator_type, initiator_id, reason, amount_impact, timeline_impact, status(pending/user_confirmed/user_rejected/admin_intervened), evidence_urls |
| `complaints` | 投诉/争议 | project_id, user_id, provider_id, category, description, evidence_urls, status(submitted/processing/resolved/closed), resolution, admin_id, freeze_payment |
| `evaluations` | 项目评价 | project_id, user_id, provider_id, overall_score, dimension_scores(JSON), content, created_at |

迁移文件：`server/migrations/v1.9.0_add_transaction_trust_loop.sql`

#### 2.2 Backend API 新增

**合同/里程碑确认**：
| 端点 | 方法 | 说明 |
|------|------|------|
| `/api/v1/contracts` | POST | 创建合同 |
| `/api/v1/contracts/:id/confirm` | POST | 用户确认合同 |
| `/api/v1/projects/:id/milestones` | GET | 里程碑列表 |
| `/api/v1/projects/:id/milestones/:mid/deliver` | POST | 商家提交交付 |
| `/api/v1/projects/:id/milestones/:mid/accept` | POST | 用户验收 |
| `/api/v1/projects/:id/milestones/:mid/reject` | POST | 用户拒绝 |

**变更单**：
| 端点 | 方法 | 说明 |
|------|------|------|
| `/api/v1/change-orders` | POST | 发起变更 |
| `/api/v1/change-orders/:id` | GET | 变更详情 |
| `/api/v1/change-orders/:id/confirm` | POST | 确认变更 |
| `/api/v1/change-orders/:id/reject` | POST | 拒绝变更 |

**投诉/争议**：
| 端点 | 方法 | 说明 |
|------|------|------|
| `/api/v1/complaints` | POST | 发起投诉 |
| `/api/v1/complaints/:id` | GET | 投诉详情 |
| `/api/v1/admin/complaints` | GET | 管理端投诉列表 |
| `/api/v1/admin/complaints/:id/resolve` | POST | 处理投诉 |
| `/api/v1/merchant/complaints` | GET | 商家端投诉列表 |
| `/api/v1/merchant/complaints/:id/respond` | POST | 商家回应 |

**评价**：
| 端点 | 方法 | 说明 |
|------|------|------|
| `/api/v1/evaluations` | POST | 提交评价 |
| `/api/v1/evaluations/project/:id` | GET | 项目评价 |

新增服务文件：
- `server/internal/service/contract_service.go`
- `server/internal/service/change_order_service.go`
- `server/internal/service/complaint_service.go`
- `server/internal/service/evaluation_service.go`
- 对应 handler 文件

#### 2.3 User Web 新增页面

| 页面 | 路由 | 对应MVP Page Map |
|------|------|-----------------|
| 合同/里程碑确认页 | `/projects/:id/contract` | P0 #8 Contract confirmation |
| 验收页 | `/projects/:id/milestones/:mid/accept` | P0 #10 Acceptance |
| 变更单页 | `/projects/:id/change-orders` | P0 #11 Change-order |
| 投诉/争议页 | `/complaints/new` | P0 #12 Complaint/dispute |
| 我的投诉列表 | `/me/complaints` | P0 #12 |
| 评价页 | `/projects/:id/evaluate` | P0 #14 Evaluation |

修改现有页面：
- 项目详情 (`web/src/pages/ProjectDetailPage.tsx`) — 增加验收、变更、投诉、付款状态入口
- 项目进度板 (`web/src/pages/ProgressPage.tsx`) — 增加里程碑时间线、付款节奏可视化

#### 2.4 Merchant Web 新增页面

| 页面 | 路由 | 对应MVP Page Map |
|------|------|-----------------|
| 里程碑交付页 | `/projects/:id/deliver` | P0 #12 Milestone delivery |
| 变更单处理页 | `/change-orders` | P0 #13 Change-order handling |
| 投诉/售后响应页 | `/complaints` | P0 #14 Complaint response |

修改现有页面：
- 工作台 — 增加"待交付里程碑"、"待处理变更"、"待回应投诉"模块

#### 2.5 Admin Web 新增页面

| 页面 | 路由 | 对应MVP Page Map |
|------|------|-----------------|
| 合同/项目管理页 | `/projects/:id/contract` | P0 #7 Contract management |
| 验收管理页 | `/projects/:id/acceptance` | P0 #8 Acceptance management |
| 变更单管理页 | `/change-orders` | P0 #9 Change-order management |
| 投诉/争议处理页 | `/complaints` | P0 #10 Complaint handling |
| 付款/提现监管页 | `/finance/supervision` | P0 #11 Payment supervision |

---

### Phase 3：治理与强化（Governance & Reinforcement）— 约2-3周

**目标**：商家评分/处罚体系、评价沉淀、运营分析。

#### 3.1 数据库新增表

| 表名 | 用途 | 关键字段 |
|------|------|---------|
| `merchant_scores` | 商家评分 | provider_id, dimension(response_speed/quote_quality/schedule_fulfillment/acceptance_rate/complaint_rate/after_sales), score, updated_at |
| `merchant_penalties` | 商家处罚 | provider_id, type(warning/ranking_downgrade/order_freeze/removal), reason, admin_id, effective_at, expires_at |

迁移文件：`server/migrations/v1.10.0_add_merchant_governance.sql`

#### 3.2 Backend API 新增

| 端点 | 方法 | 说明 |
|------|------|------|
| `/api/v1/admin/merchant-scores/:id` | GET | 商家评分详情 |
| `/api/v1/admin/merchant-scores/:id/recalculate` | POST | 重新计算评分 |
| `/api/v1/admin/merchant-penalties` | POST | 发起处罚 |
| `/api/v1/admin/merchant-penalties/:id/revoke` | POST | 撤销处罚 |

#### 3.3 Admin Web 新增页面

| 页面 | 路由 | 对应MVP Page Map |
|------|------|-----------------|
| 商家评分/处罚页 | `/merchants/scoring` | P0 #12 Merchant scoring |

---

## 四、非页面工作项

### 4.1 文档补全

| 文档 | 状态 | 需要做的 |
|------|------|---------|
| 需求系统 PRD | ❌ 缺失 | 编写需求提交、审核、匹配的产品需求文档 |
| 合同/里程碑 PRD | ❌ 缺失 | 编写合同确认、里程碑管理、付款节奏的产品需求文档 |
| 变更单/投诉 PRD | ❌ 缺失 | 编写变更单、投诉/争议处理的产品需求文档 |
| 评价/评分 PRD | ❌ 缺失 | 编写评价体系、商家评分/处罚的产品需求文档 |
| API 文档 | ⚠️ 部分 | 补全新增端点的 API 文档 |
| 数据库设计文档 | ⚠️ 部分 | 更新 `docs/Database_Design.md` 增加新表 |

### 4.2 测试计划

| 测试类型 | 覆盖范围 | 优先级 |
|----------|---------|--------|
| **Backend 单元测试** | demand_service, contract_service, change_order_service, complaint_service, evaluation_service | P0 |
| **User Web E2E** | 需求提交→审核→匹配→报价对比→合同确认→验收→评价 全链路 | P0 |
| **Merchant Web E2E** | 接单→报价→交付→变更处理→投诉响应 全链路 | P0 |
| **Admin Web E2E** | 需求审核→分配→项目监管→争议处理→付款监管 全链路 | P1 |
| **User Web 单元测试** | 页面组件、服务层 | P1 |
| **Merchant Web 单元测试** | 页面组件、服务层 | P1 |

### 4.3 部署/基础设施

| 项目 | 状态 | 需要做的 |
|------|------|---------|
| User Web Docker 构建 | ⚠️ 需确认 | 确保 `deploy/Dockerfile.frontend` 包含 User Web 构建 |
| Merchant Web Docker 构建 | ⚠️ 需确认 | 确保独立构建或与 Admin 合并 |
| Nginx 路由 | ⚠️ 需更新 | 增加 User Web 和 Merchant Web 的路由规则 |
| docker-compose.local.yml | ⚠️ 需更新 | 增加 User Web 和 Merchant Web 的开发服务 |
| CI/CD | ⚠️ 需确认 | `.github/workflows/ci-user-web.yml` 已存在，需补全 merchant web |

### 4.4 共享代码 (shared/)

| 模块 | 需要做的 |
|------|---------|
| `shared/types/` | 统一 demand、contract、change-order、complaint、evaluation 的 TypeScript 类型 |
| `shared/api/` | 抽取 User Web 和 Merchant Web 共用的 API 客户端逻辑 |
| `shared/utils/` | 抽取格式化、状态映射等通用工具 |

---

## 五、优先级排序总览

```
Phase 1 (P0 骨架)          Phase 2 (P0 闭环)           Phase 3 (P0 治理)
┌─────────────────┐      ┌──────────────────┐       ┌─────────────────┐
│ DB: demands      │      │ DB: change_orders │       │ DB: scores      │
│ DB: matches      │      │ DB: complaints    │       │ DB: penalties   │
│ DB: contracts    │      │ DB: evaluations   │       │                 │
│                  │      │                   │       │ API: scoring    │
│ API: demand CRUD │      │ API: milestone    │       │ API: penalty    │
│ API: assign      │      │ API: change-order │       │                 │
│ API: leads       │      │ API: complaint    │       │ Admin: scoring  │
│                  │      │ API: evaluation   │       │   page          │
│ User: demand     │      │                   │       │                 │
│   submit/list    │      │ User: contract    │       │ Tests: full     │
│ User: compare    │      │ User: acceptance  │       │   loop E2E      │
│                  │      │ User: change-order│       │                 │
│ Merchant: leads  │      │ User: complaint   │       │ Docs: all PRDs  │
│                  │      │ User: evaluation  │       │                 │
│ Admin: demand    │      │                   │       └─────────────────┘
│   review/assign  │      │ Merchant: deliver │
│                  │      │ Merchant: change  │
│ Tests: Phase 1   │      │ Merchant: respond │
│   backend unit   │      │                   │
└─────────────────┘      │ Admin: contract   │
                          │ Admin: acceptance │
                          │ Admin: complaint  │
                          │ Admin: payment    │
                          │                   │
                          │ Tests: Phase 2    │
                          └──────────────────┘
```

---

## 六、验证方式

每个 Phase 完成后的验证标准：

**Phase 1 验证**：
- 用户能在 User Web 提交需求并查看状态
- 管理员能在 Admin Web 审核需求并分配商家
- 商家能在 Merchant Web 看到分配的线索并接受/拒绝
- 用户能在 User Web 对比多个商家的报价
- 后端单元测试全部通过

**Phase 2 验证**：
- 用户能确认合同和里程碑规则
- 商家能提交里程碑交付材料
- 用户能验收/拒绝里程碑
- 双方能发起和处理变更单
- 用户能发起投诉，管理员能介入处理
- 项目完成后用户能提交评价
- 付款状态在各端可见

**Phase 3 验证**：
- 管理员能查看商家多维评分
- 管理员能执行处罚操作（警告、降级、冻结、移除）
- 全链路 E2E 测试通过（需求→评价）
