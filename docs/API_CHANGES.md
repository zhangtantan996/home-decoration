# API 接口变更清单

## 2026-03-08 驳回重提详情回填安全修复（P0/P1）

### 变更范围
- `POST /api/v1/merchant/apply/:id/detail-for-resubmit`
- `POST /api/v1/material-shop/apply/:id/detail-for-resubmit`
- `POST /api/v1/merchant/apply/:id/resubmit`
- `POST /api/v1/material-shop/apply/:id/resubmit`

### 行为变更
- `detail-for-resubmit` 从匿名 GET 升级为带 `phone + code` 的 POST，必须先通过 `identity_apply` 验证码校验后才返回原申请表单详情。
- `detail-for-resubmit` 响应新增 `resubmitToken`，用于保护后续重提提交链路。
- 两个 `resubmit` 接口优先校验 `resubmitToken`；兼容窗口内仍允许 `code` 作为后备凭据，但不允许无 token / 无验证码直接重提。

### 影响说明
- 前端重提回填必须先调用新的 POST 详情接口，再使用返回的 `resubmitToken` 提交。
- 旧的匿名详情路径不再继续使用，避免按申请 ID 直接读取敏感回填信息。

### 一期试运营补充
- 正式商家实体新增来源追溯字段：`providers.source_application_id`、`material_shops.source_application_id`。
- 审核详情与商家资料接口补充 `sourceApplicationId` / `merchantKind`，支持一期开通后的回查与回滚定位。
- 试运营发布与回滚规则见：`docs/MERCHANT_TRIAL_OPERATION_SOP.md`。

## 2026-03-05 入驻 schema 对齐修复（v1.5.3）

### 背景
- 部分环境未完整执行 `v1.5.0/v1.5.1/v1.5.2`，会在提交入驻时触发 `column "role" of relation "merchant_applications" does not exist`。
- 原因不是接口降级，而是数据库结构滞后于代码契约。

### 变更范围
- 新增幂等迁移脚本（双目录同步）：
  - `server/scripts/migrations/v1.5.3_reconcile_unified_onboarding_schema.sql`
  - `server/migrations/v1.5.3_reconcile_unified_onboarding_schema.sql`

### 修复内容
- 补齐 `merchant_applications` 扩展字段（`role/entity_type/avatar/work_types/highlight_tags/pricing_json/graduate_school/design_philosophy/legal_*`）。
- 补齐 `providers` 扩展字段（含 `work_types` 统一为 `TEXT`）。
- 补齐 `material_shops` 扩展字段。
- 创建/补齐 `material_shop_applications`、`material_shop_application_products`、`material_shop_products`、`merchant_identity_change_applications` 及索引。
- 兼容处理 `current_role` 标识符（使用 `"current_role"`）。

### 执行建议
- 线上/测试环境优先执行 `v1.5.3`（幂等，可重复执行）。
- 执行后重启 API 进程，避免 PostgreSQL prepared statement 缓存导致的 `cached plan must not change result type`。

## 2026-03-05 验证码测试固定模式（临时）

### 变更范围
- `POST /api/v1/auth/send-code`
- 所有使用 `VerifySMSCode` 的接口（登录/注册/商家入驻/主材商入驻/提现/绑卡等）

### 行为变更
- 在测试固定模式下，验证码统一为固定值（默认 `123456`）。
- `send-code` 在固定模式下不再依赖风控、图形验证或 Redis 存储，直接返回成功。
- 固定模式下校验逻辑统一：输入验证码与固定值一致即通过，否则返回“验证码错误”。

### 开关与默认
- `SMS_FIXED_CODE_MODE`:
  - 显式设置 `true/1` 时开启
  - 未设置时在非 release 或本地环境默认开启
- `SMS_FIXED_CODE`:
  - 固定验证码值，默认 `123456`

## 2026-03-05 入驻条款勾选留痕（v1.5.2）

### 变更范围
- `POST /api/v1/merchant/apply`
- `POST /api/v1/merchant/apply/:id/resubmit`
- `POST /api/v1/material-shop/apply`
- `POST /api/v1/material-shop/apply/:id/resubmit`
- `merchant_applications` 表结构
- `material_shop_applications` 表结构

### 请求字段新增
所有入驻提交接口新增必填字段：

```json
"legalAcceptance": {
  "accepted": true,
  "onboardingAgreementVersion": "v1.0.0-20260305",
  "platformRulesVersion": "v1.0.0-20260305",
  "privacyDataProcessingVersion": "v1.0.0-20260305"
}
```

### 后端硬校验
- `accepted` 必须为 `true`。
- 三个条款版本字段不能为空，且长度限制为 `1-64`。
- 任意不满足时返回 `400` 与明确错误信息。

### 留痕字段
两张申请表新增：
- `legal_acceptance_json`（TEXT，存版本快照）
- `legal_accepted_at`（TIMESTAMP，记录服务端确认时间）
- `legal_accept_source`（VARCHAR，默认 `merchant_web`）

### 版本管理规则
- 条款版本号由前端常量统一维护（本期：`v1.0.0-20260305`）。
- 条款正文更新时，需同步更新：
  - `admin/src/constants/merchantLegal.ts`
  - `docs/legal/*.md`
  - `server/docs/API接口文档.md`

## 2026-03-05 商家入驻字段全量补齐（v1.5.1）

### 变更范围
- `POST /api/v1/merchant/apply`
- `POST /api/v1/merchant/apply/:id/resubmit`
- `POST /api/v1/material-shop/apply`
- `POST /api/v1/material-shop/apply/:id/resubmit`
- `GET /api/v1/merchant/info`
- `PUT /api/v1/merchant/info`
- `GET /api/v1/designers/:id` / `GET /api/v1/foremen/:id` / `GET /api/v1/companies/:id`（字段消费对齐）

### 服务商入驻升级
- 新增并强制必填：`avatar: string`。
- `yearsExperience` 强化为设计师/工长必填，范围 `1-50`。
- `portfolioCases[].description` 改为必填，长度 `1-5000`。
- 审核通过映射补齐：`avatar/highlightTags/pricing/graduateSchool/designPhilosophy` 写入 `providers`。

### 主材商入驻升级
- 强制必填：`contactName`、`contactPhone`、`businessHours`、`address`。
- `contactPhone` 必须通过手机号格式校验。
- 继续维持主材商品硬校验：`products` 数量 `5-20`，每商品至少 1 图，参数对象与价格必填。

### 校验与安全
- 服务端硬校验优先，前端仅做提前校验与提示。
- 新增资质核验适配层（默认 `manual`）：
  - `ID_CARD_VERIFY_PROVIDER=manual|xxx`
  - `LICENSE_VERIFY_PROVIDER=manual|xxx`
  - `VERIFY_TIMEOUT_MS`
- 证件号继续走加密存储逻辑（`encryptSensitiveOrPlain`），日志禁止明文输出证件号与手机号。

### 兼容性说明
- 旧字段 `applicantType` 继续兼容，灰度期内与 `role/entityType` 并存。
- C 端接口结构不破坏，新增字段按“有值显示、空值隐藏”策略消费。

## 2026-03-03 商家入驻与登录统一改版（v1.5.0）

### 变更范围
- `POST /api/v1/merchant/login`
- `POST /api/v1/merchant/apply`
- `POST /api/v1/merchant/apply/:id/resubmit`
- `GET /api/v1/merchant/apply/:phone/status`
- `POST /api/v1/merchant/change-application`（新增）
- `POST /api/v1/material-shop/apply`（新增）
- `GET /api/v1/material-shop/apply/:phone/status`（新增）
- `POST /api/v1/material-shop/apply/:id/resubmit`（新增）
- `GET /api/v1/material-shop/me`（新增）
- `PUT /api/v1/material-shop/me`（新增）
- `GET /api/v1/material-shop/me/products`（新增）
- `POST /api/v1/material-shop/me/products`（新增）
- `PUT /api/v1/material-shop/me/products/:id`（新增）
- `DELETE /api/v1/material-shop/me/products/:id`（新增）

### 关键变更
- `merchant/login` 成功时返回新增：
  - `merchantKind: provider|material_shop`
  - `role`
  - `entityType`
  - 兼容字段 `provider.applicantType/provider.providerSubType`
- `merchant/login` 失败时支持结构化引导：
  - `data.nextAction: APPLY|PENDING|RESUBMIT|CHANGE_ROLE`
  - `data.applyStatus`（可选）
- 服务商申请模型升级：
  - 新增 `role: designer|foreman|company`
  - 新增 `entityType: personal|company`
  - 新增 `highlightTags: string[]`
  - 新增 `pricing: object`
  - 新增 `graduateSchool?: string`
  - 新增 `designPhilosophy?: string`
  - 继续兼容旧字段 `applicantType`
- 主材商申请改为独立通道，不再并入 `merchant/apply`。

### 校验规则
- 服务商规则由后端硬校验：
  - 设计师：3套案例，每套3-6图，风格1-3，报价需平层/复式/其他
  - 工长：3套案例，每套8-12图，亮点1-3，工种>=1，报价需 `perSqm`
  - 装修公司：3套案例，报价需全包/半包，企业执照必填
- 主材商规则由后端硬校验：
  - 商品数 5-20
  - 每个商品至少1图，且必须包含参数对象与价格
  - 营业执照号与执照图片必填

### 兼容性说明
- 旧 `applicantType` 仍保留并在服务端映射到新模型。
- `providers.work_types` 支持 JSON 数组与逗号串双格式读取，保证 C 端兼容。

## 2026-02-09 商家中心阶段1契约统一（v1.4.4）

### 变更范围
- `GET /api/v1/merchant/dashboard`
- `POST /api/v1/merchant/login`
- `GET /api/v1/merchant/info`
- `PUT /api/v1/merchant/info`
- `GET /api/v1/merchant/service-settings`
- `PUT /api/v1/merchant/service-settings`
- `POST /api/v1/merchant/withdraw`
- `POST /api/v1/merchant/bank-accounts`

### 关键变更
- `merchant/dashboard` 增加平铺统计字段：`todayBookings`、`pendingProposals`、`activeProjects`、`totalRevenue`、`monthRevenue`，并继续保留 `bookings/proposals/orders` 分组结构。
- `merchant/login` 的 `data.provider` 增加：`applicantType` 与 `providerSubType`，用于前端角色策略和文案判定。
- `merchant/info` 查询结果补充：`applicantType`、`providerSubType`、`workTypes`。
- `merchant/info` 更新支持 `workTypes`，其中工长要求至少 1 项，非工长写入时自动忽略/清空。
- 新增服务设置读写接口：`merchant/service-settings`，字段包含接单状态、自动确认时长、响应描述、价格区间、服务风格、服务套餐。
- 高风险资金操作对齐：提现与新增银行卡均要求 `verificationCode`。

### 兼容性说明
- 旧结构保留兼容：dashboard 旧分组字段未移除；新增字段不会破坏旧前端。
- 旧商家类型继续可用：`personal/studio/company` 规则保持不变。

---

## 2026-02-07 商家入驻工长类型补齐（v1.4.3）

### 变更范围
- `POST /api/v1/merchant/apply`
- `POST /api/v1/merchant/apply/:id/resubmit`
- `GET /api/v1/merchant/apply/:phone/status`

### 字段变更
- `applicantType` 枚举由 `personal|studio|company` 扩展为 `personal|studio|company|foreman`。
- 新增字段：`workTypes: string[]`（`foreman` 必填，其他类型可忽略）。
- 新增字段：`yearsExperience: number`（`foreman` 建议必填，范围 1-50）。
- 状态查询新增：`applicantType` 字段，前端用于驳回后保留原类型重新提交。

### 校验规则
- `foreman`：必须提供至少 1 个 `workTypes`；案例最少 1 个。
- `personal|studio|company`：保持设计导向规则，案例最少 3 个；公司仍需营业执照。

### 审核映射
- 审核通过时 `foreman` 映射为：
  - `providers.provider_type = 3`
  - `providers.sub_type = 'foreman'`
  - `providers.work_types` 回填 `workTypes`

---

> **文档版本**: v1.0
> **创建时间**: 2025-12-30
> **相关文档**: [DEVELOPMENT_PLAN.md](./DEVELOPMENT_PLAN.md)

---

## 📋 变更概览

本文档记录了开发计划中新增和修改的所有API接口。

| 模块 | 新增接口数 | 修改接口数 | 优先级 |
|------|-----------|-----------|--------|
| 通知系统 | 5 | 0 | P0 |
| 方案管理 | 2 | 1 | P0 |
| 退款管理 | 1 | 0 | P0 |
| 提现审核 | 4 | 1 | P0 |
| 定时任务监控 | 1 | 0 | P0 |
| 售后管理 | 3 | 0 | P1 |

---

## 一、通知系统 API

### 1.1 获取通知列表

```http
GET /api/v1/notifications
```

**请求参数**:
| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| page | number | 否 | 页码，默认1 |
| pageSize | number | 否 | 每页数量，默认20 |

**响应示例**:
```json
{
  "code": 0,
  "message": "success",
  "data": {
    "list": [
      {
        "id": 123,
        "title": "新预约通知",
        "content": "您有一个新的预约请求，请尽快处理",
        "type": "booking.intent_paid",
        "relatedId": 456,
        "relatedType": "booking",
        "isRead": false,
        "actionUrl": "/merchant/bookings/456",
        "createdAt": "2025-12-30T10:00:00Z"
      }
    ],
    "total": 50,
    "page": 1,
    "pageSize": 20
  }
}
```

---

### 1.2 获取未读数量

```http
GET /api/v1/notifications/unread-count
```

**响应示例**:
```json
{
  "code": 0,
  "data": {
    "count": 5
  }
}
```

---

### 1.3 标记单个通知为已读

```http
PUT /api/v1/notifications/:id/read
```

**路径参数**:
| 参数 | 类型 | 说明 |
|------|------|------|
| id | number | 通知ID |

**响应示例**:
```json
{
  "code": 0,
  "message": "标记成功"
}
```

---

### 1.4 标记全部通知为已读

```http
PUT /api/v1/notifications/read-all
```

**响应示例**:
```json
{
  "code": 0,
  "message": "全部已读"
}
```

---

### 1.5 删除通知

```http
DELETE /api/v1/notifications/:id
```

**路径参数**:
| 参数 | 类型 | 说明 |
|------|------|------|
| id | number | 通知ID |

**响应示例**:
```json
{
  "code": 0,
  "message": "删除成功"
}
```

---

## 二、方案管理 API

### 2.1 拒绝方案（修改）

```http
POST /api/v1/proposals/:id/reject
```

**变更说明**: 新增必填参数 `reason`

**请求体**:
```json
{
  "reason": "配色不满意，请调整为暖色调"
}
```

**响应示例**:
```json
{
  "code": 0,
  "message": "方案已拒绝，商家可重新提交"
}
```

---

### 2.2 查看方案版本历史（新增）

```http
GET /api/v1/proposals/booking/:bookingId/history
```

**路径参数**:
| 参数 | 类型 | 说明 |
|------|------|------|
| bookingId | number | 预约ID |

**响应示例**:
```json
{
  "code": 0,
  "data": [
    {
      "id": 789,
      "version": 3,
      "status": 1,
      "designFee": 8000,
      "summary": "v3版本，调整配色为暖色调",
      "submittedAt": "2025-12-30T14:00:00Z"
    },
    {
      "id": 788,
      "version": 2,
      "status": 3,
      "rejectionReason": "空间布局不合理",
      "rejectedAt": "2025-12-29T16:00:00Z"
    },
    {
      "id": 787,
      "version": 1,
      "status": 4,
      "rejectionReason": "配色不满意",
      "rejectedAt": "2025-12-28T11:00:00Z"
    }
  ]
}
```

---

### 2.3 商家重新提交方案（新增）

```http
POST /api/v1/merchant/proposals/resubmit
```

**请求体**:
```json
{
  "proposalId": 788,
  "summary": "v3版本，调整配色为暖色调",
  "designFee": 8000,
  "constructionFee": 50000,
  "materialFee": 30000,
  "estimatedDays": 60,
  "attachments": "[\"url1\", \"url2\"]"
}
```

**响应示例**:
```json
{
  "code": 0,
  "data": {
    "proposal": {
      "id": 789,
      "version": 3,
      "status": 1,
      "submittedAt": "2025-12-30T14:00:00Z",
      "userResponseDeadline": "2026-01-13T14:00:00Z"
    },
    "message": "已提交方案v3，等待用户确认"
  }
}
```

---

### 2.4 查看方案拒绝信息（新增）

```http
GET /api/v1/merchant/proposals/:id/rejection-info
```

**响应示例**:
```json
{
  "code": 0,
  "data": {
    "proposalId": 788,
    "version": 2,
    "rejectionCount": 2,
    "rejectionReason": "空间布局不合理",
    "rejectedAt": "2025-12-29T16:00:00Z",
    "canResubmit": true,
    "maxRejections": 3,
    "remainingAttempts": 1
  }
}
```

---

## 三、退款管理 API

### 3.1 管理员手动退款（新增）

```http
POST /api/v1/admin/bookings/:bookingId/refund
```

**路径参数**:
| 参数 | 类型 | 说明 |
|------|------|------|
| bookingId | number | 预约ID |

**请求体**:
```json
{
  "reason": "商家违规操作，全额退款"
}
```

**响应示例**:
```json
{
  "code": 0,
  "message": "退款成功"
}
```

---

## 四、提现审核 API

### 4.1 提现申请列表（新增）

```http
GET /api/v1/admin/withdraws
```

**请求参数**:
| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| status | number | 否 | 0=待审核, 1=成功, 2=失败 |
| page | number | 否 | 页码 |
| pageSize | number | 否 | 每页数量 |

**响应示例**:
```json
{
  "code": 0,
  "data": {
    "list": [
      {
        "id": 101,
        "orderNo": "W20251230100001",
        "providerId": 5,
        "providerName": "张设计工作室",
        "amount": 5000,
        "bankAccount": "6222****1234",
        "bankName": "中国银行",
        "status": 0,
        "createdAt": "2025-12-30T09:00:00Z"
      }
    ],
    "total": 10,
    "page": 1,
    "pageSize": 20
  }
}
```

---

### 4.2 提现详情（新增）

```http
GET /api/v1/admin/withdraws/:id
```

**响应示例**:
```json
{
  "code": 0,
  "data": {
    "id": 101,
    "orderNo": "W20251230100001",
    "provider": {
      "id": 5,
      "companyName": "张设计工作室",
      "phone": "138****5678"
    },
    "bankAccount": {
      "accountName": "张三",
      "accountNo": "6222 0000 1234 5678",
      "bankName": "中国银行",
      "branchName": "上海分行"
    },
    "amount": 5000,
    "status": 0,
    "createdAt": "2025-12-30T09:00:00Z"
  }
}
```

---

### 4.3 审核通过（新增）

```http
POST /api/v1/admin/withdraws/:id/approve
```

**响应示例**:
```json
{
  "code": 0,
  "message": "审核通过，打款中..."
}
```

---

### 4.4 审核拒绝（新增）

```http
POST /api/v1/admin/withdraws/:id/reject
```

**请求体**:
```json
{
  "reason": "银行账户信息不完整，请重新提交"
}
```

**响应示例**:
```json
{
  "code": 0,
  "message": "已拒绝"
}
```

---

### 4.5 商家申请提现（修改）

```http
POST /api/v1/merchant/withdraws
```

**变更说明**: 增加并发安全控制（行锁）

**请求体**:
```json
{
  "amount": 5000,
  "bankAccountId": 3
}
```

**响应示例**:
```json
{
  "code": 0,
  "data": {
    "withdrawId": 101,
    "orderNo": "W20251230100001",
    "message": "提现申请已提交，预计1-3个工作日到账"
  }
}
```

---

## 五、定时任务监控 API

### 5.1 获取定时任务指标（新增）

```http
GET /api/v1/admin/system/cron-metrics
```

**响应示例**:
```json
{
  "code": 0,
  "data": {
    "order_expiration": {
      "taskName": "order_expiration",
      "lastRunTime": "2025-12-30T10:05:00Z",
      "totalRuns": 1234,
      "lastRowsAffected": 3
    },
    "merchant_timeout": {
      "taskName": "merchant_timeout",
      "lastRunTime": "2025-12-30T10:00:00Z",
      "totalRuns": 567,
      "lastRowsAffected": 0
    },
    "user_confirm_timeout": {
      "taskName": "user_confirm_timeout",
      "lastRunTime": "2025-12-30T10:00:00Z",
      "totalRuns": 567,
      "lastRowsAffected": 1
    }
  }
}
```

---

## 六、售后管理 API

### 6.1 售后申请列表（新增）

```http
GET /api/v1/admin/after-sales
```

**请求参数**:
| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| type | string | 否 | refund, complaint, repair |
| status | number | 否 | 0=待处理, 1=处理中, 2=已完成, 3=已拒绝 |
| page | number | 否 | 页码 |
| pageSize | number | 否 | 每页数量 |

**响应示例**:
```json
{
  "code": 0,
  "data": {
    "list": [
      {
        "id": 201,
        "orderNo": "AS20251230001",
        "userId": 10,
        "userName": "李四",
        "type": "refund",
        "typeLabel": "退款",
        "reason": "商家延期施工",
        "amount": 10000,
        "status": 0,
        "createdAt": "2025-12-30T08:00:00Z"
      }
    ],
    "total": 5,
    "page": 1,
    "pageSize": 20
  }
}
```

---

### 6.2 售后审核通过（新增）

```http
POST /api/v1/admin/after-sales/:id/approve
```

**响应示例**:
```json
{
  "code": 0,
  "message": "审核通过"
}
```

---

### 6.3 售后审核拒绝（新增）

```http
POST /api/v1/admin/after-sales/:id/reject
```

**请求体**:
```json
{
  "reply": "经核实，商家未延期施工，申请不成立"
}
```

**响应示例**:
```json
{
  "code": 0,
  "message": "已拒绝"
}
```

---

## 通知类型常量

### 完整通知类型列表

| 类型 | 说明 | 接收方 |
|------|------|--------|
| `booking.intent_paid` | 意向金支付成功 | 商家 |
| `booking.confirmed` | 商家接单 | 用户 |
| `booking.cancelled` | 预约取消 | 双方 |
| `proposal.submitted` | 方案已提交 | 用户 |
| `proposal.confirmed` | 方案已确认 | 商家 |
| `proposal.rejected` | 方案被拒绝 | 商家 |
| `order.created` | 账单生成 | 用户 |
| `order.paid` | 订单支付成功 | 商家 |
| `order.expiring` | 订单即将过期 | 用户 |
| `order.expired` | 订单已过期 | 用户 |
| `withdraw.approved` | 提现审核通过 | 商家 |
| `withdraw.rejected` | 提现审核拒绝 | 商家 |
| `withdraw.completed` | 提现已到账 | 商家 |
| `audit.approved` | 入驻审核通过 | 商家 |
| `audit.rejected` | 入驻审核拒绝 | 商家 |
| `case_audit.approved` | 作品审核通过 | 商家 |
| `case_audit.rejected` | 作品审核拒绝 | 商家 |

---

## 错误码说明

| 错误码 | 说明 | HTTP状态码 |
|--------|------|-----------|
| 0 | 成功 | 200 |
| 400 | 参数错误 | 400 |
| 401 | 未授权 | 401 |
| 403 | 无权限 | 403 |
| 404 | 资源不存在 | 404 |
| 500 | 服务器错误 | 500 |

---

## API 测试建议

### 使用Postman测试

1. 导入Collection（建议创建）
2. 设置环境变量：
   - `base_url`: http://localhost:8080/api/v1
   - `token`: Bearer eyJhbGc...（实际JWT token）
3. 测试流程：
   - 先测试登录获取token
   - 测试各模块的增删改查接口
   - 验证权限控制
   - 测试异常情况

### 关键测试场景

1. **通知系统**
   - 创建预约 → 支付意向金 → 验证商家收到通知
   - 商家提交方案 → 验证用户收到通知
   - 标记已读 → 验证未读数量减少

2. **方案版本**
   - 提交方案 → 拒绝 → 重新提交 → 验证版本号递增
   - 连续拒绝3次 → 验证自动退款

3. **提现审核**
   - 商家申请提现 → 管理员审核通过 → 验证商家收到通知
   - 并发申请提现 → 验证行锁有效性

---

## 变更日志

| 日期 | 版本 | 变更内容 |
|------|------|---------|
| 2025-12-30 | v1.0 | 初始版本，包含所有新增和修改的API接口 |
