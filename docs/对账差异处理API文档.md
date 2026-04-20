# 对账差异处理API文档

## 概述

补充对账差异的处理流程，让Admin能标记差异状态、记录处理说明。

## 差异处理状态

```typescript
type DifferenceHandleStatus = 'pending' | 'investigating' | 'resolved' | 'ignored';
```

- `pending`: 待处理（默认状态）
- `investigating`: 调查中
- `resolved`: 已解决
- `ignored`: 已忽略

## API接口

### 1. 标记差异为调查中

**接口**: `POST /api/v1/admin/reconciliation/differences/:id/investigate`

**权限**: `finance:transaction:approve` + Admin重认证

**请求体**:
```json
{
  "notes": "正在调查原因，已联系支付渠道"
}
```

**响应**:
```json
{
  "code": 0,
  "message": "差异已标记为调查中"
}
```

---

### 2. 忽略差异

**接口**: `POST /api/v1/admin/reconciliation/differences/:id/ignore`

**权限**: `finance:transaction:approve` + Admin重认证 + 必须提供原因

**请求体**:
```json
{
  "reason": "金额差异小于0.01元，可忽略"
}
```

**响应**:
```json
{
  "code": 0,
  "message": "差异已忽略"
}
```

---

### 3. 解决差异

**接口**: `POST /api/v1/admin/reconciliation/differences/:id/resolve-enhanced`

**权限**: `finance:transaction:approve` + Admin重认证 + 必须提供解决方案

**请求体**:
```json
{
  "solution": "已手动调整订单状态为已支付",
  "notes": "用户实际已支付，但系统未同步，已手动修复"
}
```

**响应**:
```json
{
  "code": 0,
  "message": "差异已解决"
}
```

---

### 4. 差异列表（已更新）

**接口**: `GET /api/v1/admin/reconciliation/:id/differences`

**新增返回字段**:
```typescript
interface ReconciliationDifference {
  id: number;
  differenceType: string;
  outTradeNo: string;
  providerTradeNo: string;
  platformAmount: number;
  channelAmount: number;
  platformStatus: string;
  channelStatus: string;
  
  // 新增字段
  handleStatus: DifferenceHandleStatus;  // 处理状态
  ignoreReason?: string;                 // 忽略原因
  solution?: string;                     // 解决方案
  
  resolved: boolean;
  resolvedAt?: string;
  resolvedBy?: number;
  resolveNotes?: string;
  createdAt: string;
}
```

---

## 告警升级机制

### 定时任务

- **执行频率**: 每小时执行一次
- **触发条件**: 差异状态为 `pending` 且创建时间超过24小时
- **告警类型**: `payment_reconciliation_difference`
- **告警级别**: `high`

### 告警内容

```
对账差异超过24小时未处理
- 类型: amount_mismatch
- 订单号: ORDER_20260420_123456
- 金额差异: 100.00元
- 创建时间: 2026-04-19T10:00:00Z
```

### 告警跳转

点击告警后跳转到差异详情页面:
```
/admin/reconciliation/{recordId}/differences?differenceId={diffId}
```

---

## 前端实现建议

### 1. 差异列表页面

```tsx
// admin/src/pages/finance/ReconciliationDifferences.tsx

interface DifferenceListItem {
  id: number;
  handleStatus: 'pending' | 'investigating' | 'resolved' | 'ignored';
  differenceType: string;
  outTradeNo: string;
  platformAmount: number;
  channelAmount: number;
  createdAt: string;
}

// 状态标签颜色
const statusColors = {
  pending: 'orange',
  investigating: 'blue',
  resolved: 'green',
  ignored: 'gray',
};

// 状态文本
const statusTexts = {
  pending: '待处理',
  investigating: '调查中',
  resolved: '已解决',
  ignored: '已忽略',
};
```

### 2. 操作按钮

```tsx
// 根据状态显示不同操作按钮
{record.handleStatus === 'pending' && (
  <>
    <Button onClick={() => handleInvestigate(record.id)}>标记调查中</Button>
    <Button onClick={() => handleIgnore(record.id)}>忽略</Button>
    <Button type="primary" onClick={() => handleResolve(record.id)}>解决</Button>
  </>
)}

{record.handleStatus === 'investigating' && (
  <>
    <Button onClick={() => handleIgnore(record.id)}>忽略</Button>
    <Button type="primary" onClick={() => handleResolve(record.id)}>解决</Button>
  </>
)}
```

### 3. 操作弹窗

```tsx
// 调查中弹窗
<Modal title="标记为调查中" visible={investigateVisible}>
  <Form.Item label="备注" name="notes">
    <TextArea rows={4} placeholder="请输入调查备注" />
  </Form.Item>
</Modal>

// 忽略弹窗
<Modal title="忽略差异" visible={ignoreVisible}>
  <Form.Item label="忽略原因" name="reason" rules={[{ required: true }]}>
    <TextArea rows={4} placeholder="请输入忽略原因（必填）" />
  </Form.Item>
</Modal>

// 解决弹窗
<Modal title="解决差异" visible={resolveVisible}>
  <Form.Item label="解决方案" name="solution" rules={[{ required: true }]}>
    <TextArea rows={4} placeholder="请输入解决方案（必填）" />
  </Form.Item>
  <Form.Item label="处理说明" name="notes">
    <TextArea rows={4} placeholder="请输入处理说明" />
  </Form.Item>
</Modal>
```

---

## 数据库迁移

执行迁移脚本:
```bash
psql -U postgres -d home_decoration -f server/scripts/migrations/add_reconciliation_difference_handle_fields.sql
```

或使用GORM自动迁移（开发环境）:
```go
db.AutoMigrate(&model.ReconciliationDifference{})
```

---

## 测试建议

### 1. 单元测试

测试Service层方法:
- `InvestigateDifference`: 标记为调查中
- `IgnoreDifference`: 忽略差异（验证原因必填）
- `ResolveDifferenceEnhanced`: 解决差异（验证解决方案必填）
- `GetPendingDifferencesOverdue`: 查询超时差异

### 2. 集成测试

测试API端点:
- 验证权限控制（需要Admin重认证）
- 验证参数校验（原因和解决方案必填）
- 验证状态流转（pending → investigating → resolved）
- 验证重复操作（已解决的差异不能再次操作）

### 3. 定时任务测试

- 创建超过24小时的pending差异
- 手动触发定时任务
- 验证告警是否正确创建
- 验证告警跳转链接是否正确

---

## 注意事项

1. **权限控制**: 所有差异处理操作都需要 `finance:transaction:approve` 权限和Admin重认证
2. **参数校验**: 忽略和解决操作必须提供原因/解决方案
3. **状态流转**: 已解决的差异不能再次操作
4. **审计日志**: 所有操作都会记录在Admin操作日志中
5. **告警升级**: 超过24小时未处理的差异会自动创建高优先级告警
