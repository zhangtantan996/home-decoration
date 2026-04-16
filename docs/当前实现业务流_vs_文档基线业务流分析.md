# 当前实现业务流 vs 文档基线业务流分析

> 面向当前仓库 `home-decoration` 的代码与文档对照分析。
> 结论目标：判断当前代码实际在推进什么业务流，和文档定义的主业务流是否一致，差距在哪里。

## 1. 结论先行

当前项目实际推进的，不是内容展示型家装产品，而是一个以`设计成交 -> 施工承接 -> 项目履约 -> 验收/资金/争议治理`为主链路的家装交易与治理平台。

从代码实现来看，当前仓库与文档基线整体方向是基本一致的，尤其在以下关键规则上已经对齐：

- `小程序/mini`承担用户成交与项目跟进入口，而不是单纯内容浏览入口。
- `merchant`承担商家接单、设计提案、施工承接、项目执行协同。
- `admin`承担审核、风控、退款、仲裁、资金治理。
- `设计确认`和`施工确认`是分离的两个阶段，不是一个合并动作。
- `项目创建`发生在施工报价/施工方确认之后，而不是设计方案确认之后。

但当前实现与文档基线仍然存在一些结构性缺口：

- 设计前链路比文档更细，已经拆出了量房定金、设计报价、设计交付、设计验收等阶段；这属于实现增强，不是偏航。
- 施工后链路中的里程碑验收、放款、归档、案例沉淀虽然已有明显基础，但闭环完整度还需要继续核实和补强。
- 一些文档中的业务口径已经在代码里转化为阶段状态与治理页面，但是否形成全链路一致的用户体验，还需要联调与验收验证。

## 2. 文档基线业务流

依据当前项目文档，主业务流可归纳为以下 9 步：

1. 商家入驻与能力配置。
2. 用户进入平台并产生线索、预约、量房需求。
3. 设计师量房、沟通需求、形成预算与方案方向。
4. 提交设计方案/报价，用户确认设计方案，形成第一个成交点。
5. 用户选择施工主体/工长并确认施工报价，形成第二个成交点。
6. 在施工主体确认后创建项目，进入正式履约阶段。
7. 按项目阶段/里程碑推进施工、对账、验收。
8. 验收后进入放款、退款、关闭或争议处理。
9. 项目完成后归档，并沉淀案例、评价与治理记录。

文档中的硬规则包括：

- `设计确认`与`工长确认`必须分开，不能合并成一个单点成交。
- `项目创建`只能在工长确认之后发生。
- 验收、放款、退款、争议属于主链路，不是附属模块。
- 平台当前阶段的主要交易入口是`mini`，主要履约入口是`merchant`，主要治理入口是`admin`。

## 3. 当前代码中的已实现业务流信号

### 3.1 用户端 mini：已经不是内容产品，而是交易前台

从 `mini/src/app.config.ts` 的页面注册可以直接看出，当前用户端已覆盖的核心业务面包括：

- 内容与种草：
  - `pages/home/index`
  - `pages/inspiration/index`
  - `pages/cases/*`
  - `pages/providers/*`
- 预约与设计前链路：
  - `pages/booking/create/index`
  - `pages/booking/list/index`
  - `pages/booking/detail/index`
  - `pages/booking/site-survey/index`
  - `pages/booking/design-quote/index`
  - `pages/booking/design-deliverable/index`
- 施工桥接与确认：
  - `pages/proposals/list/index`
  - `pages/proposals/detail/index`
  - `pages/quote-tasks/detail/index`
  - `pages/orders/*`
- 项目履约：
  - `pages/projects/detail/index`
  - `pages/projects/completion/index`
  - `pages/projects/contract/index`
  - `pages/projects/design-deliverable/index`
  - `pages/projects/change-request/index`
  - `pages/projects/pause/index`
  - `pages/projects/dispute/index`
  - `pages/projects/bill/index`
- 治理与售后：
  - `pages/bookings/refund/index`
  - `pages/refunds/list/index`
  - `pages/support/index`
  - `pages/messages/index`

这说明用户端的实际定位已经很明确：

- 前半段负责内容承接和预约转化；
- 中段负责设计确认、施工桥接、订单确认；
- 后段负责项目进度、账单、争议、退款与售后。

也就是说，当前 `mini` 已经基本符合文档里“主成交端”的定位。

### 3.2 商家端 merchant：已承接从预约到履约的主执行链

从 `merchant/src/router/index.tsx` 可以看到，商家端已经形成完整业务工作台：

- 入驻与审核前状态：
  - `/register`
  - `/apply-status`
  - `/onboarding/completion`
- 线索/预约管理：
  - `/bookings`
  - `/bookings/:id/site-survey`
  - `/bookings/:id/budget-confirm`
  - `/bookings/:id/design-workflow`
- 提案与施工桥接：
  - `/proposals`
  - `/proposals/flow/:id`
  - `/quote-lists`
  - `/quote-lists/:id`
  - `/price-book`
- 项目履约：
  - `/projects`
  - `/projects/:id`
  - `/projects/:id/dispute`
  - `/orders`
  - `/contracts/new`
- 商家经营与结算：
  - `/income`
  - `/bond`
  - `/withdraw`
  - `/bank-accounts`
  - `/payments/result`
- 口碑与沉淀：
  - `/cases`
  - `/complaints`
  - `/notifications`

这说明 `merchant` 的真实角色不是“商家资料后台”，而是：

- 接预约
- 跟进量房
- 做设计
- 提交方案
- 推进施工报价确认
- 接项目执行
- 处理中后期纠纷
- 参与收入与提现

也就是说，当前 `merchant` 已基本落在文档定义的“主履约端”上。

### 3.3 管理端 admin：治理中台已具备明确轮廓

从 `admin/src/router.tsx` 可见，当前管理端已形成强治理导向：

- 供给治理：
  - `providers/*`
  - `materials/*`
  - `audits/*`
  - `identity-applications`
- 项目与过程治理：
  - `projects/list`
  - `projects/detail/:id`
  - `supervision/projects`
  - `demands/*`
  - `bookings/*`
- 风控与争议：
  - `complaints`
  - `project-audits/*`
  - `risk/warnings`
  - `risk/arbitration`
- 资金治理：
  - `finance/overview`
  - `finance/escrow`
  - `finance/transactions`
  - `refunds`
  - `withdraws`
  - `orders`
- 平台治理基础设施：
  - `reviews/*`
  - `cases/manage`
  - `logs/*`
  - `audit-logs`
  - `settings/*`
  - `permission/*`

这说明 `admin` 的实现方向与文档非常一致：不是单纯 CMS 或配置后台，而是围绕审核、资金、纠纷、过程监管展开的治理后台。

## 4. 当前实现与文档基线的对齐情况

## 4.1 已明确对齐的部分

### A. 双成交点已被保留

文档要求：

- 先确认设计方案；
- 再确认施工主体/施工报价；
- 两者不能合并。

代码信号：

- `server/internal/model/business_closure.go` 中业务流阶段明确区分：
  - `design_pending_confirmation`
  - `construction_party_pending`
  - `construction_quote_pending`
  - `ready_to_start`
- 这说明后端状态机层面并没有把设计确认和施工确认揉成一个状态。

判断：`已对齐`。

### B. 设计确认后不直接建项目

文档要求：

- 用户确认设计方案后，进入施工桥接；
- 项目只在工长/施工报价确认之后创建。

代码证据：

- `server/internal/service/proposal_service.go` 中 `ConfirmProposal` 的注释直接写明：
  - `用户确认正式方案 -> 进入施工桥接`
- `server/internal/service/proposal_design_prechain_test.go` 中测试明确断言：
  - 设计确认后业务流进入 `construction_party_pending`
  - `expected no project created after proposal confirmation`
  - `expected zero projects after proposal confirmation`
- `server/internal/service/quote_workflow_service.go` 中施工报价确认事务里：
  - 调用 `getOrCreateProjectForQuoteConfirmationTx(...)`
  - 随后把业务流推进到 `ready_to_start`
  - 并写入 `project_id`

判断：`强对齐`，这是当前仓库最关键的一个业务正确性信号。

### C. 项目后链路已包含治理与售后

文档要求：

- 退款、争议、仲裁、财务、验收是主链路组成部分。

代码信号：

- `mini` 里已有退款、争议、项目账单、完工页。
- `merchant` 里已有项目纠纷、投诉、收入、保证金、提现。
- `admin` 里已有退款、仲裁、风控、托管资金、提现审核、项目审计。

判断：`方向对齐`。

## 4.2 当前实现比文档更细化的部分

### A. 设计前链路被拆得更细

文档通常以“预约 -> 量房 -> 方案 -> 设计确认”来描述。

而代码里的状态与页面已经细化出更多节点：

- `survey_deposit_pending`
- `design_quote_pending`
- `design_fee_paying`
- `design_delivery_pending`
- `design_acceptance_pending`
- 以及 mini 里的：
  - `orders/survey-deposit`
  - `booking/design-quote`
  - `booking/design-deliverable`

判断：这是对文档链路的实现增强，说明当前产品已经不只是“预约一下然后出方案”，而是在尝试把设计服务本身做成可支付、可交付、可验收的独立交易阶段。

### B. 施工确认后存在支付暂停与待开工协调

在 `quote_workflow_service.go` 中，施工报价确认后项目会被打上：

- `business_status = construction_quote_confirmed`
- `current_phase = 待监理协调开工`
- `payment_paused = true`
- `payment_paused_reason = 等待支付首付款`

判断：这说明实现里已经开始把“报价确认”与“正式开工”之间的监管、首付款、监理协调拆出来。这比文档摘要描述更偏执行层，也更贴近真实履约场景。

## 4.3 仍需继续核实或补强的部分

### A. 里程碑验收与放款闭环是否完全打通

后端状态中已经存在：

- `node_acceptance_in_progress`
- `milestone_review`
- `completed`
- `archived`
- `payment_paused`

但当前仅从本轮代码抽样，还不能完全证明以下事项已经全链路打通：

- 用户端是否可完整发起每个节点验收；
- 商家端是否可逐节点提交验收材料；
- 管理端是否可介入异常节点审核；
- 财务端是否与验收节点自动绑定放款；
- 全量场景下是否同时支持“里程碑放款”和“整体验收一次性放款”。

判断：`有基础，但需要专项核验`。

### B. 完工 -> 归档 -> 案例沉淀的业务口径是否完全一致

当前已知事实：

- 状态模型里存在 `case_pending_generation` 和 `archived`。
- 项目完成相关页面、案例管理页面均已存在。
- 但是否所有路径都严格遵循“完成后生成案例草稿，再归档”的统一流程，仍需继续核验服务链路。

判断：`已有实现痕迹，但需要继续查主服务路径`。

### C. 文档里的“治理视角”已进入后台，但前台体验是否完全统一未知

也就是说：

- 路由和页面都已经显示出完整业务意图；
- 但页面存在不等于最终用户路径已经顺滑闭环；
- 仍需继续结合 API、状态机和实际页面交互去验证每个环节是否真正可达、可提交、可回退、可关闭。

## 5. 总体差距判断

如果用“偏航 / 对齐 / 超前细化”三个维度来判断：

- 主链路方向：`对齐`
- 双成交点机制：`对齐`
- 项目创建时机：`强对齐`
- 用户端角色定位：`对齐`
- 商家端角色定位：`对齐`
- 管理端治理角色：`对齐`
- 设计交易前链路：`超前细化`
- 履约后链路闭环：`部分对齐，仍需补强验证`

## 6. 最终结论

当前仓库实际构建的产品，与文档定义的主业务模型总体一致。

它正在落地的是一个：

- 以用户预约和设计成交为起点，
- 以施工方确认和项目创建为中枢转折，
- 以项目履约、验收、资金、退款、争议治理为核心壁垒，
- 由 `mini + merchant + admin` 三端协同完成的家装交易治理平台。

不是内容平台，也不是单纯 CRM，更不是只有预约和报价的撮合工具。

它的当前实现已经明显跨过“展示/获客产品”的阶段，进入“交易链路产品 + 履约治理产品”的阶段。

## 7. 建议的下一步

如果继续做产品/架构梳理，建议优先核查这三件事：

1. 里程碑验收与放款是否真正形成自动或半自动闭环。
2. 完工、归档、案例生成、评价沉淀是否完全统一在一条主服务链上。
3. 用户端、商家端、管理端对同一业务阶段的状态口径是否一致，是否存在页面文案与后端状态机不一致的问题。
