# 待开发功能列表 (Pending Features List)

> **基于文档**: `docs/BUSINESS_FLOW.md`
> **最后更新**: 2025-12-29

---

## 1. 异常处理与自动化 (Exception & Automation)

- [ ] **方案版本管理 (Proposal Versioning)**
    - **当前状态**: 仅支持单一方案状态变更。
    - **需求**: 商家重新提交被拒方案时，自动生成 v2, v3 版本记录，保留历史变更。

- [ ] **超时自动任务 (Cron Jobs)**
    - **商家响应超时**: 支付意向金后 48 小时未接单 -> 自动触发退款 (Refund) + 关闭预约。
    - **用户确认超时**: 方案提交后 14 天未确认 -> 自动变更状态为 `cancelled`。

## 2. 消息通知体系 (Notifications)

- [ ] **业务通知服务 (Business Notification Service)**
    - **当前状态**: `sms_service.go` 仅包含验证码限流逻辑。
    - **需求**:
        - 意向金支付成功 -> 通知商家 (短信/App)。
        - 方案已提交 -> 通知用户。
        - 账单生成 -> 通知用户。

- [ ] **推送集成 (Push/WebSocket)**
    - 集成 WebSocket 或第三方推送服务（如极光推送/FCM），实现 App 端实时弹窗提醒。

## 3. 合同与售后 (Contract & After-Sales)

- [ ] **电子合同生成 (E-Contract)**
    - 基于 HTML/PDF 模板，将 user/provider/project 信息自动填充生成合同文件。
    - 集成电子签名（或预留签名位置）。

- [ ] **售后评价模块 (Reviews)**
    - 新增 `Review` 表：评分 (1-5星)、评论内容、图片。
    - 在项目状态变为 `completed` 后开放入口。

- [ ] **售后工单 (Warranty Claims)**
    - 新增 `Ticket` 表：处理质保期内的维修申请。

## 4. 管理后台增强 (Admin Enhancements)

- [ ] **配置管理 UI (System Config UI)**
    - 虽然后端已实现 `SystemConfig` 表，但前端 Admin 缺少修改 "意向金金额"、"超时阈值" 的界面。

---

## 5. 发现的问题 (Identified Issues)

1. **SMS 服务功能单一**: 目前 `sms_service.go` 还是基于内存的 Mock 实现（虽然符合开发阶段需求），且没有对接真实的短信网关。
2. **意向金退款路径**: 缺少自动退款的支付网关对接逻辑（目前仅修改数据库状态）。
3. **文件权限粒度**: 目前文件鉴权基于 `Order` 支付状态，但在多阶段项目中，可能需要更细粒度的控制（如：支付一期款仅解锁一期图纸）。


UI方面
    移动端
        1. 
    管理后台
        1. 预约管理-操作的取消按钮在特定情况下UI超出了模块区域。

---

## 6. 商家中心待定事项 (Merchant Center Pending)

> **相关文档**: `implementation_plan.md` (商家中心技术设计方案)

### 6.1 待确认业务规则

- [ ] **平台抽成比例**
    - 意向金、设计费、施工款分别抽成多少？
    - 建议：意向金不抽成，设计费/施工款抽成 5%-10%
    - 需确定后配置到 `SystemConfig` 表

- [ ] **提现审核流程**
    - 方案A：自动审核（满足条件自动放款，如结算满7天）
    - 方案B：人工审核（每笔提现需管理员审批）
    - 建议：小额自动（≤5000元），大额人工审核

- [ ] **提现到账周期**
    - T+0 实时到账 / T+1 次日到账 / T+3 三日内到账
    - 影响用户体验和资金安全，需业务决策

### 6.2 延后开发功能

- [ ] **团队管理 (Team Management)**
    - **当前决策**: MVP 不包含，后续版本迭代
    - **功能描述**: 工作室/公司邀请成员、角色权限分配
    - **预计工期**: 3-5 天

- [ ] **供应链直付 (Supply Chain Payment)**
    - **当前决策**: 仅公司类型可用，延后开发
    - **功能描述**: 材料款直接打款给供应商，防止挪用

- [ ] **施工日志 AI 检测 (AI Quality Check)**
    - **功能描述**: 上传施工照片，AI 自动识别质量问题
    - **依赖**: 需集成 AI 视觉服务

---

## 7. 支付系统集成 (Payment Integration) 🔴 P0

> **优先级**: 高 (生产环境必需)  
> **阻塞状态**: 等待业务准备完成  
> **预计总工时**: 5-7 人天

### 7.1 当前风险

| 风险 | 严重程度 | 说明 |
| :--- | :---: | :--- |
| **并发安全漏洞** | 🔴 高 | 提现扣减未加锁，高并发可能导致资金负数 |
| **二清合规风险** | 🔴 高 | 资金在平台停留，违反央行规定 |
| **无真实支付** | 🟡 中 | 目前仅模拟支付状态，无法收款 |

### 7.2 业务准备 (需您完成)

- [ ] **注册微信小程序** (1-2 天)
    - 入口: [微信公众平台](https://mp.weixin.qq.com/) → 注册 → 小程序
    - 主体: 企业或个体工商户

- [ ] **申请微信支付商户号** (3-5 天)
    - 入口: [微信支付商户平台](https://pay.weixin.qq.com/) → 成为商户
    - 材料: 营业执照、法人身份证、对公银行账户

- [ ] **开通分账能力** (1-2 天)
    - 入口: 商户平台 → 产品中心 → 分账 → 申请开通
    - 前置: 商户号已激活

- [ ] **下载 API 证书**
    - 入口: 商户平台 → 账户中心 → API安全 → 下载证书
    - 产出: `apiclient_key.pem`, `apiclient_cert.pem`

### 7.3 技术实现 (开发任务)

#### Phase 1: 基础设施 (1 天)

- [ ] **新增支付模型** `server/internal/model/payment.go`
    ```go
    // PaymentOrder 支付订单
    type PaymentOrder struct {
        Base
        OutTradeNo          string  `gorm:"uniqueIndex;size:32"`  // 商户订单号
        TransactionID       string  `gorm:"size:32"`              // 微信支付订单号
        RelatedType         string  `gorm:"size:20"`              // booking / milestone
        RelatedID           uint64  `gorm:"index"`
        Amount              int64                                 // 金额(分)
        Status              int8    `gorm:"default:0"`            // 0:待支付 1:已支付 2:已退款 3:已关闭
        Channel             string  `gorm:"size:20;default:wechat"`
        ProfitSharingStatus int8    `gorm:"default:0"`            // 0:未分账 1:已分账
        PaidAt              *time.Time
    }

    // ProfitSharingRecord 分账记录
    type ProfitSharingRecord struct {
        Base
        PaymentOrderID  uint64  `gorm:"index"`
        OutOrderNo      string  `gorm:"size:64"`      // 分账单号
        ReceiverType    string  `gorm:"size:32"`      // MERCHANT_ID / PERSONAL_OPENID
        ReceiverAccount string  `gorm:"size:64"`      // 商户号或OpenID
        Amount          int64                         // 分账金额(分)
        Description     string  `gorm:"size:80"`
        Status          int8    `gorm:"default:0"`    // 0:处理中 1:成功 2:失败
    }
    ```

- [ ] **新增配置项** `config.yaml`
    ```yaml
    payment:
      wechat:
        enabled: false  # 开发阶段关闭
        mch_id: ""
        app_id: ""
        api_v3_key: ""
        serial_no: ""
        private_key_path: "./certs/apiclient_key.pem"
        notify_url: "https://yourdomain.com/api/v1/webhook/wechat/pay"
      platform_fee_rate: 0.10  # 平台抽成 10%，可后台配置
    ```

- [ ] **添加 SDK 依赖**
    ```powershell
    cd server
    go get github.com/wechatpay-apiv3/wechatpay-go
    ```

#### Phase 2: 下单与回调 (1.5 天)

- [ ] **创建支付服务** `server/internal/service/payment_service.go`
    - `CreateJSAPIOrder(orderType, relatedID, amount, description)` → 返回 prepay_id
    - `HandlePaymentCallback(request)` → 验签、解密、更新状态
    - `CloseOrder(outTradeNo)` → 关闭超时订单

- [ ] **创建回调 Handler** `server/internal/handler/payment_callback_handler.go`
    - 路由: `POST /api/v1/webhook/wechat/pay`
    - 验证 `Wechatpay-Signature` 请求头
    - 幂等处理: 通过 `out_trade_no` 判断是否已处理

- [ ] **注册路由** `server/internal/router/router.go`
    ```go
    // 微信支付回调 (无需鉴权)
    webhook := r.Group("/api/v1/webhook")
    {
        webhook.POST("/wechat/pay", handler.WechatPayCallback)
        webhook.POST("/wechat/profitsharing", handler.WechatProfitSharingCallback)
    }
    ```

#### Phase 3: 分账集成 (1.5 天)

- [ ] **实现分账服务**
    - `RequestProfitSharing(paymentOrderID, receivers)` → 发起分账
    - `QueryProfitSharingResult(outOrderNo)` → 查询分账结果
    - `AddProfitSharingReceiver(openID, name)` → 添加分账接收方

- [ ] **商家绑定 OpenID**
    - `Provider` 表增加 `WechatPayOpenID` 字段
    - 商家入驻流程增加微信授权绑定步骤

- [ ] **分账回调处理**
    - 路由: `POST /api/v1/webhook/wechat/profitsharing`
    - 更新 `ProfitSharingRecord.Status`

#### Phase 4: 业务改造 (1.5 天)

- [ ] **预约支付流程改造** `booking_handler.go`
    - 创建预约时生成 `PaymentOrder`
    - 前端调起微信支付
    - 支付成功回调更新 `Booking.IntentFeePaid`

- [ ] **里程碑支付流程改造** `milestone_handler.go`
    - 验收通过后生成 `PaymentOrder`
    - 支付成功后自动触发分账

- [ ] **前端支付组件** (React Native)
    - 集成 `react-native-wechat-lib`
    - 实现支付调起和结果回调

#### Phase 5: 测试 (1 天)

- [ ] **沙箱测试**
    - 使用微信支付沙箱环境
    - 测试支付、退款、分账全流程

- [ ] **回调模拟**
    - 编写测试脚本模拟微信回调
    - 验证幂等性和异常处理

- [ ] **并发压测**
    - 使用 `wrk` 或 `vegeta` 压测提现接口
    - 验证数据库锁有效性

### 7.4 临时方案 (商户号申请期间)

在完成业务准备之前，可先实施**并发安全修复**：

- [ ] **数据库行锁** (0.5 天)
    - 在 `MerchantWithdrawCreate` 中使用 `SELECT FOR UPDATE`
    - 在 `AdminWithdraw` 中使用事务 + 行锁

```go
// 示例代码
tx := repository.DB.Begin()
tx.Set("gorm:query_option", "FOR UPDATE").
    First(&account, accountId)
// ... 检查余额并扣减 ...
tx.Commit()
```

### 7.5 配置项说明

| 配置项 | 说明 | 默认值 |
| :--- | :--- | :--- |
| `platform_fee_rate` | 平台抽成比例 | 0.10 (10%) |
| `min_withdraw_amount` | 最小提现金额 | 100 元 |
| `withdraw_fee` | 提现手续费 | 0 元 |
| `auto_settle_days` | 自动结算天数 | 7 天 |

以上配置应可在 Admin 后台「系统设置」页面动态修改。
