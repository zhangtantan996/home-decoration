# 家装平台核心业务流程开发计划

> **文档版本**: v1.0
> **创建时间**: 2025-12-30
> **目标**: 尽快跑通整个业务流程，完善从预约到项目完工的端到端功能

---

## 📋 目录

- [一、需求确认与决策记录](#一需求确认与决策记录)
- [二、功能开发优先级总览](#二功能开发优先级总览)
- [三、详细实施方案](#三详细实施方案)
  - [P0-1: 站内信通知系统](#-p0-1-站内信通知系统3天)
  - [P0-2: 方案版本管理与拒绝重试](#-p0-2-方案版本管理与拒绝重试2天)
  - [P0-3: 意向金退款机制](#-p0-3-意向金退款机制15天)
  - [P0-4: 平台抽成系统](#-p0-4-平台抽成系统15天)
  - [P0-5: 提现人工审核流程](#-p0-5-提现人工审核流程15天)
  - [P0-6: 超时自动处理](#-p0-6-超时自动处理定时任务1天)
  - [P1-1: UI修复](#-p1-1-ui修复---预约管理取消按钮05天)
  - [P1-2: 售后工单管理员审核](#-p1-2-售后工单管理员审核1天)
- [四、实施时间表](#四实施时间表建议)
- [五、测试清单](#五测试清单)
- [六、关键文件总览](#六关键文件总览)
- [七、风险点与注意事项](#七风险点与注意事项)
- [八、后续迭代建议](#八后续迭代建议)

---

## 一、需求确认与决策记录

### 用户确认的实施方案

| 功能模块 | 用户决策 | 说明 |
|---------|---------|------|
| **支付集成** | 暂时延后 | 保持模拟支付，优先跑通业务流程 |
| **平台抽成** | 后台可配置 | 管理员可动态调整抽成比例 |
| **提现审核** | 全部人工审核 | 所有提现申请需管理员审批 |
| **通知系统** | 仅站内信 | 不集成短信/推送，只实现App内通知 |

---

## 二、功能开发优先级总览

### 🔴 P0 - 核心业务流程（必须完成）

| # | 功能模块 | 工时 | 说明 |
|---|---------|------|------|
| 1 | 站内信通知系统 | 3天 | 关键节点通知，替换代码中所有TODO |
| 2 | 方案版本管理与拒绝重试 | 2天 | 支持v2/v3版本提交，3次拒绝自动介入 |
| 3 | 意向金退款机制 | 1.5天 | 商家超时/拒绝场景自动退款 |
| 4 | 平台抽成系统 | 1.5天 | 后台可配置抽成比例，自动计算 |
| 5 | 提现人工审核流程 | 1.5天 | 管理员审核提现申请 |
| 6 | 超时自动处理 | 1天 | 定时任务处理超时场景 |

**预计总工时**: 10.5天

### 🟡 P1 - 体验优化（建议完成）

| # | 功能模块 | 工时 | 说明 |
|---|---------|------|------|
| 7 | UI修复 | 0.5天 | 预约管理取消按钮超出问题 |
| 8 | 售后工单管理员审核 | 1天 | 退款/投诉处理接口 |

**预计总工时**: 1.5天

### 🟢 P2 - 后续迭代（可延后）

- 电子合同生成
- 质保期工单系统完善
- 托管账户可视化

---

## 三、详细实施方案

### 🔴 P0-1: 站内信通知系统（3天）

#### 业务背景
- 当前代码中多处TODO标记需发送通知
- 用户需求：仅实现站内信，不集成短信/推送
- 关键节点：预约支付、方案提交、订单生成、支付成功、提现审核结果

#### 技术方案

**1. 数据库设计**（0.5天）

创建通知表：
```sql
CREATE TABLE notifications (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL,
    user_type VARCHAR(20) NOT NULL,        -- user, provider, admin
    title VARCHAR(100) NOT NULL,
    content TEXT NOT NULL,
    type VARCHAR(30) NOT NULL,
    related_id BIGINT DEFAULT 0,
    related_type VARCHAR(30),
    is_read BOOLEAN DEFAULT FALSE,
    read_at TIMESTAMP,
    action_url VARCHAR(200),
    extra TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_notifications_user ON notifications(user_id, user_type);
CREATE INDEX idx_notifications_is_read ON notifications(is_read);
CREATE INDEX idx_notifications_type ON notifications(type);
CREATE INDEX idx_notifications_created_at ON notifications(created_at DESC);
```

**通知类型常量**：
- `booking.intent_paid` - 意向金支付成功（通知商家）
- `booking.confirmed` - 商家接单（通知用户）
- `proposal.submitted` - 方案已提交（通知用户）
- `proposal.confirmed` - 方案已确认（通知商家）
- `proposal.rejected` - 方案被拒绝（通知商家）
- `order.created` - 账单生成（通知用户）
- `order.paid` - 订单支付成功（通知商家）
- `withdraw.approved` - 提现审核通过
- `withdraw.rejected` - 提现审核拒绝

**2. 后端实现**（1.5天）

新建文件：
- `server/internal/service/notification_service.go` - 通知服务
- `server/internal/handler/notification_handler.go` - 通知接口

修改文件：
- `server/internal/model/model.go` - 新增Notification模型
- `server/internal/service/proposal_service.go` - 替换TODO（第61行）
- `server/internal/service/order_service.go` - 添加通知调用
- `server/internal/service/booking_service.go` - 添加通知调用
- `server/internal/router/router.go` - 路由注册

**API接口**：
```
GET    /api/v1/notifications              - 获取通知列表
GET    /api/v1/notifications/unread-count - 获取未读数量
PUT    /api/v1/notifications/:id/read     - 标记已读
PUT    /api/v1/notifications/read-all     - 全部已读
DELETE /api/v1/notifications/:id          - 删除通知
```

**3. 移动端实现**（0.75天）

新建文件：
- `mobile/src/screens/NotificationScreen.tsx` - 通知列表页面

修改文件：
- `mobile/src/services/api.ts` - 新增通知API
- `mobile/src/navigation/AppNavigator.tsx` - 路由注册
- ProfileScreen或MessageScreen - 添加未读红点

**4. 管理后台实现**（0.25天）

新建文件：
- `admin/src/components/NotificationDropdown.tsx` - 通知下拉框

修改文件：
- `admin/src/layouts/BasicLayout.tsx` - 集成通知组件

---

### 🔴 P0-2: 方案版本管理与拒绝重试（2天）

#### 业务背景
- 当前问题：方案拒绝后无法恢复
- 业务需求：商家可重新提交，自动生成v2/v3版本，连续拒绝3次后系统介入

#### 技术方案

**1. 数据库改造**（0.5天）

```sql
ALTER TABLE proposals
    ADD COLUMN version INT DEFAULT 1,
    ADD COLUMN parent_proposal_id BIGINT,
    ADD COLUMN rejection_count INT DEFAULT 0,
    ADD COLUMN rejection_reason TEXT,
    ADD COLUMN rejected_at TIMESTAMP,
    ADD COLUMN submitted_at TIMESTAMP,
    ADD COLUMN user_response_deadline TIMESTAMP,  -- 14天确认期限
    ADD INDEX idx_parent_proposal_id (parent_proposal_id),
    ADD INDEX idx_submitted_at (submitted_at);

-- 新增状态常量
-- ProposalStatusSuperseded = 4  已被新版本替代
```

**2. Service层改造**（1天）

修改方法：
- `RejectProposal` - 支持拒绝原因和版本计数

新增方法：
- `ResubmitProposal` - 商家重新提交方案
- `GetProposalVersionHistory` - 获取版本历史

**3. API接口**（0.3天）

```
POST /api/v1/proposals/:id/reject                  - 拒绝方案（需原因）
GET  /api/v1/proposals/booking/:bookingId/history  - 版本历史
POST /api/v1/merchant/proposals/resubmit           - 重新提交方案
GET  /api/v1/merchant/proposals/:id/rejection-info - 拒绝信息
```

**4. 前端集成**（0.2天）

- 移动端：拒绝时弹窗输入原因，显示版本号
- 商家后台：拒绝状态显示"重新提交"按钮

---

### 🔴 P0-3: 意向金退款机制（1.5天）

#### 业务背景
- 可退场景：商家超时（48h）、商家拒单、连续拒绝3次
- 不可退场景：用户超时（14天）、已抵扣

#### 技术方案

**1. 数据库改造**（0.2天）

```sql
ALTER TABLE bookings
    ADD COLUMN intent_fee_refunded BOOLEAN DEFAULT FALSE,
    ADD COLUMN intent_fee_refund_reason VARCHAR(200),
    ADD COLUMN intent_fee_refunded_at TIMESTAMP,
    ADD COLUMN merchant_response_deadline TIMESTAMP;  -- 48小时接单期限
```

**2. Service层实现**（0.8天）

新建文件：
- `server/internal/service/refund_service.go` - 退款服务

核心方法：
- `RefundIntentFee` - 退还意向金
- `CanRefundIntentFee` - 判断是否可退款
- `GetRefundableScenarios` - 可退款场景判断

**3. 定时任务集成**（0.3天）

新建文件：
- `server/internal/cron/booking_cron.go` - 预约超时处理

定时任务：
- `handleMerchantTimeout` - 商家48小时超时自动退款
- `handleUserConfirmTimeout` - 用户14天超时（意向金不退）

**4. API接口**（0.2天）

```
POST /api/v1/admin/bookings/:bookingId/refund  - 管理员手动退款
```

---

### 🔴 P0-4: 平台抽成系统（1.5天）

#### 业务背景
- 用户决策：后台可配置抽成比例
- 现有实现：MerchantIncome模型已包含platformFee和netAmount字段
- 缺失：无抽成比例配置，无自动计算逻辑

#### 技术方案

**1. 系统配置初始化**（0.3天）

新建文件：
- `server/scripts/init_fee_configs.sql` - 抽成配置初始化脚本

配置项：
```sql
INSERT INTO system_configs (key, value, type, description) VALUES
('fee.platform.intent_fee_rate', '0', 'number', '意向金抽成比例'),
('fee.platform.design_fee_rate', '0.10', 'number', '设计费抽成比例（默认10%）'),
('fee.platform.construction_fee_rate', '0.10', 'number', '施工费抽成比例（默认10%）'),
('fee.platform.material_fee_rate', '0.05', 'number', '材料费抽成比例（默认5%）');
```

**2. 收入记录创建逻辑**（0.8天）

新建文件：
- `server/internal/service/merchant_income_service.go` - 商家收入服务

核心方法：
- `CreateIncome` - 创建商家收入记录（自动计算抽成）
- `SettleIncome` - 结算收入（7天后自动结算）

集成调用点：
- `order_service.go` 的 `PayOrder` - 订单支付成功后创建收入记录
- `booking_service.go` 的 `PayIntentFee` - 意向金支付（如配置抽成）

**3. 管理后台配置页面**（0.4天）

修改文件：
- `admin/src/pages/settings/SystemSettings.tsx` - 新增抽成配置项

---

### 🔴 P0-5: 提现人工审核流程（1.5天）

#### 业务背景
- 用户决策：全部人工审核
- 当前问题：merchant_income_handler.go:251有TODO，创建提现后无后续审核流程

#### 技术方案

**1. 后端审核接口**（0.8天）

新建文件：
- `server/internal/handler/admin_withdraw_handler.go` - 提现审核接口

核心接口：
```
GET  /api/v1/admin/withdraws          - 提现申请列表
GET  /api/v1/admin/withdraws/:id      - 提现详情
POST /api/v1/admin/withdraws/:id/approve - 审核通过
POST /api/v1/admin/withdraws/:id/reject  - 审核拒绝
```

**2. 数据完整性保证**（0.2天）

修复并发安全问题：
- `merchant_income_handler.go` 的 `MerchantWithdrawCreate` - 增加行锁

```go
tx.Set("gorm:query_option", "FOR UPDATE").
    Model(&model.MerchantIncome{}).
    Where("provider_id = ? AND status = 1", providerID).
    Select("COALESCE(SUM(net_amount), 0)").
    Scan(&availableAmount)
```

**3. 管理后台审核页面**（0.5天）

新建文件：
- `admin/src/pages/finance/WithdrawAudit.tsx` - 提现审核页面

功能：
- 提现申请列表（Tab: 待审核/已通过/已拒绝）
- 展示：商家名称、提现金额、银行账户（脱敏）、申请时间
- 操作：查看详情、通过、拒绝

---

### 🔴 P0-6: 超时自动处理定时任务（1天）

#### 业务背景
- 商家超时（48小时未接单）→ 自动退款
- 用户超时（14天未确认方案）→ 意向金不退，方案自动拒绝
- 订单超时（48小时未支付）→ 自动取消（已实现）

#### 技术方案

**1. Booking超时处理**（已在P0-3中实现）

**2. 定时任务优化**（0.5天）

修改文件：
- `server/internal/cron/order_cron.go` - 订单超时处理优化

优化内容：
- 取消订单后发送通知给用户

**3. 定时任务监控**（0.3天）

新建文件：
- `server/internal/cron/cron_monitor.go` - 定时任务监控

功能：
- 记录每个任务的运行时间、运行次数、处理记录数
- HTTP接口暴露指标

**4. 健康检查页面**（0.2天）

新建文件：
- `admin/src/pages/system/CronMonitor.tsx` - 定时任务监控页面

---

### 🟡 P1-1: UI修复 - 预约管理取消按钮（0.5天）

#### 问题描述
预约管理-操作的取消按钮在特定情况下UI超出了模块区域

#### 修复方案

修改文件：
- `admin/src/pages/bookings/BookingList.tsx`

方案A：固定操作列宽度
```tsx
{
  title: '操作',
  key: 'action',
  fixed: 'right',
  width: 180,
  ...
}
```

方案B：使用Dropdown合并操作

---

### 🟡 P1-2: 售后工单管理员审核（1天）

#### 业务背景
用户可创建售后申请，但管理员无审核接口

#### 技术方案

新建文件：
- `server/internal/handler/admin_after_sales_handler.go` - 售后审核接口
- `admin/src/pages/customer-service/AfterSalesAudit.tsx` - 售后审核页面

---

## 四、实施时间表（建议）

### Week 1 (5个工作日)

| 天数 | 任务 | 负责模块 | 预计工时 |
|------|------|---------|---------|
| Day 1-2 | P0-1站内信通知系统 - 数据库+后端 | Backend | 2天 |
| Day 3 | P0-1站内信通知系统 - 前端 | Frontend | 1天 |
| Day 4 | P0-2方案版本管理 - 数据库+Service | Backend | 1.5天 |
| Day 5 | P0-2方案版本管理 - API+前端 | Full Stack | 0.5天 |

### Week 2 (5个工作日)

| 天数 | 任务 | 负责模块 | 预计工时 |
|------|------|---------|---------|
| Day 6 | P0-3意向金退款机制 | Backend | 1.5天 |
| Day 7 | P0-4平台抽成系统 | Full Stack | 1.5天 |
| Day 8 | P0-5提现人工审核 | Full Stack | 1.5天 |
| Day 9 | P0-6超时自动处理 | Backend | 1天 |
| Day 10 | P1 UI修复 + 售后审核 + 联调测试 | Full Stack | 2天 |

**总计**: 10个工作日（2周），可并行开发压缩至7-8天

---

## 五、测试清单

### 集成测试场景

#### 1. 完整业务流程测试
- [ ] 用户预约 → 支付意向金 → 商家收到通知
- [ ] 商家提交方案 → 用户收到通知 → 查看方案
- [ ] 用户拒绝方案 → 商家收到通知 → 重新提交v2
- [ ] 用户确认方案 → 生成设计费订单 → 支付成功 → 商家收到通知 + 收入记录创建
- [ ] 商家申请提现 → 管理员审核 → 商家收到通知

#### 2. 超时场景测试
- [ ] 商家48小时未接单 → 自动退款 → 用户收到通知
- [ ] 用户14天未确认方案 → 方案自动拒绝 → 意向金不退
- [ ] 设计费订单48小时未支付 → 自动取消

#### 3. 异常场景测试
- [ ] 连续拒绝3次方案 → 系统自动退款
- [ ] 并发提现申请 → 验证行锁有效性
- [ ] 抽成比例修改 → 新订单使用新比例，旧订单不变

---

## 六、关键文件总览

### 新增文件（19个）

**Backend (11个)**:
1. `server/internal/service/notification_service.go`
2. `server/internal/handler/notification_handler.go`
3. `server/internal/service/refund_service.go`
4. `server/internal/cron/booking_cron.go`
5. `server/internal/cron/cron_monitor.go`
6. `server/internal/service/merchant_income_service.go`
7. `server/internal/handler/admin_withdraw_handler.go`
8. `server/internal/handler/admin_after_sales_handler.go`
9. `server/scripts/init_fee_configs.sql`
10. `server/migrations/add_proposal_versioning.sql`
11. `server/migrations/add_booking_refund_fields.sql`

**Frontend (8个)**:
1. `mobile/src/screens/NotificationScreen.tsx`
2. `mobile/src/components/RejectionReasonModal.tsx`
3. `admin/src/components/NotificationDropdown.tsx`
4. `admin/src/pages/finance/WithdrawAudit.tsx`
5. `admin/src/pages/customer-service/AfterSalesAudit.tsx`
6. `admin/src/pages/system/CronMonitor.tsx`

### 修改文件（12个）

**Backend (9个)**:
1. `server/internal/model/model.go` - 新增Notification模型，Booking退款字段
2. `server/internal/model/business_flow.go` - Proposal版本字段
3. `server/internal/service/proposal_service.go` - 版本管理改造
4. `server/internal/service/order_service.go` - 集成通知+收入记录
5. `server/internal/service/booking_service.go` - 集成通知
6. `server/internal/handler/merchant_income_handler.go` - 并发安全修复
7. `server/internal/handler/business_flow_handler.go` - 新增API
8. `server/internal/router/router.go` - 路由注册
9. `server/cmd/api/main.go` - 定时任务注册

**Frontend (3个)**:
1. `mobile/src/screens/ProposalDetailScreen.tsx` - 拒绝原因输入
2. `admin/src/pages/merchant/MerchantProposals.tsx` - 重新提交UI
3. `admin/src/pages/settings/SystemSettings.tsx` - 抽成配置

---

## 七、风险点与注意事项

### 技术风险

1. **并发安全**
   - 提现扣款需使用行锁（`SELECT FOR UPDATE`）
   - 退款操作需幂等性校验

2. **数据一致性**
   - 订单支付 → 收入记录创建需在同一事务
   - 提现审核 → 收入状态更新需原子操作

3. **定时任务可靠性**
   - 需监控定时任务运行状态
   - 超时处理需记录日志便于排查

### 业务风险

1. **抽成比例变更**
   - 历史订单抽成比例不可追溯更改
   - 建议在MerchantIncome记录时固化当时的比例

2. **退款纠纷**
   - 自动退款前需明确告知用户（通知）
   - 退款失败需人工介入机制

3. **版本管理复杂度**
   - 方案链路可能很长（v1→v2→v3）
   - 需清晰的UI展示避免用户混淆

---

## 八、后续迭代建议

### Phase 2（生产前必须）

1. **支付网关集成** - 接入微信/支付宝真实支付（5天）
2. **分账系统** - 实现自动分账到商家
3. **电子合同** - 基于模板生成PDF合同（2天）
4. **消息推送** - 集成极光推送或Firebase（1天）

### Phase 3（体验优化）

1. **数据看板** - 管理后台增加统计图表
2. **导出功能** - 收入记录、提现记录导出Excel
3. **工作流引擎** - 复杂审核流程配置化

---

## 验收标准

### 功能验收

- [ ] 用户在移动端可收到所有关键节点通知
- [ ] 商家可对被拒方案重新提交（最多3次）
- [ ] 商家超时48小时自动退款成功
- [ ] 管理员可配置抽成比例，新订单自动计算
- [ ] 管理员可审核提现申请，商家收到审核结果通知

### 性能验收

- [ ] 通知创建响应时间 < 100ms
- [ ] 定时任务单次扫描 < 5秒
- [ ] 并发提现申请无资金异常

### 安全验收

- [ ] 退款操作有完整审计日志
- [ ] 提现扣款无并发漏洞
- [ ] 敏感信息（银行账号）已脱敏展示

---

## 核心原则

- ✅ 最小侵入现有代码
- ✅ 功能模块化，可独立测试
- ✅ 关键节点有通知和日志
- ✅ 异常场景有自动或人工处理机制
