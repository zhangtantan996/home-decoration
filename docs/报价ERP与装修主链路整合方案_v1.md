# 报价 ERP 与装修主链路整合方案（v1）

## 1. 现状评估

### 1.1 现有能力已经具备的部分
当前仓库里的报价系统，已经不是空白，而是一个可运行的施工报价 ERP v1。

#### 后端已有核心模型
- 报价任务头：`server/internal/model/quote.go:111`
- 报价任务明细：`server/internal/model/quote.go:141`
- 工长报价头：`server/internal/model/quote.go:178`
- 工长报价明细：`server/internal/model/quote.go:207`
- 报价修订记录：`server/internal/model/quote.go:226`
- 工长价格库：`server/internal/model/quote.go:246`
- 标准报价库/ERP 项：`server/internal/model/quote.go:84`

#### 已有能力
1. 标准项库、模板、价格库
2. 报价任务创建与明细维护
3. 工长报价填报
4. 自动汇总总价
5. 报价版本留痕
6. 工长推荐/选择
7. 用户确认施工报价
8. 与业务流阶段有一定联动

#### 支付能力现状
支付层已经支持多终端能力：
- Web 扫码二维码支付：`server/internal/service/payment_service.go:26`
- H5 支付入口：`server/internal/service/payment_service.go:29`
- 小程序微信拉起支付参数：`server/internal/service/payment_service.go:31`

所以支付通道不是最大问题，最大问题是施工报价确认后的支付计划还没真正与报价 ERP 强绑定。

### 1.2 现状不完整的地方
这套系统目前更像“报价流程系统”，还不是“完整工程 ERP”。

核心缺口有 6 类：
1. 缺设计阶段的工程量源清单层
2. 缺工程量版本管理
3. 缺报价变更单/施工变更单
4. 缺报价确认后的施工支付计划
5. 缺监理角色接入主流程
6. 缺节点验收到结算的自动联动

## 2. 目标业务流

按当前明确的业务规则，正确主链应该是：

### 2.1 前链路
1. 用户发起预约
2. 商家/设计师接单
3. 用户支付量房费
4. 设计师量房
5. 设计师上传量房资料留档
6. 设计师与用户沟通
7. 设计师提交“预算/风格/沟通结果确认单”
8. 用户确认预算/风格确认单

### 2.2 设计链路
9. 设计师输出设计方案
10. 设计师同步提交施工工程量基础表
11. 用户确认设计方案

### 2.3 施工承接链路
12. 系统基于预算与工程量基础表推荐工长
13. 用户自行选择工长，或设计师辅助推荐
14. 系统基于工程量基础表 + 工长价格库生成施工报价
15. 工长确认/调整报价
16. 用户确认施工报价
17. 用户支付施工费用
18. 用户选择开工时间
19. 系统分配工长与监理

### 2.4 施工执行链路
20. 项目开工
21. 工长负责施工
22. 监理负责节点记录、图文上传、进度说明
23. 用户按节点验收
24. 每个节点通过后，触发对应比例结算

### 2.5 收尾链路
25. 监理提交完工资料
26. 用户最终验收
27. 项目完结
28. 延迟支付尾款
29. 项目归档

## 3. 核心业务原则

### 3.1 量房不是用户确认节点
量房资料只做留档，不做用户确认。
用户确认节点是：
- 预算
- 风格
- 初步沟通结果

这点要体现在：
- 状态机
- 页面
- 通知
- 待办

### 3.2 施工工程量基础表不是独立小功能
它必须是报价 ERP 的组成部分。
语义上它不是报价结果，而是工长施工报价的源数据。

它应该由设计师提交，作为后续施工报价、工长推荐、后期变更、节点结算的基础。

### 3.3 当前只做半包
当前施工报价只包含：
- 施工费
- 工费相关项目

不包含主材。
也就是：
- 先做半包
- 不做全包
- 主材系统以后接入再扩

因此报价 ERP 必须明确支持：
- `pricingMode = half_package`
- `materialIncluded = false`

### 3.4 施工过程的节点上传人是监理
不是工长。

角色职责明确成：
- 设计师：前期设计与工程量基础表
- 工长：负责施工
- 监理：负责节点图文、现场记录、验收材料
- 用户：确认关键节点与最终验收

## 4. 报价 ERP 重构方案

### 4.1 总体策略
不推倒重做，不另起孤立系统。
保留现有 Quote ERP 主骨架，在此基础上做 3 层增强：
1. 增加工程量源清单层
2. 增加强支付计划联动
3. 为监理/节点结算留执行接口

### 4.2 建议的新结构

#### 第 1 层：标准项层
继续沿用现有：
- `QuoteLibraryItem`
- `QuoteTemplate`
- `QuotePriceBook`

这一层负责：
- 标准项目
- 单位
- 分类
- 参考价
- 模板
- 价格库

#### 第 2 层：工程量基础表层
建议新增，而不是硬塞旧表。

建议新增表：
- `construction_quantity_bases`
- `construction_quantity_base_items`

表头建议字段：
- id
- booking_id / project_id / proposal_id
- designer_provider_id
- version
- status
- derived_quote_list_id
- confirmed_by_user_at
- notes
- created_at / updated_at

明细建议字段：
- base_id
- room_name
- work_category
- standard_item_id
- item_name
- quantity
- unit
- specification
- formula_snapshot
- remark
- source_type
- sort_order

为什么要单独一层：
- 工程量基础表：设计交付依据
- QuoteListItem：正式报价任务项
- QuoteSubmissionItem：工长报价项

这三者不能混成一个概念。

#### 第 3 层：报价任务层
保留现有 `QuoteList / QuoteListItem`，但增强字段。

`QuoteList` 建议新增：
- quantity_base_id
- quantity_base_version
- pricing_mode
- material_included
- foreman_selection_mode
- selected_by
- recommended_by
- payment_plan_generated_flag

`QuoteListItem` 建议新增：
- quantity_base_item_id
- baseline_quantity
- quoted_quantity
- quantity_adjustable_flag
- quantity_change_reason
- source_stage

这样后续就能知道：
- 哪些数量是设计师给的
- 哪些是工长调整的
- 为什么调整

#### 第 4 层：工长报价层
保留现有：
- `QuoteSubmission`
- `QuoteSubmissionItem`

但建议增强：
- 是否偏离基础量
- 偏离原因
- 是否需平台审核
- 是否需用户再次确认

## 5. 是否需要调整现有报价 ERP

答案：需要，而且建议分两档。

### 5.1 必改项
这些不改，后面一定乱：

1. 增加工程量基础表层
2. 报价任务引用工程量基础表
3. 报价确认后自动生成施工支付计划
4. 加入“半包/不含主材”模式标记
5. 增加监理后续对接字段

### 5.2 可后置项
这些可以第二阶段做：

1. 工程量公式增强
   - 目前 `QuantityFormulaJSON` 已有雏形：`server/internal/model/quote.go:98`
2. 变更单系统
   - 用于增项、减项、现场变更
3. 多级审批
   - 如平台审核报价偏差、超预算提醒等

## 6. 前后端改造建议

### 6.1 设计师/商家端
现有相关页面：
- `merchant/src/pages/merchant/MerchantBookings.tsx:87`
- `merchant/src/pages/merchant/MerchantDesignWorkflow.tsx:3`
- `merchant/src/pages/merchant/MerchantQuoteDetail.tsx:84`

需要新增/增强：

#### A. 预算风格确认页
设计师提交：
- 预算区间
- 风格方向
- 空间需求
- 工期预期
- 特殊要求

用户确认或驳回。

#### B. 设计交付页
设计师提交：
- 设计方案
- 工程量基础表

#### C. 工长推荐页
显示：
- 推荐工长
- 推荐原因
- 预算匹配度
- 区域匹配度
- 价格库覆盖率

### 6.2 用户端（小程序）
现有相关接口：
- `mini/src/services/quoteTasks.ts:85`
- `mini/src/services/quoteTasks.ts:102`
- `mini/src/services/quoteTasks.ts:136`

需要新增/增强：

#### A. 预算风格确认页
用户确认前期沟通结果。

#### B. 设计方案确认页
设计方案确认后自动进入工长选择。

#### C. 工长选择页
支持：
- 平台推荐
- 设计师推荐
- 用户选择

#### D. 施工报价确认页
展示：
- 空间
- 项目
- 数量
- 单位
- 单价
- 小计
- 总价

#### E. 支付方式
当前已明确：
- Web：二维码扫码
- 小程序：H5 / 微信拉起支付

所以用户端支付页要根据终端自动分流。

### 6.3 后端
需增强的核心服务：
- `server/internal/service/quote_service.go:27`
- `server/internal/service/quote_workflow_service.go`
- `server/internal/service/business_flow_service.go:14`
- `server/internal/service/payment_service.go:133`

建议新增能力：

#### A. 工程量基础表服务
- 创建
- 更新
- 版本化
- 锁定
- 生成报价任务

#### B. 工长推荐服务增强
根据：
- 预算
- 工种
- 地区
- 价格库覆盖率
- 历史能力

#### C. 报价确认后支付计划生成
生成：
- 首付款
- 节点款
- 尾款

## 7. 支付方案

### 7.1 支付终端策略
#### Web 端
- 二维码支付
- 用户扫码完成付款
- 适用于 PC 页面

#### 小程序端
- H5 支付
- 微信拉起支付

当前支付服务结构已经能支撑：
- `LaunchURL`
- `QRCodeImageURL`
- `WechatPayParams`

见 `server/internal/service/payment_service.go:26-42`

所以建议：

#### 报价确认后支付接口统一输出
- channel
- launchMode
- qrcode
- h5_url
- wechat_pay_params

前端根据终端渲染。

### 7.2 施工支付结构建议
第一阶段先只做：
1. 施工首付款
2. 节点进度款
3. 尾款

每笔付款都要关联：
- quote_list_id
- project_id
- milestone_id（如有）
- payment_plan_type
- amount
- due_at
- paid_at
- status

## 8. 施工节点与监理方案

### 8.1 角色职责
#### 工长
- 施工执行
- 不上传节点材料

#### 监理
- 上传节点图片
- 上传文字说明
- 上传验收资料
- 提交节点完成

#### 用户
- 节点确认
- 最终验收

### 8.2 节点数据建议
每个节点至少包含：
- 节点名称
- 节点顺序
- 计划开始/结束
- 实际开始/结束
- 图片
- 文字描述
- 风险说明
- 监理备注
- 用户验收状态
- 结算触发状态

## 9. 后台监管建议

后台一定要加一个链路看板，不然管理层看不到问题。

建议展示字段：
- 当前阶段
- 当前负责人
- 是否待用户确认
- 是否待商家处理
- 是否待监理提交
- 是否待支付
- 是否超时
- 当前累计应付 / 已付 / 待付
- 当前节点
- 是否存在争议

## 10. 分阶段实施建议

### 第一阶段：最小可落地闭环
目标：先把“设计 → 工长选择 → 报价 → 支付 → 开工”打通。

做这些：
1. 新增预算/风格确认单
2. 新增工程量基础表
3. 工程量基础表生成报价任务
4. 工长推荐与选择
5. 用户确认施工报价
6. 施工首付款支付
7. 开工时间选择

### 第二阶段：施工执行闭环
1. 增加监理角色链路
2. 节点上传
3. 节点验收
4. 节点款结算

### 第三阶段：完工与尾款
1. 最终验收
2. 尾款延迟支付
3. 项目归档
4. 售后入口

## 11. 最终判断

### 11.1 报价 ERP 是否完整？
不完整，但不是重做级别。

现在的状态更准确地说是：
- 施工报价 ERP v1：有
- 工程量驱动型 ERP：还没有
- 施工执行/监理/结算一体化 ERP：还没有

### 11.2 是否需要调整？
需要。

最核心的调整只有一句话：

> 把“施工工程量基础表”定义为现有报价 ERP 的源清单层，并让施工支付计划从报价确认时自动生成。

这两件事做好，整条链路才会稳。
