# P0核心功能测试计划

> **目标**: 验证所有P0优先级功能的完整性、正确性和业务流程连贯性
> **测试范围**: P0-1至P0-6所有已实现功能
> **测试环境**: 本地开发环境 (Docker Compose)

---

## 一、测试环境准备

### 1.1 数据库初始化

**前置条件**:
- PostgreSQL数据库已运行
- 已执行所有迁移脚本

**验证步骤**:
```bash
# 检查数据库连接
docker-compose -f docker-compose.local.yml exec db psql -U postgres -d home_decoration

# 验证关键表存在
\dt notifications
\dt proposals
\dt bookings
\dt orders
\dt merchant_incomes
\dt merchant_withdraws
\dt system_configs

# 验证系统配置已初始化
SELECT key, value, description FROM system_configs WHERE key LIKE 'fee.platform.%';
```

**预期结果**:
- 所有表存在且结构正确
- system_configs表包含7条平台抽成配置记录
- bookings表包含退款相关字段: intent_fee_refunded, merchant_response_deadline
- proposals表包含版本管理字段: version, parent_proposal_id, rejection_count

---

## 二、P0-1 站内信通知系统测试

### 2.1 通知创建测试

**测试场景**: 预约支付成功后通知商家

**测试步骤**:
1. 创建预约 (POST /api/v1/bookings)
2. 支付意向金 (POST /api/v1/bookings/{id}/pay-intent-fee)
3. 查询商家通知列表 (GET /api/v1/merchant/notifications)

**预期结果**:
- 商家收到1条通知
- 通知类型: `booking.intent_paid`
- 通知标题: "新预约已支付意向金"
- relatedId = booking.id
- isRead = false

**验证SQL**:
```sql
SELECT * FROM notifications
WHERE user_type = 'provider'
  AND type = 'booking.intent_paid'
ORDER BY created_at DESC LIMIT 1;
```

---

### 2.2 未读数量统计测试

**测试步骤**:
1. 获取未读数量 (GET /api/v1/notifications/unread-count)
2. 标记第一条为已读 (PUT /api/v1/notifications/{id}/read)
3. 再次获取未读数量

**预期结果**:
- 初始未读数量 >= 1
- 标记后未读数量 = 初始 - 1
- read_at字段已更新

---

### 2.3 全部标记已读测试

**测试步骤**:
1. 创建多个通知（通过业务操作）
2. 全部标记已读 (PUT /api/v1/notifications/read-all)
3. 查询未读数量

**预期结果**:
- 未读数量 = 0
- 所有通知的is_read = true

---

## 三、P0-2 方案版本管理与拒绝重试测试

### 3.1 方案提交测试

**测试场景**: 商家首次提交方案

**测试步骤**:
1. 商家接单 (POST /api/v1/merchant/bookings/{id}/confirm)
2. 提交方案 (POST /api/v1/merchant/proposals)

**预期结果**:
- proposal.version = 1
- proposal.status = 1 (待确认)
- proposal.parent_proposal_id = 0
- proposal.rejection_count = 0
- proposal.user_response_deadline = submitted_at + 14天
- 用户收到通知 (type: `proposal.submitted`)

---

### 3.2 用户拒绝方案测试

**测试步骤**:
1. 用户拒绝方案 (POST /api/v1/proposals/{id}/reject)
   ```json
   {
     "reason": "配色不符合需求，请调整为暖色调"
   }
   ```
2. 查询方案详情

**预期结果**:
- proposal.status = 3 (已拒绝)
- proposal.rejection_reason = "配色不符合需求，请调整为暖色调"
- proposal.rejected_at 已设置
- 商家收到通知 (type: `proposal.rejected`)
- booking表中rejection_count字段 **不变** (仅在ResubmitProposal时累加)

---

### 3.3 商家重新提交v2方案测试

**测试步骤**:
1. 商家查看拒绝信息 (GET /api/v1/merchant/proposals/{id}/rejection-info)
2. 重新提交方案 (POST /api/v1/merchant/proposals/resubmit)
   ```json
   {
     "proposalId": 123,
     "summary": "v2版本，调整为暖色调设计",
     "designFee": 5000,
     "constructionFee": 80000,
     "materialFee": 50000,
     "estimatedDays": 90,
     "attachments": "[...]"
   }
   ```
3. 查询版本历史 (GET /api/v1/proposals/booking/{bookingId}/history)

**预期结果**:
- 旧方案status = 4 (已被替代)
- 新方案version = 2
- 新方案parent_proposal_id = 旧方案ID
- 新方案rejection_count = 1 (从旧方案继承并+1)
- 新方案status = 1 (待确认)
- 用户收到新方案提交通知

**版本历史验证**:
- 返回2条记录
- 按version倒序排列: [v2, v1]
- v1的status = 4

---

### 3.4 连续拒绝3次自动退款测试

**测试步骤**:
1. 用户拒绝v2方案 (第2次)
2. 商家提交v3方案
3. 用户拒绝v3方案 (第3次)
4. 查询booking状态和意向金退款情况

**预期结果**:
- 方案拒绝后:
  - proposal.status = 3
  - proposal.rejection_count = 3
- 自动触发退款:
  - booking.intent_fee_refunded = true
  - booking.intent_fee_refund_reason = "用户连续拒绝3次方案"
  - booking.status = 4 (已取消)
- 用户收到退款通知 (type: `booking.intent_refunded`)
- 商家收到拒绝通知，内容提示"用户连续拒绝3次，预约已取消，意向金已退还用户"

---

### 3.5 用户确认方案测试

**测试步骤**:
1. 用户确认方案 (POST /api/v1/proposals/{id}/confirm)
2. 查询proposal和订单

**预期结果**:
- proposal.status = 2 (已确认)
- proposal.confirmed_at 已设置
- 生成设计费订单:
  - order.order_type = "design"
  - order.proposal_id = proposal.id
  - order.total_amount = proposal.design_fee
  - order.status = 0 (待支付)
  - order.expire_at = created_at + 48小时
- 商家收到方案确认通知
- 用户收到订单生成通知

---

## 四、P0-3 意向金退款机制测试

### 4.1 支付意向金时设置商家响应期限

**测试步骤**:
1. 支付意向金 (POST /api/v1/bookings/{id}/pay-intent-fee)
2. 查询booking记录

**预期结果**:
- booking.intent_fee_paid = true
- booking.merchant_response_deadline = payment_time + 48小时
- 商家收到通知

---

### 4.2 商家超时自动退款测试

**测试步骤**:
1. 创建预约并支付意向金
2. 手动修改merchant_response_deadline为过去时间:
   ```sql
   UPDATE bookings SET merchant_response_deadline = NOW() - INTERVAL '1 hour' WHERE id = {bookingId};
   ```
3. 等待定时任务执行 (5分钟间隔) 或重启API触发
4. 查询booking状态

**预期结果**:
- booking.intent_fee_refunded = true
- booking.intent_fee_refund_reason = "商家超时48小时未接单"
- booking.status = 4 (已取消)
- 用户收到退款通知
- 后台日志: `[Cron] Processed 1 merchant timeout bookings`

**验证SQL**:
```sql
SELECT id, status, intent_fee_refunded, intent_fee_refund_reason
FROM bookings
WHERE id = {bookingId};
```

---

### 4.3 用户14天超时不退款测试

**测试步骤**:
1. 商家提交方案
2. 手动修改user_response_deadline为过去时间:
   ```sql
   UPDATE proposals SET user_response_deadline = NOW() - INTERVAL '1 day' WHERE id = {proposalId};
   ```
3. 等待定时任务执行
4. 查询proposal和booking状态

**预期结果**:
- proposal.status = 3 (已拒绝)
- booking.status = 4 (已取消)
- booking.intent_fee_refunded = **false** (意向金不退)
- 后台日志: `[Cron] Processed 1 user confirmation timeout`

---

### 4.4 管理员手动退款测试

**测试步骤**:
1. 管理员查看可退款预约列表 (GET /api/v1/admin/bookings/refundable)
2. 手动退款 (POST /api/v1/admin/bookings/{bookingId}/refund)
   ```json
   {
     "reason": "商家违规操作，强制退款"
   }
   ```

**预期结果**:
- booking.intent_fee_refunded = true
- booking.intent_fee_refund_reason = "管理员手动退款：商家违规操作，强制退款"
- 用户收到退款通知
- 后台日志记录退款操作

---

### 4.5 退款幂等性测试

**测试步骤**:
1. 对同一booking调用退款接口2次

**预期结果**:
- 第一次: 退款成功
- 第二次: 返回错误 "意向金已退款，无法重复操作"
- 数据库只有1条退款记录

---

## 五、P0-4 平台抽成系统测试

### 5.1 系统配置初始化验证

**验证SQL**:
```sql
SELECT key, value, description, editable
FROM system_configs
WHERE key LIKE 'fee.%' OR key LIKE 'withdraw.%' OR key LIKE 'settlement.%'
ORDER BY key;
```

**预期结果**:
| key | value | description |
|-----|-------|-------------|
| fee.platform.construction_fee_rate | 0.10 | 施工费抽成比例 |
| fee.platform.design_fee_rate | 0.10 | 设计费抽成比例 |
| fee.platform.intent_fee_rate | 0 | 意向金抽成比例 |
| fee.platform.material_fee_rate | 0.05 | 材料费抽成比例 |
| settlement.auto_days | 7 | 自动结算天数 |
| withdraw.fee | 0 | 提现手续费 |
| withdraw.min_amount | 100 | 最小提现金额 |

---

### 5.2 订单支付自动创建收入记录测试

**测试场景**: 支付设计费后创建收入记录并自动计算抽成

**测试步骤**:
1. 确认方案生成设计费订单 (order_type = "design", total_amount = 5000)
2. 支付设计费 (POST /api/v1/orders/{orderId}/pay)
3. 查询merchant_incomes表

**预期结果**:
- 创建1条收入记录:
  - provider_id = 商家ID
  - order_id = 订单ID
  - booking_id = 预约ID
  - type = "design_fee"
  - amount = 5000
  - platform_fee = 5000 * 0.10 = 500 (10%抽成)
  - net_amount = 5000 - 500 = 4500
  - status = 0 (待结算)
- 商家收到订单支付通知
- 后台日志: `Created income ... (抽成 10.00%, 净收入 4500.00元)`

**验证SQL**:
```sql
SELECT type, amount, platform_fee, net_amount, status
FROM merchant_incomes
WHERE order_id = {orderId};
```

---

### 5.3 不同订单类型抽成比例测试

**测试数据**:
| order_type | amount | 配置抽成比例 | 预期platform_fee | 预期net_amount |
|------------|--------|-------------|-----------------|----------------|
| design_fee | 5000 | 10% | 500 | 4500 |
| construction | 80000 | 10% | 8000 | 72000 |
| material | 50000 | 5% | 2500 | 47500 |

**测试步骤**:
对每种订单类型执行支付，验证merchant_incomes记录的platform_fee和net_amount正确

---

### 5.4 管理员修改抽成比例测试

**测试步骤**:
1. 管理员获取当前配置 (GET /api/v1/admin/system-configs)
2. 修改设计费抽成为15% (PUT /api/v1/admin/system-configs/fee.platform.design_fee_rate)
   ```json
   {
     "value": "0.15",
     "description": "设计费抽成比例（调整为15%）"
   }
   ```
3. 支付新的设计费订单 (amount = 6000)
4. 查询收入记录

**预期结果**:
- 配置更新成功
- 配置缓存已清除
- 新订单使用新抽成比例:
  - platform_fee = 6000 * 0.15 = 900
  - net_amount = 6000 - 900 = 5100
- 历史订单抽成不变 (旧订单platform_fee仍为10%)

---

### 5.5 批量更新配置测试

**测试步骤**:
1. 批量更新 (PUT /api/v1/admin/system-configs/batch)
   ```json
   {
     "fee.platform.design_fee_rate": "0.12",
     "fee.platform.construction_fee_rate": "0.08",
     "settlement.auto_days": "5"
   }
   ```
2. 验证配置已更新
3. 支付新订单验证新比例生效

**预期结果**:
- 3条配置同时更新
- 缓存清除
- 后台日志: `配置批量更新成功, updated: 3`

---

## 六、P0-5 提现人工审核流程测试

### 6.1 商家申请提现测试

**前置条件**:
- 商家有已结算收入 (status = 1)
- 已添加银行账户

**测试步骤**:
1. 查询可提现余额 (GET /api/v1/merchant/income/summary)
2. 申请提现 (POST /api/v1/merchant/withdraw/create)
   ```json
   {
     "amount": 4500,
     "bankAccountId": 1
   }
   ```

**预期结果**:
- 提现记录创建成功:
  - provider_id = 商家ID
  - order_no = W + 时间戳 + 随机码
  - amount = 4500
  - bank_account = 银行卡号
  - bank_name = 银行名称
  - status = 0 (处理中)
- 返回提示: "提现申请已提交，预计1-3个工作日到账"

---

### 6.2 管理员查看提现列表测试

**测试步骤**:
1. 管理员获取待审核提现列表 (GET /api/v1/admin/withdraws?status=0)
2. 管理员获取提现详情 (GET /api/v1/admin/withdraws/{id})

**预期结果**:
- 列表包含新建的提现申请
- 详情返回:
  - withdraw信息 (orderNo, amount, bankAccount, status)
  - provider信息 (companyName, providerType)
  - incomes列表 (已结算的收入记录)
- 银行账号完整显示 (管理员可见全号码)

---

### 6.3 管理员审核通过测试

**测试步骤**:
1. 管理员审核通过 (POST /api/v1/admin/withdraws/{id}/approve)
2. 查询提现记录和收入记录

**预期结果**:
- withdraw.status = 1 (成功)
- withdraw.completed_at 已设置
- 关联的merchant_incomes记录:
  - status = 2 (已提现)
  - withdraw_order_no = withdraw.order_no
- 商家收到通知 (type: `withdraw.approved`)
- 后台日志: `TODO: Transfer 4500.00 to bank account ...`

**验证SQL**:
```sql
SELECT status, completed_at FROM merchant_withdraws WHERE id = {withdrawId};
SELECT status, withdraw_order_no FROM merchant_incomes WHERE provider_id = {providerId} AND status = 2;
```

---

### 6.4 管理员审核拒绝测试

**测试步骤**:
1. 创建新的提现申请
2. 管理员审核拒绝 (POST /api/v1/admin/withdraws/{id}/reject)
   ```json
   {
     "reason": "银行账户信息有误，请核对后重新提交"
   }
   ```
3. 查询提现记录和收入记录

**预期结果**:
- withdraw.status = 2 (失败)
- withdraw.fail_reason = "银行账户信息有误，请核对后重新提交"
- merchant_incomes状态不变 (仍为status=1，商家可重新申请)
- 商家收到通知 (type: `withdraw.rejected`, 包含拒绝原因)

---

### 6.5 重复审核防护测试

**测试步骤**:
1. 对已审核通过的提现再次调用approve接口

**预期结果**:
- 返回错误 400: "该提现申请已处理"
- 数据库无变化

---

## 七、P0-6 超时自动处理定时任务测试

### 7.1 订单超时自动取消测试

**测试步骤**:
1. 生成设计费订单 (expire_at = created_at + 48小时)
2. 手动修改expire_at为过去时间:
   ```sql
   UPDATE orders SET expire_at = NOW() - INTERVAL '1 hour' WHERE id = {orderId};
   ```
3. 等待1分钟 (order_cron每分钟执行)
4. 查询订单状态

**预期结果**:
- order.status = 2 (已取消)
- 用户收到订单过期通知
- 后台日志: `[Cron] Cancelled 1 expired orders`

---

### 7.2 收入自动结算测试

**测试步骤**:
1. 创建收入记录 (status = 0, created_at = 当前时间)
2. 手动修改created_at为8天前:
   ```sql
   UPDATE merchant_incomes SET created_at = NOW() - INTERVAL '8 days' WHERE id = {incomeId};
   ```
3. 手动触发结算任务:
   ```bash
   # 重启API容器触发首次执行，或等待凌晨2点自动执行
   docker-compose -f docker-compose.local.yml restart api
   ```
4. 查询收入记录

**预期结果**:
- income.status = 1 (已结算)
- income.settled_at 已设置
- 后台日志: `[Cron] Successfully settled 1 income records`

**配置验证**:
- 默认自动结算天数为7天 (settlement.auto_days = 7)
- 8天前的记录应被结算，6天前的不应被结算

---

### 7.3 定时任务启动验证

**验证步骤**:
查看API容器启动日志:
```bash
docker-compose -f docker-compose.local.yml logs api | grep Cron
```

**预期日志**:
```
Order cron job started
[Cron] Order cron job started, checking expired orders every minute
Booking cron job started
[Cron] Starting booking timeout monitoring...
Income settlement cron job started
[Cron] Income settlement will start at 2025-12-31 02:00:00 (in XXhXXm)
```

---

### 7.4 定时任务执行频率验证

**验证方式**: 观察后台日志

**预期频率**:
- 订单超时检查: 每1分钟
- 预约超时检查: 每5分钟
- 收入结算: 每天凌晨2点

---

## 八、端到端业务流程测试

### 8.1 完整业务流程 - 成功路径

**场景**: 用户从预约到支付设计费的完整流程

**测试步骤**:
1. **用户创建预约** (POST /api/v1/bookings)
2. **用户支付意向金** (POST /api/v1/bookings/{id}/pay-intent-fee)
   - ✅ 商家收到通知 (booking.intent_paid)
   - ✅ booking.merchant_response_deadline 设置为48小时后
3. **商家接单** (POST /api/v1/merchant/bookings/{id}/confirm)
   - ✅ 用户收到通知 (booking.confirmed)
4. **商家提交方案v1** (POST /api/v1/merchant/proposals)
   - ✅ proposal.version = 1, status = 1
   - ✅ 用户收到通知 (proposal.submitted)
   - ✅ user_response_deadline 设置为14天后
5. **用户确认方案** (POST /api/v1/proposals/{id}/confirm)
   - ✅ proposal.status = 2
   - ✅ 生成设计费订单 (order_type="design", status=0)
   - ✅ 商家收到通知 (proposal.confirmed)
   - ✅ 用户收到通知 (order.created)
6. **用户支付设计费** (POST /api/v1/orders/{orderId}/pay)
   - ✅ order.status = 1
   - ✅ 创建收入记录:
     - amount = order.total_amount
     - platform_fee = amount * 10%
     - net_amount = amount - platform_fee
     - status = 0 (待结算)
   - ✅ 商家收到通知 (order.paid)
7. **等待7天自动结算**
   - ✅ income.status = 1 (已结算)
8. **商家申请提现** (POST /api/v1/merchant/withdraw/create)
   - ✅ withdraw.status = 0 (处理中)
9. **管理员审核通过** (POST /api/v1/admin/withdraws/{id}/approve)
   - ✅ withdraw.status = 1
   - ✅ income.status = 2 (已提现)
   - ✅ 商家收到通知 (withdraw.approved)

**验证点**:
- 所有通知正常发送
- 所有状态流转正确
- 金额计算准确
- 时间戳字段正确设置

---

### 8.2 完整业务流程 - 方案拒绝重试路径

**场景**: 用户拒绝方案后商家重新提交v2/v3

**测试步骤**:
1. 执行8.1的步骤1-4
2. **用户拒绝v1方案** (POST /api/v1/proposals/{id}/reject)
   - ✅ proposal.status = 3
   - ✅ 商家收到通知 (proposal.rejected)
3. **商家提交v2方案** (POST /api/v1/merchant/proposals/resubmit)
   - ✅ v1.status = 4 (已替代)
   - ✅ v2.version = 2, parent_proposal_id = v1.id
   - ✅ v2.rejection_count = 1
   - ✅ 用户收到通知 (proposal.submitted)
4. **用户确认v2方案**
   - ✅ 生成订单并支付
5. **验证版本历史** (GET /api/v1/proposals/booking/{bookingId}/history)
   - ✅ 返回2条记录 [v2, v1]

---

### 8.3 完整业务流程 - 连续拒绝3次退款路径

**测试步骤**:
1. 执行8.2的步骤1-3 (拒绝v1，提交v2)
2. **用户拒绝v2方案** (第2次)
3. **商家提交v3方案**
   - ✅ v3.rejection_count = 2
4. **用户拒绝v3方案** (第3次)
   - ✅ v3.status = 3
   - ✅ 触发自动退款:
     - booking.intent_fee_refunded = true
     - booking.intent_fee_refund_reason = "用户连续拒绝3次方案"
     - booking.status = 4
   - ✅ 用户收到退款通知
   - ✅ 商家收到拒绝通知（提示已退款）

---

### 8.4 完整业务流程 - 商家超时退款路径

**测试步骤**:
1. 用户创建预约并支付意向金
2. **商家48小时未接单**
   - 手动修改deadline或等待定时任务
3. **自动退款触发**
   - ✅ booking.intent_fee_refunded = true
   - ✅ booking.intent_fee_refund_reason = "商家超时48小时未接单"
   - ✅ booking.status = 4
   - ✅ 用户收到退款通知

---

### 8.5 完整业务流程 - 用户超时不退款路径

**测试步骤**:
1. 执行8.1的步骤1-4
2. **用户14天未确认方案**
   - 手动修改deadline或等待定时任务
3. **自动处理**
   - ✅ proposal.status = 3 (已拒绝)
   - ✅ booking.status = 4 (已取消)
   - ✅ booking.intent_fee_refunded = **false** (不退款)

---

## 九、并发安全性测试

### 9.1 提现并发测试

**测试目标**: 验证商家不能超额提现

**测试步骤**:
1. 商家有已结算余额 5000元
2. 使用并发工具同时发起3个提现请求:
   - Request 1: 提现 3000元
   - Request 2: 提现 3000元
   - Request 3: 提现 3000元
3. 查询merchant_withdraws表

**预期结果**:
- 只有1个或2个请求成功 (总额不超过5000)
- 失败的请求返回错误: "提现金额超过可提现余额"
- 数据库余额正确 (不出现负数)

**实现验证**:
检查merchant_income_handler.go是否使用行锁:
```go
tx.Set("gorm:query_option", "FOR UPDATE")
```

---

### 9.2 退款幂等性测试

**测试步骤**:
1. 对同一booking同时发起2次退款请求

**预期结果**:
- 只有1次退款成功
- 第2次返回错误: "意向金已退款，无法重复操作"
- 数据库只有1条退款记录

---

## 十、数据完整性测试

### 10.1 外键关联验证

**验证SQL**:
```sql
-- 检查孤立的收入记录（订单不存在）
SELECT mi.* FROM merchant_incomes mi
LEFT JOIN orders o ON mi.order_id = o.id
WHERE mi.order_id > 0 AND o.id IS NULL;

-- 检查孤立的提现记录（商家不存在）
SELECT mw.* FROM merchant_withdraws mw
LEFT JOIN providers p ON mw.provider_id = p.id
WHERE p.id IS NULL;

-- 检查孤立的方案（预约不存在）
SELECT pr.* FROM proposals pr
LEFT JOIN bookings b ON pr.booking_id = b.id
WHERE b.id IS NULL;
```

**预期结果**: 所有查询返回0条记录

---

### 10.2 金额一致性验证

**验证SQL**:
```sql
-- 验证收入记录金额计算正确
SELECT id, amount, platform_fee, net_amount,
       amount - platform_fee AS calculated_net_amount
FROM merchant_incomes
WHERE ABS(net_amount - (amount - platform_fee)) > 0.01;
```

**预期结果**: 0条记录 (net_amount = amount - platform_fee)

---

### 10.3 状态机验证

**验证SQL**:
```sql
-- 检查非法状态的订单
SELECT * FROM orders WHERE status NOT IN (0, 1, 2, 3);

-- 检查非法状态的方案
SELECT * FROM proposals WHERE status NOT IN (1, 2, 3, 4);

-- 检查非法状态的提现
SELECT * FROM merchant_withdraws WHERE status NOT IN (0, 1, 2);

-- 检查非法状态的收入
SELECT * FROM merchant_incomes WHERE status NOT IN (0, 1, 2);
```

**预期结果**: 所有查询返回0条记录

---

## 十一、性能测试

### 11.1 通知查询性能

**测试步骤**:
1. 创建1000条通知记录
2. 查询未读通知 (GET /api/v1/notifications?page=1&pageSize=20)
3. 记录响应时间

**预期结果**:
- 响应时间 < 200ms
- 使用了索引 (idx_notifications_user, idx_notifications_is_read)

**验证SQL**:
```sql
EXPLAIN ANALYZE
SELECT * FROM notifications
WHERE user_id = 1 AND user_type = 'user' AND is_read = false
ORDER BY created_at DESC
LIMIT 20;
```

---

### 11.2 定时任务执行性能

**测试步骤**:
1. 创建500条待结算收入记录 (created_at > 8天前)
2. 触发income_cron结算任务
3. 记录执行时间

**预期结果**:
- 执行时间 < 5秒
- 后台日志: `Successfully settled 500 income records`

---

## 十二、错误处理测试

### 12.1 无效参数测试

**测试用例**:
| 接口 | 无效参数 | 预期错误 |
|------|---------|---------|
| POST /api/v1/proposals/{id}/reject | reason为空 | 400: "请输入拒绝原因" |
| POST /api/v1/merchant/withdraw/create | amount=0 | 400: "参数错误" |
| POST /api/v1/admin/system-configs/batch | value为非数字 | 500: "配置更新失败" |

---

### 12.2 权限验证测试

**测试用例**:
| 场景 | 操作 | 预期结果 |
|------|------|---------|
| 用户端访问商家端接口 | GET /api/v1/merchant/income/summary | 401: 未授权 |
| 商家端访问管理端接口 | GET /api/v1/admin/withdraws | 401: 未授权 |
| 无token访问受保护接口 | GET /api/v1/notifications | 401: 未授权 |

---

### 12.3 资源不存在测试

**测试用例**:
| 接口 | 场景 | 预期错误 |
|------|------|---------|
| GET /api/v1/proposals/999999 | 方案不存在 | 404: "方案不存在" |
| POST /api/v1/admin/withdraws/999999/approve | 提现记录不存在 | 404: "提现记录不存在" |
| PUT /api/v1/notifications/999999/read | 通知不存在 | 404: "通知不存在" |

---

## 十三、测试通过标准

### 13.1 功能完整性

- ✅ P0-1: 所有关键业务节点都发送通知
- ✅ P0-2: 方案可重新提交，版本历史完整，3次拒绝触发退款
- ✅ P0-3: 商家超时、用户超时、手动退款场景覆盖
- ✅ P0-4: 平台抽成自动计算，配置可动态修改
- ✅ P0-5: 提现审核通过/拒绝流程完整，通知发送
- ✅ P0-6: 3个定时任务正常运行，日志输出正确

---

### 13.2 数据正确性

- ✅ 所有金额计算无误差
- ✅ 所有时间字段正确设置
- ✅ 所有状态流转符合业务逻辑
- ✅ 无孤立数据（外键关联完整）
- ✅ 无非法状态记录

---

### 13.3 性能要求

- ✅ 通知列表查询 < 200ms
- ✅ 定时任务单次执行 < 5秒
- ✅ 订单支付响应 < 500ms

---

### 13.4 安全性要求

- ✅ 并发提现无超额风险
- ✅ 退款操作幂等
- ✅ 敏感信息（银行账号）脱敏展示
- ✅ 权限验证正确

---

## 十四、测试执行记录表

| 测试编号 | 测试场景 | 执行日期 | 执行人 | 结果 | 备注 |
|---------|---------|---------|-------|------|------|
| 2.1 | 通知创建测试 | | | ☐ Pass ☐ Fail | |
| 2.2 | 未读数量统计 | | | ☐ Pass ☐ Fail | |
| 2.3 | 全部标记已读 | | | ☐ Pass ☐ Fail | |
| 3.1 | 方案提交 | | | ☐ Pass ☐ Fail | |
| 3.2 | 用户拒绝方案 | | | ☐ Pass ☐ Fail | |
| 3.3 | 商家重新提交v2 | | | ☐ Pass ☐ Fail | |
| 3.4 | 连续拒绝3次退款 | | | ☐ Pass ☐ Fail | |
| 3.5 | 用户确认方案 | | | ☐ Pass ☐ Fail | |
| 4.1 | 设置商家响应期限 | | | ☐ Pass ☐ Fail | |
| 4.2 | 商家超时退款 | | | ☐ Pass ☐ Fail | |
| 4.3 | 用户超时不退款 | | | ☐ Pass ☐ Fail | |
| 4.4 | 管理员手动退款 | | | ☐ Pass ☐ Fail | |
| 4.5 | 退款幂等性 | | | ☐ Pass ☐ Fail | |
| 5.1 | 系统配置初始化 | | | ☐ Pass ☐ Fail | |
| 5.2 | 订单支付创建收入 | | | ☐ Pass ☐ Fail | |
| 5.3 | 不同类型抽成比例 | | | ☐ Pass ☐ Fail | |
| 5.4 | 修改抽成比例 | | | ☐ Pass ☐ Fail | |
| 5.5 | 批量更新配置 | | | ☐ Pass ☐ Fail | |
| 6.1 | 商家申请提现 | | | ☐ Pass ☐ Fail | |
| 6.2 | 管理员查看列表 | | | ☐ Pass ☐ Fail | |
| 6.3 | 管理员审核通过 | | | ☐ Pass ☐ Fail | |
| 6.4 | 管理员审核拒绝 | | | ☐ Pass ☐ Fail | |
| 6.5 | 重复审核防护 | | | ☐ Pass ☐ Fail | |
| 7.1 | 订单超时取消 | | | ☐ Pass ☐ Fail | |
| 7.2 | 收入自动结算 | | | ☐ Pass ☐ Fail | |
| 7.3 | 定时任务启动 | | | ☐ Pass ☐ Fail | |
| 7.4 | 定时任务频率 | | | ☐ Pass ☐ Fail | |
| 8.1 | E2E成功路径 | | | ☐ Pass ☐ Fail | |
| 8.2 | E2E拒绝重试路径 | | | ☐ Pass ☐ Fail | |
| 8.3 | E2E连续拒绝退款 | | | ☐ Pass ☐ Fail | |
| 8.4 | E2E商家超时退款 | | | ☐ Pass ☐ Fail | |
| 8.5 | E2E用户超时不退款 | | | ☐ Pass ☐ Fail | |
| 9.1 | 提现并发测试 | | | ☐ Pass ☐ Fail | |
| 9.2 | 退款幂等性 | | | ☐ Pass ☐ Fail | |
| 10.1 | 外键关联验证 | | | ☐ Pass ☐ Fail | |
| 10.2 | 金额一致性验证 | | | ☐ Pass ☐ Fail | |
| 10.3 | 状态机验证 | | | ☐ Pass ☐ Fail | |

---

## 十五、已知问题与待办事项

### 15.1 尚未实现功能

- [ ] 支付网关集成（P0-3中退款暂时模拟）
- [ ] 银行账户加密存储（merchant_bank_accounts表）
- [ ] 银行打款API集成（P0-5中暂时模拟）
- [ ] 前端UI页面（通知、提现审核、配置管理）

---

### 15.2 优化建议

- [ ] 通知系统支持批量标记已读
- [ ] 提现审核增加批量审核功能
- [ ] 定时任务增加监控接口（GET /api/v1/admin/system/cron-metrics）
- [ ] 收入记录增加导出功能
- [ ] 方案版本对比功能（diff显示）

---

## 十六、测试环境清理

**测试完成后执行**:
```bash
# 清理测试数据
docker-compose -f docker-compose.local.yml exec db psql -U postgres -d home_decoration -c "TRUNCATE notifications, proposals, orders, merchant_incomes, merchant_withdraws RESTART IDENTITY CASCADE;"

# 或完全重置数据库
docker-compose -f docker-compose.local.yml down -v
docker-compose -f docker-compose.local.yml up -d
```

---

**文档版本**: v1.0
**创建日期**: 2025-12-30
**最后更新**: 2025-12-30
**状态**: 待执行
