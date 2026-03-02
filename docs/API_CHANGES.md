# API 接口变更清单

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
