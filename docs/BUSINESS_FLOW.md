# 业务流程规范 (BUSINESS_FLOW.md)

> **文档版本**: v2.0 (与 PRD v2.0 对齐)
> **创建日期**: 2026-03-17
> **文档状态**: 唯一业务流底稿
> **适用范围**: 全体产品、研发、测试、运营人员

---

## 0. 文档说明

本文档是**装修设计一体化平台的唯一业务流底稿**，与 [产品需求文档(PRD).md](./产品需求文档(PRD).md) v2.0 保持一致。

**核心原则**：
- 本文档定义的业务流是唯一开发基线
- 任何偏离该流程的功能、页面、接口、状态，统一视为增项
- 设计确认与工长确认是两个独立成交点，不能合并
- 验收/放款必须天然支持按阶段，也必须支持整体验收一次性放款
- 退款、关闭、审计属于主链路异常收口，不是附属售后能力

---

## 1. 唯一基线业务流总览

### 1.1 主链路九个节点

```
┌─────────────────────────────────────────────────────────────────────────┐
│                        唯一基线业务流（9个节点）                            │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  1. 商家入驻与能力配置                                                    │
│     ↓                                                                   │
│  2. 用户需求进入线索/预约                                                 │
│     ↓                                                                   │
│  3. 设计师与用户对接、上传量房资料、完成沟通确认                             │
│     ↓                                                                   │
│  4. 设计师提交设计费报价、设计交付、正式方案，用户确认或拒绝 【成交点A】      │
│     ↓                                                                   │
│  5. 报价基线数据 → 施工主体选择 → 施工报价确认 【成交点B：工长确认】          │
│     ↓                                                                   │
│  6. 确认后生成订单/业务闭环并创建项目，进入待监理协调开工                    │
│     ↓                                                                   │
│  7. 项目按阶段/里程碑执行，伴随托管或账款流转                               │
│     ↓                                                                   │
│  8. 用户验收，进入放款、退款或关闭                                         │
│     ↓                                                                   │
│  9. 支持分阶段验收放款，也支持一次性整体验收放款                            │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

### 1.2 业务阶段枚举

统一主链阶段枚举（与 `business_flows.stage` 字段对齐）：

| 阶段枚举 | 中文名称 | 说明 |
|---------|---------|------|
| `lead_pending` | 线索待分发 | 用户需求进入，待分发给商家 |
| `consulting` | 沟通中 | 设计师与用户沟通、量房、预算确认 |
| `design_quote_pending` | 待设计费报价 | 沟通确认完成后，等待设计师发起设计费报价 |
| `design_fee_paying` | 设计费待支付 | 用户确认并支付设计费 |
| `design_delivery_pending` | 待设计交付 | 设计费已支付，等待设计师提交正式方案 |
| `design_acceptance_pending` | 待确认正式方案 | 正式方案已提交，等待用户确认/驳回 |
| `construction_party_pending` | 施工桥接中 | 用户确认正式方案后进入施工桥接，总阶段内包含报价基线、施工主体选择与施工报价准备 |
| `constructor_pending` | 待选择工长 | 用户选择施工工长 |
| `construction_quote_pending` | 待施工报价 | 工长准备施工报价 |
| `ready_to_start` | 待监理协调开工 | 用户确认施工报价（成交点B）后，项目已创建，待监理协调进场时间与开工准备 |
| `in_progress` | 施工中 | 项目执行中 |
| `milestone_review` | 阶段验收中 | 某阶段提交验收 |
| `completed` | 已完成 | 项目完工，待整体验收或已验收 |
| `archived` | 已归档 | 项目关闭 |
| `disputed` | 争议中 | 用户与商家发生争议 |
| `cancelled` | 已取消 | 项目取消/退款 |

---

## 2. 两个独立成交点

### 2.1 成交点 A：设计费成交 + 方案确认桥接

**定义**：设计阶段固定收口为一条主链：

`沟通确认完成` → `设计费报价` → `用户确认并支付设计费` → `设计师提交正式方案` → `用户确认方案` → `进入施工方选择`

**输入**：
- 设计费报价
- 设计费
- 正式设计方案（效果图、平面图、材料清单）

**用户决策**：
- 先确认并支付设计费：业务流进入 `design_delivery_pending`
- 看到正式方案后再确认：进入施工方选择（`construction_party_pending`）
- 若驳回正式方案：设计师可重新提交（最多 3 次）

**输出**：
- 设计费支付只代表进入正式交付，不代表施工成交
- 正式方案确认后，用户仍可选择不施工或更换施工方

**关键约束**：
- `booking + design_fee_quote` 是设计费唯一成交主链
- `proposal` 只承载正式方案查看/确认，不再生成设计费订单
- 正式方案确认与工长确认是两个独立成交点，不能合并
- 正式方案确认后，业务流进入 `construction_party_pending`，但项目尚未创建

**对应接口**：
- `POST /api/v1/design-quotes/:id/confirm` - 用户确认报价并生成设计费订单
- `POST /api/v1/orders/:id/pay` - 用户支付设计费订单
- `POST /api/v1/proposals/:id/confirm` - 用户确认设计方案
- `POST /api/v1/proposals/:id/reject` - 用户拒绝设计方案

**对应状态流转**：
- `design_quote_pending` → `design_fee_paying`（报价确认，待支付）
- `design_fee_paying` → `design_delivery_pending`（支付完成）
- `design_delivery_pending` → `construction_party_pending`（确认正式方案）
- `design_delivery_pending` → `design_delivery_pending`（驳回后重提）
- `design_delivery_pending` → `cancelled`（拒绝 3 次后退款）

---

### 2.2 成交点 B：工长确认成交

**定义**：用户确认施工主体与施工报价，生成订单并创建项目。

**输入**：
- 施工主体信息（装修公司或独立工长）
- 报价基线数据
- 施工报价
- 施工范围

**用户决策**：
- 确认：生成订单并创建项目（`ready_to_start`）
- 拒绝：重新选择施工主体或终止项目

**输出**：
- 生成订单
- 创建项目
- 进入监理协调待开工阶段

**关键约束**：
- 工长确认成交是项目创建的**唯一触发条件**
- 工长确认前，所有状态均为"商机阶段"，不是"履约阶段"
- 工长确认对象允许是 `company` 或 `foreman`
- 工长确认后，项目先进入 `ready_to_start`，由监理协调进场时间，再进入正式履约

**对应接口**：
- `POST /api/v1/quote-tasks/:id/confirm` - 用户确认施工报价
- `POST /api/v1/orders` - 生成订单
- `POST /api/v1/projects` - 创建项目

**对应状态流转**：
- `construction_quote_pending` → `ready_to_start`（确认，进入待监理协调开工）
- `construction_quote_pending` → `constructor_pending`（拒绝后重新选择）
- `construction_quote_pending` → `cancelled`（终止项目）

---

## 3. 分阶段验收与整体验收双模式

### 3.1 分阶段验收放款

**定义**：按阶段/里程碑验收，每个阶段验收通过后放款该阶段款项。

**适用场景**：
- 大型项目（工期 > 60 天）
- 用户希望按进度付款
- 商家希望按进度收款

**流程**：
1. 工长提交阶段完成材料
2. 用户验收该阶段
3. 验收通过后，平台放款该阶段款项
4. 继续下一阶段
5. 所有阶段完成后，项目完工

**状态流转**：
- `in_progress` → `milestone_review`（工长提交阶段）
- `milestone_review` → `in_progress`（验收通过，继续下一阶段）
- `milestone_review` → `in_progress`（验收不通过，工长整改）
- `in_progress` → `completed`（最后一个阶段验收通过）

**对应接口**：
- `POST /api/v1/projects/:id/milestones/:milestoneId/submit` - 工长提交阶段
- `POST /api/v1/projects/:id/milestones/:milestoneId/approve` - 用户验收通过
- `POST /api/v1/projects/:id/milestones/:milestoneId/reject` - 用户验收不通过

---

### 3.2 整体验收一次性放款

**定义**：所有阶段完成后，用户一次性整体验收，验收通过后一次性放款全部款项。

**适用场景**：
- 小型项目（工期 < 30 天）
- 用户希望整体验收后付款
- 商家希望整体验收后收款

**流程**：
1. 工长完成所有阶段
2. 工长提交项目完工
3. 用户整体验收
4. 验收通过后，平台一次性放款全部款项
5. 项目关闭

**状态流转**：
- `in_progress` → `completed`（工长提交完工）
- `completed` → `archived`（用户验收通过，放款完成）
- `completed` → `in_progress`（用户验收不通过，工长整改）

**对应接口**：
- `POST /api/v1/projects/:id/complete` - 工长提交完工
- `POST /api/v1/projects/:id/approve` - 用户整体验收通过

---

## 4. 主链路异常收口

### 4.0 沟通确认驳回与关闭阈值

**触发场景**：
- 用户驳回预算/设计意向确认

**处理流程**：
- 驳回次数 `< 阈值`：业务流回到 `negotiating`，商家基于同一条沟通确认重提
- 驳回次数 `>= 阈值`：预约进入退款/关闭链

**状态流转**：
- `negotiating` → `negotiating`（驳回后重提）
- `negotiating` → `cancelled`（达到驳回阈值）

**关键约束**：
- 量房资料上传不是用户确认节点
- 正式确认从预算/设计意向确认开始
- 驳回阈值由后台配置，默认 `3`

---

### 4.1 设计阶段拒绝/终止

**触发场景**：
- 用户拒绝设计方案

**处理流程**：
- 驳回次数 < 阈值：设计师可重新提交沟通/方案
- 驳回次数 ≥ 阈值：自动触发退款，项目关闭

**状态流转**：
- `proposal_pending` → `proposal_pending`（拒绝后重提）
- `proposal_pending` → `cancelled`（拒绝 3 次后退款）

**资金处理**：
- 意向金全额退款

**对应接口**：
- `POST /api/v1/proposals/:id/reject` - 用户拒绝设计方案
- `POST /api/v1/merchant/proposals/resubmit` - 设计师重新提交
- `POST /api/v1/bookings/:id/refund` - 自动触发退款

---

### 4.2 工长确认失败/重新选择

**触发场景**：
- 用户拒绝工长施工报价
- 工长无法承接项目

**处理流程**：
- 用户可重新选择工长
- 用户可终止项目并申请退款

**状态流转**：
- `construction_quote_pending` → `constructor_pending`（重新选择）
- `construction_quote_pending` → `cancelled`（终止项目）

**资金处理**：
- 意向金全额退款（如终止）

**对应接口**：
- `POST /api/v1/quote-tasks/:id/reject` - 用户拒绝施工报价
- `POST /api/v1/bookings/:id/refund` - 申请退款

---

### 4.3 执行中暂停/争议

**触发场景**：
- 用户要求暂停施工
- 工长要求暂停施工
- 用户与工长发生争议

**处理流程**：
- 暂停施工：冻结后续款项，等待恢复
- 争议：平台介入仲裁

**状态流转**：
- `in_progress` → `disputed`（发生争议）
- `disputed` → `in_progress`（争议解决，恢复施工）
- `disputed` → `cancelled`（争议无法解决，退款关闭）

**资金处理**：
- 暂停期间：冻结后续款项
- 争议期间：冻结所有款项
- 仲裁后：按仲裁结论处理

**对应接口**：
- `POST /api/v1/projects/:id/pause` - 暂停施工
- `POST /api/v1/projects/:id/dispute` - 提交争议
- `POST /api/v1/admin/projects/:id/audit` - 管理员介入仲裁

---

### 4.4 分阶段验收不通过

**触发场景**：
- 用户验收某阶段不通过

**处理流程**：
- 工长整改
- 用户重新验收
- 验收通过后，解冻该阶段款项并放款

**状态流转**：
- `milestone_review` → `in_progress`（验收不通过，工长整改）
- `in_progress` → `milestone_review`（整改完成，重新提交验收）
- `milestone_review` → `in_progress`（验收通过，继续下一阶段）

**资金处理**：
- 冻结该阶段及后续款项
- 验收通过后，解冻并放款

**对应接口**：
- `POST /api/v1/projects/:id/milestones/:milestoneId/reject` - 用户验收不通过

---

### 4.5 退款

**触发场景**：
- 设计方案拒绝次数 ≥ 3
- 工长选择失败且用户终止
- 施工中途暂停且无法恢复
- 阶段验收不通过且无法整改
- 用户主动申请退款

**处理流程**：
- 用户/系统提交退款申请
- 管理员审核退款申请
- 审核通过后，系统自动退款

**状态流转**：
- 任意状态 → `cancelled`（退款完成）

**资金处理**：
- 按退款规则计算退款金额
- 已放款部分不退款
- 未放款部分全额退款

**对应接口**：
- `POST /api/v1/bookings/:id/refund` - 申请退款
- `POST /api/v1/admin/bookings/:bookingId/refund` - 管理员手动退款

---

### 4.6 项目关闭

**触发场景**：
- 项目正常完成，全部款项放款完毕
- 项目异常终止，退款完成

**处理流程**：
- 系统自动关闭项目

**状态流转**：
- `completed` → `archived`（正常完成）
- `cancelled` → `archived`（异常终止）

**资金处理**：
- 无

**对应接口**：
- `POST /api/v1/admin/projects/:id/close` - 管理员关闭项目

---

### 4.7 审计介入与审计结论

**触发场景**：
- 用户与商家争议无法协商
- 资金流转异常
- 验收标准争议

**处理流程**：
- 用户/商家提交审计申请
- 管理员介入审计
- 管理员给出仲裁结论
- 系统执行仲裁结论

**状态流转**：
- `disputed` → `in_progress`（仲裁后继续执行）
- `disputed` → `cancelled`（仲裁后退款关闭）

**资金处理**：
- 按仲裁结论处理

**对应接口**：
- `POST /api/v1/admin/projects/:id/audit` - 管理员介入审计

---

## 5. 业务对象与状态定义

### 5.1 商家入驻（merchant_applications / providers / material_shops）

**状态枚举**：
- `pending` - 审核中
- `approved` - 审核通过
- `rejected` - 审核拒绝

**状态流转**：
- 提交入驻申请 → `pending`
- 管理员审核通过 → `approved`
- 管理员审核拒绝 → `rejected`
- 驳回后重新提交 → `pending`

---

### 5.2 线索/预约（bookings / demands）

**状态枚举**：
- `pending` - 待分发/待承接
- `confirmed` - 已承接
- `cancelled` - 已取消

**状态流转**：
- 用户发起需求 → `pending`
- 商家承接 → `confirmed`
- 用户/商家取消 → `cancelled`

---

### 5.3 设计方案（proposals）

**状态枚举**：
- `pending` - 待用户确认
- `confirmed` - 已确认
- `rejected` - 已拒绝
- `expired` - 已过期

**状态流转**：
- 设计师提交方案 → `pending`
- 用户确认 → `confirmed`
- 用户拒绝 → `rejected`
- 超时未确认 → `expired`

---

### 5.4 施工报价（quote_tasks / quote_submissions）

**状态枚举**：
- `pending` - 待工长报价
- `submitted` - 已提交报价
- `confirmed` - 已确认
- `rejected` - 已拒绝

**状态流转**：
- 创建报价任务 → `pending`
- 工长提交报价 → `submitted`
- 用户确认 → `confirmed`
- 用户拒绝 → `rejected`

---

### 5.5 订单（orders）

**状态枚举**：
- `pending` - 待支付
- `paid` - 已支付
- `completed` - 已完成
- `closed` - 已关闭

**状态流转**：
- 生成订单 → `pending`
- 用户支付 → `paid`
- 项目完工 → `completed`
- 项目关闭 → `closed`

---

### 5.6 项目（projects）

**状态枚举**：
- `pending` - 待监理协调开工
- `in_progress` - 施工中
- `completed` - 已完成
- `closed` - 已关闭

**状态流转**：
- 创建项目 → `pending`
- 工长开工 → `in_progress`
- 项目完工 → `completed`
- 项目关闭 → `closed`

---

### 5.7 项目阶段/里程碑（milestones）

**状态枚举**：
- `pending` - 待执行
- `in_progress` - 执行中
- `submitted` - 已提交验收
- `approved` - 验收通过
- `rejected` - 验收不通过

**状态流转**：
- 创建阶段 → `pending`
- 工长开始执行 → `in_progress`
- 工长提交验收 → `submitted`
- 用户验收通过 → `approved`
- 用户验收不通过 → `rejected`

---

### 5.8 业务闭环（business_flows）

**作用**：
- 作为主链聚合根，串联预约/需求来源、设计确认、施工方确认、施工报价确认、项目开工与验收、完工后的案例草稿沉淀

**关键字段**：
- `stage` - 业务阶段（见 1.2 业务阶段枚举）
- `booking_id` - 预约 ID
- `proposal_id` - 设计方案 ID
- `selected_foreman_provider_id` - 选中的工长 ID
- `selected_quote_submission_id` - 选中的施工报价 ID
- `project_id` - 项目 ID
- `inspiration_case_draft_id` - 案例草稿 ID

**状态流转**：
- 按主链路 9 个节点流转，见 1.2 业务阶段枚举

---

## 6. 通知与审计要求

### 6.1 关键决策节点通知

**必须发送通知的节点**：
- 商家入驻审核通过/拒绝
- 用户发起预约（通知商家）
- 商家承接预约（通知用户）
- 设计师提交方案（通知用户）
- 用户确认/拒绝方案（通知设计师）
- 工长提交施工报价（通知用户）
- 用户确认/拒绝施工报价（通知工长）
- 工长提交阶段验收（通知用户）
- 用户验收通过/不通过（通知工长）
- 项目完工（通知用户）
- 退款完成（通知用户/商家）

---

### 6.2 审计留痕要求

**必须留痕的操作**：
- 入驻审核
- 方案确认/拒绝
- 工长确认/拒绝
- 阶段验收通过/不通过
- 放款
- 退款
- 项目关闭
- 审计介入与仲裁结论

**留痕字段**：
- 操作人
- 操作时间
- 操作类型
- 操作结果
- 操作原因（如有）

---

## 7. 与 API 接口对齐

### 7.1 主链路节点 → 接口映射

| 主链路节点 | 关键接口 |
|-----------|---------|
| 商家入驻与能力配置 | `POST /api/v1/merchant/apply` |
| 用户需求进入线索/预约 | `POST /api/v1/bookings` |
| 设计沟通、量房、预算确认 | `POST /api/v1/bookings/:id/site-survey` |
| 设计方案/报价提交与确认 | `POST /api/v1/proposals`, `POST /api/v1/proposals/:id/confirm` |
| 工长选择与确认 | `POST /api/v1/quote-tasks`, `POST /api/v1/quote-tasks/:id/confirm` |
| 订单生成、业务闭环与项目创建 | `POST /api/v1/orders`, `POST /api/v1/projects` |
| 项目阶段执行与资金流转 | `POST /api/v1/projects/:id/milestones/:milestoneId/submit` |
| 验收、放款、退款、关闭 | `POST /api/v1/projects/:id/milestones/:milestoneId/approve` |

---

### 7.2 业务阶段 → 接口行为映射

| 业务阶段 | 触发接口 | 下一阶段 |
|---------|---------|---------|
| `lead_pending` | `POST /api/v1/bookings/:id/confirm` | `consulting` |
| `consulting` | `POST /api/v1/proposals` | `proposal_pending` |
| `proposal_pending` | `POST /api/v1/proposals/:id/confirm` | `proposal_confirmed` |
| `proposal_confirmed` | `POST /api/v1/quote-tasks` | `constructor_pending` |
| `constructor_pending` | `POST /api/v1/quote-tasks/:id/submit` | `construction_quote_pending` |
| `construction_quote_pending` | `POST /api/v1/quote-tasks/:id/confirm` | `ready_to_start` |
| `ready_to_start` | `POST /api/v1/projects/:id/start` | `in_progress` |
| `in_progress` | `POST /api/v1/projects/:id/milestones/:milestoneId/submit` | `milestone_review` |
| `milestone_review` | `POST /api/v1/projects/:id/milestones/:milestoneId/approve` | `in_progress` / `completed` |
| `completed` | `POST /api/v1/projects/:id/complete` | `archived` |

---

## 8. 附录

### 8.1 与 PRD 对齐说明

本文档与 [产品需求文档(PRD).md](./产品需求文档(PRD).md) v2.0 保持一致：

- 主链路 9 个节点完全一致
- 两个独立成交点定义完全一致
- 分阶段验收/整体验收双模式完全一致
- 异常收口机制完全一致

### 8.2 变更记录

| 版本 | 日期 | 变更内容 | 变更人 |
|------|------|---------|-------|
| v2.0 | 2026-03-17 | 重写为与 PRD v2.0 对齐的业务流底稿，补齐双成交点、阶段验收、异常收口 | 产品团队 |

---

**文档结束**
